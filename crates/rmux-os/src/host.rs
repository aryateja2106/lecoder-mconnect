//! Host identity helpers.

/// Returns the native local hostname when the platform exposes one.
#[cfg(windows)]
pub fn local_hostname() -> Option<String> {
    windows::local_hostname()
}

/// Returns the native local hostname when the platform exposes one.
#[cfg(unix)]
pub fn local_hostname() -> Option<String> {
    unix::local_hostname()
}

/// Returns the native local hostname when the platform exposes one.
#[cfg(all(not(unix), not(windows)))]
pub fn local_hostname() -> Option<String> {
    None
}

fn sanitize_hostname(value: String) -> Option<String> {
    let trimmed = value.trim().trim_end_matches('\0').trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_owned())
    }
}

#[cfg(unix)]
mod unix {
    pub(super) fn local_hostname() -> Option<String> {
        let mut buffer = [0_u8; 256];
        // SAFETY: `buffer` is valid for `buffer.len()` bytes and is only
        // written by `gethostname` for the duration of the call.
        let result =
            unsafe { libc::gethostname(buffer.as_mut_ptr().cast::<libc::c_char>(), buffer.len()) };
        if result != 0 {
            return None;
        }

        let len = buffer
            .iter()
            .position(|byte| *byte == 0)
            .unwrap_or(buffer.len());
        super::sanitize_hostname(String::from_utf8_lossy(&buffer[..len]).into_owned())
    }
}

#[cfg(windows)]
mod windows {
    use windows_sys::Win32::Foundation::{GetLastError, ERROR_MORE_DATA};
    use windows_sys::Win32::System::SystemInformation::{
        ComputerNameDnsHostname, ComputerNamePhysicalDnsHostname, GetComputerNameExW,
    };

    pub(super) fn local_hostname() -> Option<String> {
        read_computer_name(ComputerNameDnsHostname)
            .or_else(|| read_computer_name(ComputerNamePhysicalDnsHostname))
    }

    fn read_computer_name(format: i32) -> Option<String> {
        let mut required = 0;

        // SAFETY: Passing a null output buffer with a zero length is the
        // documented size-discovery call. The function only writes to
        // `required`.
        let ok = unsafe { GetComputerNameExW(format, std::ptr::null_mut(), &mut required) };
        if ok != 0 {
            return None;
        }

        // SAFETY: `GetLastError` reads the thread-local Win32 error set by the
        // immediately preceding Win32 call.
        if unsafe { GetLastError() } != ERROR_MORE_DATA || required == 0 {
            return None;
        }

        let mut buffer = vec![0u16; required as usize];

        // SAFETY: `buffer` is valid for `required` UTF-16 code units. Windows
        // writes at most that many units and updates `required` with the count
        // excluding the trailing NUL.
        let ok = unsafe { GetComputerNameExW(format, buffer.as_mut_ptr(), &mut required) };
        if ok == 0 || required == 0 {
            return None;
        }

        buffer.truncate(required as usize);
        super::sanitize_hostname(String::from_utf16_lossy(&buffer))
    }
}

#[cfg(test)]
mod tests {
    use super::sanitize_hostname;

    #[test]
    fn sanitize_hostname_trims_whitespace_and_nul() {
        assert_eq!(
            sanitize_hostname(" RMUXHOST\0 ".to_owned()),
            Some("RMUXHOST".to_owned())
        );
    }

    #[test]
    fn sanitize_hostname_rejects_empty_values() {
        assert_eq!(sanitize_hostname(" \0 ".to_owned()), None);
    }
}
