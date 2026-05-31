use std::io;
use std::os::fd::{AsRawFd, BorrowedFd};
use std::time::{Duration, Instant};

const PTY_WRITE_READY_TIMEOUT: Duration = Duration::from_secs(2);

pub(crate) fn read(fd: BorrowedFd<'_>, buffer: &mut [u8]) -> io::Result<usize> {
    rustix::io::read(fd, buffer).map_err(io::Error::from)
}

pub(crate) fn write_all(fd: BorrowedFd<'_>, mut buffer: &[u8]) -> io::Result<()> {
    while !buffer.is_empty() {
        match rustix::io::write(fd, buffer) {
            Ok(0) => return Err(io::Error::new(io::ErrorKind::WriteZero, "write returned 0")),
            Ok(bytes_written) => buffer = &buffer[bytes_written..],
            Err(rustix::io::Errno::INTR) => continue,
            Err(rustix::io::Errno::AGAIN) => wait_until_writable(fd)?,
            Err(error) => return Err(error.into()),
        }
    }

    Ok(())
}

fn wait_until_writable(fd: BorrowedFd<'_>) -> io::Result<()> {
    let deadline = Instant::now() + PTY_WRITE_READY_TIMEOUT;
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            return Err(write_ready_timeout());
        }
        let mut poll_fd = libc::pollfd {
            fd: fd.as_raw_fd(),
            events: libc::POLLOUT,
            revents: 0,
        };
        // SAFETY: `poll_fd` points to one initialized pollfd entry and the
        // borrowed fd stays valid for the duration of this blocking call.
        let ready = unsafe { libc::poll(&mut poll_fd, 1, poll_timeout_ms(remaining)) };
        if ready > 0 {
            if poll_fd.revents & libc::POLLOUT != 0 {
                return Ok(());
            }
            if poll_fd.revents & (libc::POLLERR | libc::POLLHUP | libc::POLLNVAL) != 0 {
                return Err(io::Error::new(
                    io::ErrorKind::BrokenPipe,
                    "pty is no longer writable",
                ));
            }
            continue;
        }
        if ready == 0 {
            return Err(write_ready_timeout());
        }

        let error = io::Error::last_os_error();
        if error.kind() == io::ErrorKind::Interrupted {
            continue;
        }
        return Err(error);
    }
}

fn poll_timeout_ms(remaining: Duration) -> libc::c_int {
    let millis = remaining.as_millis().max(1);
    i32::try_from(millis).unwrap_or(i32::MAX)
}

fn write_ready_timeout() -> io::Error {
    io::Error::new(
        io::ErrorKind::TimedOut,
        format!(
            "pty did not become writable within {} ms",
            PTY_WRITE_READY_TIMEOUT.as_millis()
        ),
    )
}
