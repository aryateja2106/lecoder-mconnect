//! Raw terminal lifecycle and attach-stream helpers for attach-mode clients.

use std::io::{self, Read, Write};
use std::net::Shutdown;
use std::os::fd::AsFd;
use std::os::unix::net::UnixStream;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc};
use std::thread;
use std::time::Duration;

use rmux_proto::{
    encode_attach_message, AttachFrameDecoder, AttachMessage, AttachedKeystroke, RmuxError,
    TerminalGeometry, TerminalSize,
};
use rustix::event::{poll, PollFd, PollFlags, Timespec};
use rustix::process::{kill_process, Signal};

use crate::ClientError;

#[path = "attach/resize.rs"]
mod resize;
#[path = "attach/screen.rs"]
mod screen;
#[path = "attach/terminal.rs"]
mod terminal;
#[path = "attach/terminal_cleanup.rs"]
mod terminal_cleanup;

#[cfg(test)]
use resize::terminal_size_from_fd;
use resize::{terminal_geometry_from_fd, ResizeWatcher, SignalMaskGuard};
use screen::{
    contains_subslice, AttachScreenTracker, AttachStopDetector, ALT_SCREEN_EXIT_FALLBACK,
    DETACHED_BANNER_PREFIX, EXITED_BANNER,
};
use terminal::current_process_pid;
pub use terminal::{AttachError, RawTerminal, Result};

#[cfg(test)]
use terminal_cleanup::fallback_attach_stop_sequence;

const READ_BUFFER_SIZE: usize = 8192;
const POLL_TIMEOUT: Timespec = Timespec {
    tv_sec: 0,
    tv_nsec: 100_000_000,
};

/// Runs the attach loop using the process stdin/stdout streams.
pub fn attach_terminal(stream: UnixStream) -> std::result::Result<(), ClientError> {
    attach_terminal_with_initial_bytes(stream, Vec::new())
}

/// Runs the attach loop using process stdin/stdout and pre-read stream bytes.
pub fn attach_terminal_with_initial_bytes(
    stream: UnixStream,
    initial_bytes: Vec<u8>,
) -> std::result::Result<(), ClientError> {
    attach_terminal_with_initial_bytes_and_geometry_flag(stream, initial_bytes, false)
}

/// Runs the attach loop and sends resize events with pixel geometry.
///
/// Call this only after the daemon advertises the
/// `stream.attach.resize_geometry` capability. Older daemons do not understand
/// that attach-stream frame and would close the stream on decode.
pub fn attach_terminal_with_initial_bytes_and_resize_geometry(
    stream: UnixStream,
    initial_bytes: Vec<u8>,
) -> std::result::Result<(), ClientError> {
    attach_terminal_with_initial_bytes_and_geometry_flag(stream, initial_bytes, true)
}

fn attach_terminal_with_initial_bytes_and_geometry_flag(
    stream: UnixStream,
    initial_bytes: Vec<u8>,
    resize_geometry_enabled: bool,
) -> std::result::Result<(), ClientError> {
    let terminal = io::stdin();
    let input = io::stdin();
    let output = io::stdout();

    attach_with_terminal_with_initial_bytes(
        stream,
        initial_bytes,
        &terminal,
        input,
        output,
        resize_geometry_enabled,
    )
}

/// Runs the attach loop with an explicit terminal file descriptor.
///
/// The `terminal` handle is used for raw-mode lifecycle and resize discovery,
/// while `input` and `output` carry the byte stream.
pub fn attach_with_terminal<Terminal, Input, Output>(
    stream: UnixStream,
    terminal: &Terminal,
    input: Input,
    output: Output,
) -> std::result::Result<(), ClientError>
where
    Terminal: AsFd,
    Input: Read + AsFd + Send + 'static,
    Output: Write + Send + 'static,
{
    attach_with_terminal_with_initial_bytes(stream, Vec::new(), terminal, input, output, false)
}

fn attach_with_terminal_with_initial_bytes<Terminal, Input, Output>(
    stream: UnixStream,
    initial_bytes: Vec<u8>,
    terminal: &Terminal,
    input: Input,
    output: Output,
    resize_geometry_enabled: bool,
) -> std::result::Result<(), ClientError>
where
    Terminal: AsFd,
    Input: Read + AsFd + Send + 'static,
    Output: Write + Send + 'static,
{
    let raw_terminal = RawTerminal::from_fd(terminal).map_err(ClientError::from)?;
    let _ = raw_terminal.flush_pending_input();
    let screen_tracker = AttachScreenTracker::default();
    let attach_state = AttachTerminalState {
        stream,
        initial_bytes,
        terminal,
        raw_terminal: &raw_terminal,
        screen_tracker: &screen_tracker,
        resize_geometry_enabled,
    };
    let result = drive_attach_with_terminal_state(attach_state, input, output);
    if result.is_err() && !screen_tracker.was_stopped() {
        let _ = raw_terminal.restore_attach_terminal_state();
    }
    let _ = raw_terminal.flush_pending_input();
    drop(raw_terminal);
    result
}

struct AttachTerminalState<'a, Terminal> {
    stream: UnixStream,
    initial_bytes: Vec<u8>,
    terminal: &'a Terminal,
    raw_terminal: &'a RawTerminal,
    screen_tracker: &'a AttachScreenTracker,
    resize_geometry_enabled: bool,
}

struct AttachStreamState<'a> {
    stream: UnixStream,
    initial_bytes: Vec<u8>,
    raw_terminal: Option<&'a RawTerminal>,
    screen_tracker: AttachScreenTracker,
    resize_events: mpsc::Receiver<TerminalGeometry>,
    resize_geometry_enabled: bool,
}

fn drive_attach_with_terminal_state<Terminal, Input, Output>(
    state: AttachTerminalState<'_, Terminal>,
    input: Input,
    output: Output,
) -> std::result::Result<(), ClientError>
where
    Terminal: AsFd,
    Input: Read + AsFd + Send + 'static,
    Output: Write + Send + 'static,
{
    // This helper runs while the caller's `RawTerminal` guard is still alive,
    // which keeps termios restoration as the last drop on every return path.
    let _signal_mask = SignalMaskGuard::block_winch().map_err(ClientError::from)?;
    let (resize_tx, resize_rx) = mpsc::channel();
    let initial_geometry = terminal_geometry_from_fd(state.terminal).map_err(ClientError::from)?;
    let terminal_fd = state
        .terminal
        .as_fd()
        .try_clone_to_owned()
        .map_err(AttachError::from)?;

    if let Some(initial_geometry) = initial_geometry {
        resize_tx.send(initial_geometry).map_err(|_| {
            ClientError::Io(io::Error::other(
                "resize channel closed before attach start",
            ))
        })?;
    }

    let resize_watcher = ResizeWatcher::spawn(terminal_fd, resize_tx)?;
    let stream_state = AttachStreamState {
        stream: state.stream,
        initial_bytes: state.initial_bytes,
        raw_terminal: Some(state.raw_terminal),
        screen_tracker: state.screen_tracker.clone(),
        resize_events: resize_rx,
        resize_geometry_enabled: state.resize_geometry_enabled,
    };
    let attach_result = drive_attach_stream_inner(stream_state, input, output);
    drop(resize_watcher);
    attach_result
}

/// Drives raw attach-stream byte forwarding over an upgraded Unix socket.
pub fn drive_attach_stream<Input, Output>(
    stream: UnixStream,
    input: Input,
    output: Output,
    resize_events: mpsc::Receiver<TerminalSize>,
) -> std::result::Result<(), ClientError>
where
    Input: Read + AsFd + Send + 'static,
    Output: Write + Send + 'static,
{
    let resize_events = geometry_resize_events_from_size_events(resize_events);
    let stream_state = AttachStreamState {
        stream,
        initial_bytes: Vec::new(),
        raw_terminal: None,
        screen_tracker: AttachScreenTracker::default(),
        resize_events,
        resize_geometry_enabled: false,
    };
    drive_attach_stream_inner(stream_state, input, output)
}

fn drive_attach_stream_inner<Input, Output>(
    state: AttachStreamState<'_>,
    input: Input,
    output: Output,
) -> std::result::Result<(), ClientError>
where
    Input: Read + AsFd + Send + 'static,
    Output: Write + Send + 'static,
{
    let control = state.stream.try_clone().map_err(ClientError::Io)?;
    let mut lock_stream = state.stream.try_clone().map_err(ClientError::Io)?;
    let input_stream = state.stream.try_clone().map_err(ClientError::Io)?;
    let closed = Arc::new(AtomicBool::new(false));
    let input_closed = Arc::clone(&closed);
    let output_closed = Arc::clone(&closed);
    let locked = Arc::new(AtomicBool::new(false));
    let input_locked = Arc::clone(&locked);
    let output_locked = Arc::clone(&locked);
    let (action_tx, action_rx) = mpsc::channel();

    let input_thread = thread::spawn(move || {
        input_loop(
            input_stream,
            input,
            state.resize_events,
            state.resize_geometry_enabled,
            input_closed,
            input_locked,
        )
    });
    let output_screen_tracker = state.screen_tracker.clone();
    let output_thread = thread::spawn(move || {
        output_loop(
            state.stream,
            state.initial_bytes,
            output,
            output_closed,
            output_locked,
            output_screen_tracker,
            action_tx,
        )
    });

    let output_result = wait_for_output_thread(
        output_thread,
        state.raw_terminal,
        &mut lock_stream,
        &locked,
        action_rx,
    )?;
    closed.store(true, Ordering::SeqCst);
    let _ = control.shutdown(Shutdown::Both);
    let input_result = join_attach_thread(input_thread)?;

    output_result?;
    input_result
}

fn geometry_resize_events_from_size_events(
    resize_events: mpsc::Receiver<TerminalSize>,
) -> mpsc::Receiver<TerminalGeometry> {
    let (geometry_tx, geometry_rx) = mpsc::channel();
    let _forwarder = thread::spawn(move || {
        while let Ok(size) = resize_events.recv() {
            if geometry_tx.send(TerminalGeometry::from_size(size)).is_err() {
                break;
            }
        }
    });
    geometry_rx
}

fn input_loop<Input>(
    mut stream: UnixStream,
    mut input: Input,
    resize_events: mpsc::Receiver<TerminalGeometry>,
    resize_geometry_enabled: bool,
    closed: Arc<AtomicBool>,
    locked: Arc<AtomicBool>,
) -> std::result::Result<(), ClientError>
where
    Input: Read + AsFd,
{
    let mut read_buffer = [0_u8; READ_BUFFER_SIZE];

    loop {
        if closed.load(Ordering::SeqCst) {
            return Ok(());
        }

        drain_resize_events(&mut stream, &resize_events, resize_geometry_enabled)?;
        if locked.load(Ordering::SeqCst) {
            thread::sleep(Duration::from_millis(20));
            continue;
        }

        let mut fds = [PollFd::new(
            &input,
            PollFlags::IN | PollFlags::ERR | PollFlags::HUP,
        )];
        match poll(&mut fds, Some(&POLL_TIMEOUT)) {
            Ok(0) => continue,
            Ok(_) => {}
            Err(rustix::io::Errno::INTR) => continue,
            Err(error) => return Err(ClientError::Io(error.into())),
        }

        let ready = fds[0].revents();
        if ready.is_empty() {
            continue;
        }
        if closed.load(Ordering::SeqCst) {
            return Ok(());
        }
        if !ready.contains(PollFlags::IN) {
            if ready.contains(PollFlags::HUP) || ready.contains(PollFlags::ERR) {
                shutdown_attach_writes(&stream)?;
                return Ok(());
            }
            continue;
        }

        let bytes_read = match input.read(&mut read_buffer) {
            Ok(0) => {
                shutdown_attach_writes(&stream)?;
                return Ok(());
            }
            Ok(bytes_read) => bytes_read,
            Err(error) if error.kind() == io::ErrorKind::Interrupted => continue,
            Err(error) => return Err(ClientError::Io(error)),
        };

        write_attach_message(
            &mut stream,
            AttachMessage::Keystroke(AttachedKeystroke::new(read_buffer[..bytes_read].to_vec())),
        )?;
    }
}

fn output_loop<Output>(
    mut stream: UnixStream,
    initial_bytes: Vec<u8>,
    mut output: Output,
    closed: Arc<AtomicBool>,
    locked: Arc<AtomicBool>,
    screen_tracker: AttachScreenTracker,
    action_tx: mpsc::Sender<ClientAttachAction>,
) -> std::result::Result<(), ClientError>
where
    Output: Write,
{
    let mut decoder = AttachFrameDecoder::new();
    decoder.push_bytes(&initial_bytes);
    let mut read_buffer = [0_u8; READ_BUFFER_SIZE];
    let mut stop_detector = AttachStopDetector::new(screen_tracker.clone());

    loop {
        while let Some(message) = decoder.next_message().map_err(ClientError::from)? {
            match message {
                AttachMessage::Data(bytes) => {
                    if contains_subslice(&bytes, ALT_SCREEN_EXIT_FALLBACK)
                        || contains_subslice(&bytes, DETACHED_BANNER_PREFIX)
                        || contains_subslice(&bytes, EXITED_BANNER)
                    {
                        screen_tracker.mark_stopped();
                    }
                    stop_detector.observe(&bytes);
                    if locked.load(Ordering::SeqCst) {
                        continue;
                    }
                    output.write_all(&bytes).map_err(ClientError::Io)?;
                    output.flush().map_err(ClientError::Io)?;
                }
                AttachMessage::KeyDispatched(_) => {}
                AttachMessage::Resize(_) | AttachMessage::ResizeGeometry(_) => {
                    return Err(ClientError::Protocol(RmuxError::Decode(
                        "received unexpected resize message from attach stream".to_owned(),
                    )));
                }
                AttachMessage::Lock(command) => {
                    locked.store(true, Ordering::SeqCst);
                    action_tx
                        .send(ClientAttachAction::Lock(command))
                        .map_err(|_| {
                            ClientError::Io(io::Error::other("lock request receiver closed"))
                        })?;
                }
                AttachMessage::LockShellCommand(command) => {
                    locked.store(true, Ordering::SeqCst);
                    action_tx
                        .send(ClientAttachAction::Lock(command.command().to_owned()))
                        .map_err(|_| {
                            ClientError::Io(io::Error::other("lock request receiver closed"))
                        })?;
                }
                AttachMessage::Suspend => {
                    locked.store(true, Ordering::SeqCst);
                    action_tx.send(ClientAttachAction::Suspend).map_err(|_| {
                        ClientError::Io(io::Error::other("suspend request receiver closed"))
                    })?;
                }
                AttachMessage::DetachKill => {
                    closed.store(true, Ordering::SeqCst);
                    action_tx
                        .send(ClientAttachAction::DetachKill)
                        .map_err(|_| {
                            ClientError::Io(io::Error::other("detach request receiver closed"))
                        })?;
                    return Ok(());
                }
                AttachMessage::DetachExec(command) => {
                    closed.store(true, Ordering::SeqCst);
                    action_tx
                        .send(ClientAttachAction::DetachExec(command))
                        .map_err(|_| {
                            ClientError::Io(io::Error::other("detach request receiver closed"))
                        })?;
                    return Ok(());
                }
                AttachMessage::DetachExecShellCommand(command) => {
                    closed.store(true, Ordering::SeqCst);
                    action_tx
                        .send(ClientAttachAction::DetachExec(command.command().to_owned()))
                        .map_err(|_| {
                            ClientError::Io(io::Error::other("detach request receiver closed"))
                        })?;
                    return Ok(());
                }
                AttachMessage::Unlock => {
                    return Err(ClientError::Protocol(RmuxError::Decode(
                        "received unexpected unlock message from attach stream".to_owned(),
                    )));
                }
                AttachMessage::Keystroke(_) => {
                    return Err(ClientError::Protocol(RmuxError::Decode(
                        "received unexpected keystroke message from attach stream".to_owned(),
                    )));
                }
            }
        }

        let bytes_read = match stream.read(&mut read_buffer) {
            Ok(0) => {
                closed.store(true, Ordering::SeqCst);
                if screen_tracker.was_stopped() {
                    return Ok(());
                }
                return Err(ClientError::Io(io::Error::new(
                    io::ErrorKind::UnexpectedEof,
                    "attach stream closed before attach-stop sequence",
                )));
            }
            Ok(bytes_read) => bytes_read,
            Err(error) if error.kind() == io::ErrorKind::Interrupted => continue,
            Err(error)
                if screen_tracker.was_stopped()
                    && matches!(
                        error.kind(),
                        io::ErrorKind::ConnectionReset | io::ErrorKind::BrokenPipe
                    ) =>
            {
                return Ok(());
            }
            Err(error) => return Err(ClientError::Io(error)),
        };

        decoder.push_bytes(&read_buffer[..bytes_read]);
    }
}

fn wait_for_output_thread(
    output_thread: thread::JoinHandle<std::result::Result<(), ClientError>>,
    raw_terminal: Option<&RawTerminal>,
    lock_stream: &mut UnixStream,
    locked: &Arc<AtomicBool>,
    action_rx: mpsc::Receiver<ClientAttachAction>,
) -> std::result::Result<std::result::Result<(), ClientError>, ClientError> {
    loop {
        match action_rx.recv_timeout(Duration::from_millis(20)) {
            Ok(action) => handle_attach_action(raw_terminal, lock_stream, locked, action)?,
            Err(mpsc::RecvTimeoutError::Timeout) if output_thread.is_finished() => break,
            Err(mpsc::RecvTimeoutError::Timeout) => {}
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }

    while let Ok(action) = action_rx.try_recv() {
        handle_attach_action(raw_terminal, lock_stream, locked, action)?;
    }

    join_attach_thread(output_thread)
}

fn handle_attach_action(
    raw_terminal: Option<&RawTerminal>,
    lock_stream: &mut UnixStream,
    locked: &Arc<AtomicBool>,
    action: ClientAttachAction,
) -> std::result::Result<(), ClientError> {
    match action {
        ClientAttachAction::Lock(command) => {
            let Some(raw_terminal) = raw_terminal else {
                locked.store(false, Ordering::SeqCst);
                return Err(ClientError::Protocol(RmuxError::Decode(
                    "received unexpected lock request without a managed terminal".to_owned(),
                )));
            };
            raw_terminal
                .run_lock_command(&command)
                .map_err(ClientError::from)?;
            write_attach_message(lock_stream, AttachMessage::Unlock)?;
            locked.store(false, Ordering::SeqCst);
            Ok(())
        }
        ClientAttachAction::Suspend => {
            let Some(raw_terminal) = raw_terminal else {
                locked.store(false, Ordering::SeqCst);
                return Err(ClientError::Protocol(RmuxError::Decode(
                    "received unexpected suspend request without a managed terminal".to_owned(),
                )));
            };
            raw_terminal.suspend_self().map_err(ClientError::from)?;
            write_attach_message(lock_stream, AttachMessage::Unlock)?;
            locked.store(false, Ordering::SeqCst);
            Ok(())
        }
        ClientAttachAction::DetachKill => {
            if let Some(raw_terminal) = raw_terminal {
                raw_terminal.restore().map_err(ClientError::from)?;
            }
            kill_process(current_process_pid().map_err(ClientError::Io)?, Signal::HUP)
                .map_err(|error| ClientError::Io(error.into()))?;
            Ok(())
        }
        ClientAttachAction::DetachExec(command) => {
            let Some(raw_terminal) = raw_terminal else {
                return Err(ClientError::Protocol(RmuxError::Decode(
                    "received unexpected detach exec request without a managed terminal".to_owned(),
                )));
            };
            raw_terminal
                .run_detach_exec_command(&command)
                .map_err(ClientError::from)
        }
    }
}

fn drain_resize_events(
    stream: &mut UnixStream,
    resize_events: &mpsc::Receiver<TerminalGeometry>,
    resize_geometry_enabled: bool,
) -> std::result::Result<(), ClientError> {
    while let Ok(geometry) = resize_events.try_recv() {
        let message = if resize_geometry_enabled && geometry.pixels.is_some() {
            AttachMessage::ResizeGeometry(geometry)
        } else {
            AttachMessage::Resize(geometry.size)
        };
        write_attach_message(stream, message)?;
    }

    Ok(())
}

fn write_attach_message(
    stream: &mut UnixStream,
    message: AttachMessage,
) -> std::result::Result<(), ClientError> {
    let frame = encode_attach_message(&message).map_err(ClientError::from)?;
    stream.write_all(&frame).map_err(ClientError::Io)
}

fn join_attach_thread(
    thread: thread::JoinHandle<std::result::Result<(), ClientError>>,
) -> std::result::Result<std::result::Result<(), ClientError>, ClientError> {
    thread
        .join()
        .map_err(|_| ClientError::Io(io::Error::other("attach thread panicked")))
}

fn shutdown_attach_writes(stream: &UnixStream) -> std::result::Result<(), ClientError> {
    match stream.shutdown(Shutdown::Write) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotConnected => Ok(()),
        Err(error) => Err(ClientError::Io(error)),
    }
}

#[derive(Debug)]
enum ClientAttachAction {
    Lock(String),
    Suspend,
    DetachKill,
    DetachExec(String),
}

#[cfg(test)]
mod tests;
