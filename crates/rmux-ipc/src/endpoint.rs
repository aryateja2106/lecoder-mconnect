//! Local endpoint naming.

use std::ffi::OsStr;
#[cfg(unix)]
use std::ffi::OsString;
use std::io;
#[cfg(unix)]
use std::os::unix::ffi::{OsStrExt, OsStringExt};
#[cfg(windows)]
use std::os::windows::ffi::OsStrExt;
use std::path::{Path, PathBuf};
#[cfg(windows)]
use std::ptr::null_mut;

#[cfg(windows)]
use rmux_os::identity::{IdentityResolver, UserIdentity};
#[cfg(windows)]
use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
#[cfg(windows)]
use windows_sys::Win32::Security::{
    GetSidSubAuthority, GetSidSubAuthorityCount, GetTokenInformation, TokenIntegrityLevel,
    TOKEN_MANDATORY_LABEL, TOKEN_QUERY,
};
#[cfg(windows)]
use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

const DEFAULT_SOCKET_LABEL: &str = "default";
#[cfg(unix)]
const FALLBACK_SOCKET_ROOT: &str = "/tmp";
const RMUX_ENV: &str = "RMUX";
#[cfg(unix)]
const RMUX_TMPDIR_ENV: &str = "RMUX_TMPDIR";
const SOCKET_DIR_PREFIX: &str = "rmux";
#[cfg(windows)]
const PIPE_PREFIX: &str = r"\\.\pipe\";

/// Address of a local RMUX endpoint.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct LocalEndpoint {
    path: PathBuf,
}

impl LocalEndpoint {
    /// Builds an endpoint from an explicit Unix socket path.
    #[must_use]
    pub fn from_path(path: PathBuf) -> Self {
        Self { path }
    }

    /// Returns the Unix socket path for this endpoint.
    #[must_use]
    pub fn as_path(&self) -> &Path {
        &self.path
    }

    /// Consumes the endpoint into its Unix socket path.
    #[must_use]
    pub fn into_path(self) -> PathBuf {
        self.path
    }

    /// Returns the Windows named-pipe path for this endpoint.
    #[cfg(windows)]
    #[must_use]
    pub fn as_pipe_name(&self) -> &OsStr {
        self.path.as_os_str()
    }
}

/// Computes the default RMUX endpoint.
pub fn default_endpoint() -> io::Result<LocalEndpoint> {
    endpoint_for_label(DEFAULT_SOCKET_LABEL)
}

/// Computes an RMUX endpoint for a top-level `-L` socket name.
pub fn endpoint_for_label(label: impl AsRef<OsStr>) -> io::Result<LocalEndpoint> {
    endpoint_for_label_impl(label.as_ref())
}

#[cfg(unix)]
fn endpoint_for_label_impl(label: &OsStr) -> io::Result<LocalEndpoint> {
    let user_id = rmux_os::identity::real_user_id();
    endpoint_from_parts(std::env::var_os(RMUX_TMPDIR_ENV).as_deref(), user_id, label)
}

#[cfg(windows)]
fn endpoint_for_label_impl(label: &OsStr) -> io::Result<LocalEndpoint> {
    let identity = IdentityResolver::current()?;
    let UserIdentity::Sid(sid) = identity else {
        return Err(io::Error::other(
            "Windows identity resolver returned a non-SID identity",
        ));
    };
    let label = pipe_component(label);
    let sid = pipe_component(OsStr::new(sid.as_ref()));
    let integrity = current_integrity_label()?;
    Ok(LocalEndpoint::from_path(PathBuf::from(format!(
        "{PIPE_PREFIX}{SOCKET_DIR_PREFIX}-{sid}-il-{integrity}-{label}"
    ))))
}

#[cfg(unix)]
fn endpoint_from_parts(
    rmux_tmpdir: Option<&OsStr>,
    user_id: u32,
    label: &OsStr,
) -> io::Result<LocalEndpoint> {
    let root = socket_root_from_parts(rmux_tmpdir)?;
    let base = root.join(format!("{SOCKET_DIR_PREFIX}-{user_id}"));
    let mut path = os_string_into_bytes(base.into_os_string());
    path.push(b'/');
    path.extend_from_slice(os_str_bytes(label).as_ref());

    Ok(LocalEndpoint::from_path(path_buf_from_bytes(path)))
}

/// Resolves the top-level endpoint from `-L`, `-S`, `$RMUX`, or defaults.
///
/// `-S` wins over `-L`; both command-line forms win over `$RMUX`.
pub fn resolve_endpoint(
    socket_name: Option<&OsStr>,
    socket_path: Option<&Path>,
) -> io::Result<LocalEndpoint> {
    if let Some(socket_path) = socket_path {
        return endpoint_for_socket_path(socket_path);
    }
    if let Some(socket_name) = socket_name {
        return endpoint_for_label(socket_name);
    }
    if let Some(socket_path) = socket_path_from_rmux_env(std::env::var_os(RMUX_ENV).as_deref()) {
        return Ok(LocalEndpoint::from_path(socket_path));
    }

    default_endpoint()
}

#[cfg(unix)]
fn endpoint_for_socket_path(socket_path: &Path) -> io::Result<LocalEndpoint> {
    Ok(LocalEndpoint::from_path(socket_path.to_path_buf()))
}

#[cfg(windows)]
fn endpoint_for_socket_path(socket_path: &Path) -> io::Result<LocalEndpoint> {
    if socket_path_is_rmux_owned(socket_path) {
        return Ok(LocalEndpoint::from_path(socket_path.to_path_buf()));
    }

    Err(io::Error::new(
        io::ErrorKind::InvalidInput,
        "Windows -S requires an explicit \\\\.\\pipe\\rmux-... endpoint; use -L for labels",
    ))
}

/// Resolves the root directory used for RMUX sockets.
#[cfg(unix)]
pub fn socket_root_from_parts(rmux_tmpdir: Option<&OsStr>) -> io::Result<PathBuf> {
    let rmux_tmpdir = rmux_tmpdir
        .filter(|value| !value.is_empty())
        .map(PathBuf::from);
    let candidates = rmux_tmpdir
        .into_iter()
        .chain(std::iter::once(PathBuf::from(FALLBACK_SOCKET_ROOT)));

    for candidate in candidates {
        if let Ok(resolved) = std::fs::canonicalize(&candidate) {
            return Ok(resolved);
        }
    }

    Err(io::Error::new(
        io::ErrorKind::NotFound,
        "no suitable rmux socket directory",
    ))
}

fn socket_path_from_rmux_env(rmux: Option<&OsStr>) -> Option<PathBuf> {
    let rmux = rmux?;
    let bytes = os_str_bytes(rmux);
    if bytes.is_empty() || bytes.first() == Some(&b',') {
        return None;
    }

    let end = bytes
        .iter()
        .position(|byte| *byte == b',')
        .unwrap_or(bytes.len());
    let path = path_buf_from_bytes(bytes[..end].to_vec());
    socket_path_is_rmux_owned(&path).then_some(path)
}

fn socket_path_is_rmux_owned(path: &Path) -> bool {
    socket_path_is_rmux_owned_impl(path)
}

#[cfg(unix)]
fn socket_path_is_rmux_owned_impl(path: &Path) -> bool {
    path.parent()
        .and_then(Path::file_name)
        .and_then(OsStr::to_str)
        .is_some_and(|name| {
            name.starts_with(SOCKET_DIR_PREFIX) && name[SOCKET_DIR_PREFIX.len()..].starts_with('-')
        })
}

#[cfg(windows)]
fn socket_path_is_rmux_owned_impl(path: &Path) -> bool {
    let value = path.as_os_str().to_string_lossy();
    let Some(rest) = strip_ascii_prefix(&value, PIPE_PREFIX) else {
        return false;
    };
    rest.starts_with(SOCKET_DIR_PREFIX) && rest[SOCKET_DIR_PREFIX.len()..].starts_with('-')
}

#[cfg(windows)]
fn strip_ascii_prefix<'a>(value: &'a str, prefix: &str) -> Option<&'a str> {
    value
        .get(..prefix.len())
        .is_some_and(|head| head.eq_ignore_ascii_case(prefix))
        .then(|| &value[prefix.len()..])
}

#[cfg(unix)]
fn os_str_bytes(value: &OsStr) -> Vec<u8> {
    value.as_bytes().to_vec()
}

#[cfg(unix)]
fn os_string_into_bytes(value: OsString) -> Vec<u8> {
    value.into_vec()
}

#[cfg(unix)]
fn path_buf_from_bytes(bytes: Vec<u8>) -> PathBuf {
    PathBuf::from(OsString::from_vec(bytes))
}

#[cfg(windows)]
fn os_str_bytes(value: &OsStr) -> Vec<u8> {
    value.to_string_lossy().as_bytes().to_vec()
}

#[cfg(windows)]
fn path_buf_from_bytes(bytes: Vec<u8>) -> PathBuf {
    PathBuf::from(String::from_utf8_lossy(&bytes).into_owned())
}

#[cfg(windows)]
fn pipe_component(value: &OsStr) -> String {
    let mut component = String::new();
    for unit in value.encode_wide() {
        if is_pipe_component_unit(unit) {
            component.push(char::from_u32(u32::from(unit)).expect("ASCII unit"));
        } else {
            component.push('~');
            component.push_str(&format!("{unit:04X}"));
        }
    }
    if component.is_empty() {
        DEFAULT_SOCKET_LABEL.to_owned()
    } else {
        component
    }
}

#[cfg(windows)]
fn current_integrity_label() -> io::Result<&'static str> {
    let token = current_process_token()?;
    let mut needed = 0_u32;
    unsafe {
        // SAFETY: This first call follows the documented sizing pattern.
        GetTokenInformation(token.get(), TokenIntegrityLevel, null_mut(), 0, &mut needed);
    }
    if needed == 0 {
        return Err(io::Error::last_os_error());
    }

    let mut buffer = vec![0_u8; usize::try_from(needed).map_err(|_| io::ErrorKind::InvalidData)?];
    let ok = unsafe {
        // SAFETY: buffer is writable for the reported byte count and token is valid.
        GetTokenInformation(
            token.get(),
            TokenIntegrityLevel,
            buffer.as_mut_ptr().cast(),
            needed,
            &mut needed,
        )
    };
    if ok == 0 {
        return Err(io::Error::last_os_error());
    }

    let mandatory_label = unsafe {
        // SAFETY: TokenIntegrityLevel initializes TOKEN_MANDATORY_LABEL at the buffer start.
        &*(buffer.as_ptr().cast::<TOKEN_MANDATORY_LABEL>())
    };
    integrity_label_from_sid(mandatory_label.Label.Sid)
}

#[cfg(windows)]
fn current_process_token() -> io::Result<OwnedHandle> {
    let mut token = null_mut();
    let ok = unsafe {
        // SAFETY: GetCurrentProcess returns a valid pseudo-handle and token is an out pointer.
        OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token)
    };
    if ok == 0 {
        return Err(io::Error::last_os_error());
    }
    Ok(OwnedHandle(token))
}

#[cfg(windows)]
fn integrity_label_from_sid(sid: *mut core::ffi::c_void) -> io::Result<&'static str> {
    if sid.is_null() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Windows returned a null integrity SID",
        ));
    }
    let count_ptr = unsafe {
        // SAFETY: sid comes from a successfully queried TOKEN_MANDATORY_LABEL.
        GetSidSubAuthorityCount(sid)
    };
    if count_ptr.is_null() {
        return Err(io::Error::last_os_error());
    }
    let count = unsafe { *count_ptr };
    if count == 0 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Windows integrity SID has no subauthorities",
        ));
    }
    let rid_ptr = unsafe {
        // SAFETY: count is non-zero and the last subauthority index is valid.
        GetSidSubAuthority(sid, u32::from(count - 1))
    };
    if rid_ptr.is_null() {
        return Err(io::Error::last_os_error());
    }
    let rid = unsafe { *rid_ptr };
    Ok(match rid {
        0x0000_0000..=0x0000_0FFF => "untrusted",
        0x0000_1000..=0x0000_1FFF => "low",
        0x0000_2000..=0x0000_2FFF => "medium",
        0x0000_3000..=0x0000_3FFF => "high",
        _ => "system",
    })
}

#[cfg(windows)]
struct OwnedHandle(HANDLE);

#[cfg(windows)]
impl OwnedHandle {
    fn get(&self) -> HANDLE {
        self.0
    }
}

#[cfg(windows)]
impl Drop for OwnedHandle {
    fn drop(&mut self) {
        if !self.0.is_null() {
            unsafe {
                // SAFETY: self.0 is a token handle returned by OpenProcessToken.
                CloseHandle(self.0);
            }
        }
    }
}

#[cfg(windows)]
fn is_pipe_component_unit(unit: u16) -> bool {
    matches!(
        unit,
        0x30..=0x39 | 0x41..=0x5A | 0x61..=0x7A | 0x2D | 0x5F | 0x2E
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(unix)]
    use std::ffi::OsStr;

    #[cfg(unix)]
    #[test]
    fn default_endpoint_uses_the_spec_layout() {
        let path = default_endpoint().expect("default endpoint").into_path();
        let path_string = path.to_string_lossy();

        assert!(path_string.ends_with("/default"));
        assert!(path_string.contains("/rmux-"));
    }

    #[cfg(unix)]
    #[test]
    fn unresolved_rmux_tmpdir_falls_back_to_tmp() {
        assert_eq!(
            socket_root_from_parts(Some(OsStr::new(
                "relative-rmux-test-path-that-does-not-exist"
            )))
            .expect("socket root"),
            std::fs::canonicalize("/tmp").expect("canonical /tmp")
        );
    }

    #[cfg(windows)]
    #[test]
    fn default_endpoint_uses_a_user_scoped_named_pipe() {
        let path = default_endpoint()
            .expect("default named-pipe endpoint")
            .into_path();
        let path = path.to_string_lossy();

        assert!(path.starts_with(r"\\.\pipe\rmux-S-"));
        assert!(path.contains("-il-"));
        assert!(path.ends_with("-default"));
    }

    #[cfg(windows)]
    #[test]
    fn windows_integrity_label_is_endpoint_safe() {
        let integrity = current_integrity_label().expect("current integrity label");

        assert!(matches!(
            integrity,
            "untrusted" | "low" | "medium" | "high" | "system"
        ));
    }

    #[cfg(windows)]
    #[test]
    fn pipe_labels_are_injective() {
        assert_ne!(
            pipe_component(OsStr::new("alpha/beta")),
            pipe_component(OsStr::new("alpha:beta"))
        );
        assert_eq!(
            pipe_component(OsStr::new("alpha/beta:gamma")),
            "alpha~002Fbeta~003Agamma"
        );
    }

    #[cfg(windows)]
    #[test]
    fn rmux_env_accepts_windows_named_pipe_endpoint() {
        let path = socket_path_from_rmux_env(Some(OsStr::new(
            r"\\.\pipe\rmux-S-1-5-21-1000-default,123,0",
        )))
        .expect("rmux pipe endpoint");

        assert_eq!(
            path.to_string_lossy(),
            r"\\.\pipe\rmux-S-1-5-21-1000-default"
        );
    }

    #[cfg(windows)]
    #[test]
    fn windows_socket_path_rejects_non_rmux_pipe() {
        let error = endpoint_for_socket_path(Path::new(r"\\.\pipe\external-peer-default"))
            .expect_err("non-rmux pipe should be rejected");

        assert_eq!(error.kind(), io::ErrorKind::InvalidInput);
    }
}
