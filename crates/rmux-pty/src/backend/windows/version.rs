use std::io;
use std::mem::size_of;

use windows_sys::Win32::System::SystemInformation::OSVERSIONINFOEXW;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) struct WindowsVersion {
    pub(super) major: u32,
    pub(super) minor: u32,
    pub(super) build: u32,
}

pub(super) fn current_windows_version() -> io::Result<WindowsVersion> {
    let mut info = OSVERSIONINFOEXW {
        dwOSVersionInfoSize: size_of::<OSVERSIONINFOEXW>() as u32,
        ..OSVERSIONINFOEXW::default()
    };
    let status = unsafe {
        // SAFETY: `info` points to initialized writable storage with the size
        // field required by RtlGetVersion. The call only writes into `info`.
        RtlGetVersion(&mut info)
    };
    if status < 0 {
        return Err(io::Error::from_raw_os_error(status));
    }
    Ok(WindowsVersion {
        major: info.dwMajorVersion,
        minor: info.dwMinorVersion,
        build: info.dwBuildNumber,
    })
}

#[link(name = "ntdll")]
unsafe extern "system" {
    fn RtlGetVersion(version_information: *mut OSVERSIONINFOEXW) -> i32;
}
