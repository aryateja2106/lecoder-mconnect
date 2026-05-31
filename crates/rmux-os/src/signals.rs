//! Signal disposition helpers.

use std::io;

/// Resets signal dispositions that RMUX may handle in its daemon process back
/// to their default behavior before executing a pane child.
///
/// This is a no-op on non-Unix platforms.
pub fn reset_child_signal_dispositions() -> io::Result<()> {
    reset_child_signal_dispositions_impl()
}

#[cfg(unix)]
fn reset_child_signal_dispositions_impl() -> io::Result<()> {
    for signal in [
        libc::SIGHUP,
        libc::SIGINT,
        libc::SIGQUIT,
        libc::SIGTERM,
        libc::SIGUSR1,
        libc::SIGUSR2,
    ] {
        reset_signal(signal)?;
    }
    Ok(())
}

#[cfg(unix)]
fn reset_signal(signal: libc::c_int) -> io::Result<()> {
    let mut action = unsafe {
        // SAFETY: `sigaction` is a plain C struct. Zero initialization covers
        // platform-specific fields such as Linux `sa_restorer` before we fill
        // the portable fields below.
        std::mem::zeroed::<libc::sigaction>()
    };
    action.sa_sigaction = libc::SIG_DFL;
    action.sa_flags = 0;
    let empty_mask = unsafe {
        // SAFETY: `action.sa_mask` points to initialized writable storage.
        libc::sigemptyset(&mut action.sa_mask)
    };
    if empty_mask != 0 {
        return Err(io::Error::last_os_error());
    }
    let result = unsafe {
        // SAFETY: `signal` comes from libc signal constants and `action`
        // points to a fully initialized sigaction structure for this call.
        libc::sigaction(signal, &action, std::ptr::null_mut())
    };
    if result == 0 {
        Ok(())
    } else {
        Err(io::Error::last_os_error())
    }
}

#[cfg(not(unix))]
fn reset_child_signal_dispositions_impl() -> io::Result<()> {
    Ok(())
}
