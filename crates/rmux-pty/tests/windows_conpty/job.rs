use std::env;
use std::io;
use std::mem::size_of;
use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};
use std::process::Command;
use std::ptr::null;

use windows_sys::Win32::Foundation::HANDLE;
use windows_sys::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
    SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_BREAKAWAY_OK,
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
};
use windows_sys::Win32::System::Threading::GetCurrentProcess;

pub(super) const HELPER_ENV: &str = "RMUX_PTY_WINDOWS_PARENT_JOB";
pub(super) const HELPER_TEST: &str = "conpty_spawn_inside_parent_job_helper";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) enum ParentJobMode {
    NoBreakaway,
    BreakawayAllowed,
}

impl ParentJobMode {
    fn as_env_value(self) -> &'static str {
        match self {
            Self::NoBreakaway => "no-breakaway",
            Self::BreakawayAllowed => "breakaway-allowed",
        }
    }

    fn from_env_value(value: &str) -> Option<Self> {
        match value {
            "no-breakaway" => Some(Self::NoBreakaway),
            "breakaway-allowed" => Some(Self::BreakawayAllowed),
            _ => None,
        }
    }
}

pub(super) fn requested_helper_mode() -> Option<ParentJobMode> {
    env::var(HELPER_ENV)
        .ok()
        .and_then(|value| ParentJobMode::from_env_value(&value))
}

pub(super) fn run_parent_job_helper(mode: ParentJobMode) -> Result<(), Box<dyn std::error::Error>> {
    let output = Command::new(env::current_exe()?)
        .arg("--exact")
        .arg(HELPER_TEST)
        .arg("--nocapture")
        .env(HELPER_ENV, mode.as_env_value())
        .output()?;

    if output.status.success() {
        return Ok(());
    }

    Err(format!(
        "{HELPER_TEST} failed for mode {mode:?}\nstatus: {}\nstdout:\n{}\nstderr:\n{}",
        output.status,
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    )
    .into())
}

pub(super) fn assign_current_process_to_job(mode: ParentJobMode) -> io::Result<OwnedHandle> {
    let handle = unsafe { CreateJobObjectW(null(), null()) };
    if handle.is_null() {
        return Err(io::Error::last_os_error());
    }
    let job = unsafe { OwnedHandle::from_raw_handle(handle as _) };

    let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
    limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    if mode == ParentJobMode::BreakawayAllowed {
        limits.BasicLimitInformation.LimitFlags |= JOB_OBJECT_LIMIT_BREAKAWAY_OK;
    }

    let ok = unsafe {
        SetInformationJobObject(
            job.as_raw_handle() as HANDLE,
            JobObjectExtendedLimitInformation,
            &limits as *const _ as *const _,
            size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        )
    };
    if ok == 0 {
        return Err(io::Error::last_os_error());
    }

    let ok =
        unsafe { AssignProcessToJobObject(job.as_raw_handle() as HANDLE, GetCurrentProcess()) };
    if ok == 0 {
        return Err(io::Error::last_os_error());
    }

    Ok(job)
}
