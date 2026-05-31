use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use super::RequestHandler;
use crate::control::{ControlModeUpgrade, ControlServerEvent};
use crate::pane_io::AttachControl;
use rmux_core::input::mode;
use rmux_proto::{
    ClockModeRequest, ControlMode, HookLifecycle, HookName, ListPanesRequest, NewSessionRequest,
    OptionName, PaneTarget, Request, Response, ScopeSelector, SessionName, SetHookRequest,
    SetOptionMode, SetOptionRequest, ShowBufferRequest, TerminalSize, WindowTarget,
};
use tokio::sync::{broadcast, mpsc};

fn session_name(value: &str) -> SessionName {
    SessionName::new(value).expect("valid session name")
}

async fn create_session(handler: &RequestHandler, name: &str, size: TerminalSize) -> PaneTarget {
    let session_name = session_name(name);
    let response = handler
        .handle(Request::NewSession(NewSessionRequest {
            session_name: session_name.clone(),
            detached: true,
            size: Some(size),
            environment: None,
        }))
        .await;
    assert!(matches!(response, Response::NewSession(_)));
    PaneTarget::with_window(session_name, 0, 0)
}

async fn dispatch_as(handler: &RequestHandler, requester_pid: u32, request: Request) -> Response {
    let mut lifecycle_events = handler.subscribe_lifecycle_events();
    let outcome = handler.dispatch(requester_pid, request).await;
    drain_lifecycle_hooks(handler, &mut lifecycle_events).await;
    outcome.response
}

async fn drain_lifecycle_hooks(
    handler: &RequestHandler,
    events: &mut broadcast::Receiver<super::QueuedLifecycleEvent>,
) {
    loop {
        match events.try_recv() {
            Ok(event) => handler.dispatch_lifecycle_hook(event).await,
            Err(broadcast::error::TryRecvError::Empty | broadcast::error::TryRecvError::Closed) => {
                break
            }
            Err(broadcast::error::TryRecvError::Lagged(skipped)) => {
                panic!("lifecycle events lagged during test: {skipped}");
            }
        }
    }
}

async fn register_control_client(
    handler: &RequestHandler,
    requester_pid: u32,
    session_name: SessionName,
) -> mpsc::UnboundedReceiver<ControlServerEvent> {
    let (event_tx, event_rx) = mpsc::unbounded_channel();
    let _control_id = handler
        .register_control_with_closing(
            requester_pid,
            ControlModeUpgrade {
                mode: ControlMode::Plain,
                terminal_context: crate::outer_terminal::OuterTerminalContext::default()
                    .with_client_terminal(&rmux_proto::ClientTerminalContext {
                        terminal_features: Vec::new(),
                        utf8: true,
                    }),
            },
            event_tx,
            Arc::new(AtomicBool::new(false)),
        )
        .await;
    handler
        .set_control_session(requester_pid, Some(session_name))
        .await
        .expect("control session set succeeds");
    event_rx
}

fn drain_control_notifications(
    rx: &mut mpsc::UnboundedReceiver<ControlServerEvent>,
) -> Vec<String> {
    let mut lines = Vec::new();
    loop {
        match rx.try_recv() {
            Ok(ControlServerEvent::Notification(line)) => lines.push(line),
            Ok(ControlServerEvent::SessionChanged(_) | ControlServerEvent::Refresh) => {}
            Ok(ControlServerEvent::Exit(reason)) => {
                panic!("unexpected control exit: {reason:?}");
            }
            Err(mpsc::error::TryRecvError::Empty | mpsc::error::TryRecvError::Disconnected) => {
                break;
            }
        }
    }
    lines
}

async fn pane_id(handler: &RequestHandler, target: &PaneTarget) -> u32 {
    let state = handler.state.lock().await;
    state
        .sessions
        .session(target.session_name())
        .and_then(|session| session.window_at(target.window_index()))
        .and_then(|window| window.pane(target.pane_index()))
        .expect("pane exists")
        .id()
        .as_u32()
}

async fn list_panes_text(handler: &RequestHandler, target: &PaneTarget, format: &str) -> String {
    let response = handler
        .handle(Request::ListPanes(ListPanesRequest {
            target: target.session_name().clone(),
            format: Some(format.to_owned()),
            target_window_index: None,
        }))
        .await;
    let output = response
        .command_output()
        .expect("list-panes returns command output");
    String::from_utf8_lossy(output.stdout()).into_owned()
}

async fn next_overlay(
    control_rx: &mut mpsc::UnboundedReceiver<AttachControl>,
) -> crate::pane_io::OverlayFrame {
    loop {
        match control_rx.recv().await {
            Some(AttachControl::Overlay(frame)) if frame.frame.is_empty() => {}
            Some(AttachControl::Overlay(frame)) => return frame,
            Some(AttachControl::AdvancePersistentOverlayState(_)) => {}
            Some(AttachControl::Switch(_)) => {}
            Some(AttachControl::Detach) => panic!("unexpected detach"),
            Some(AttachControl::Exited) => panic!("unexpected exited"),
            Some(AttachControl::DetachKill) => panic!("unexpected detach kill"),
            Some(AttachControl::DetachExecShellCommand(_)) => panic!("unexpected detach exec"),
            Some(AttachControl::Write(_)) => {}
            Some(AttachControl::LockShellCommand(_)) => {}
            Some(AttachControl::Suspend) => panic!("unexpected suspend"),
            None => panic!("attach control closed"),
        }
    }
}

async fn next_transient_overlay(
    control_rx: &mut mpsc::UnboundedReceiver<AttachControl>,
) -> crate::pane_io::OverlayFrame {
    loop {
        let frame = next_overlay(control_rx).await;
        if !frame.persistent {
            return frame;
        }
    }
}

#[tokio::test]
async fn clock_mode_overlay_uses_window_options_for_fallback_rendering() {
    let handler = RequestHandler::new();
    let target = create_session(&handler, "alpha", TerminalSize { cols: 11, rows: 5 }).await;
    let session = target.session_name().clone();
    let requester_pid = std::process::id();
    let (control_tx, mut control_rx) = mpsc::unbounded_channel();
    let _attach_id = handler
        .register_attach(requester_pid, session.clone(), control_tx)
        .await;

    assert!(matches!(
        handler
            .handle(Request::SetOption(SetOptionRequest {
                scope: ScopeSelector::Window(WindowTarget::new(session.clone())),
                option: OptionName::ClockModeColour,
                value: "red".to_owned(),
                mode: SetOptionMode::Replace,
            }))
            .await,
        Response::SetOption(_)
    ));
    assert!(matches!(
        handler
            .handle(Request::SetOption(SetOptionRequest {
                scope: ScopeSelector::Window(WindowTarget::new(session.clone())),
                option: OptionName::ClockModeStyle,
                value: "12".to_owned(),
                mode: SetOptionMode::Replace,
            }))
            .await,
        Response::SetOption(_)
    ));

    let response = handler
        .handle(Request::ClockMode(ClockModeRequest {
            target: Some(target.clone()),
        }))
        .await;
    assert_eq!(
        response,
        Response::ClockMode(rmux_proto::ClockModeResponse {
            target: target.clone(),
            active: true,
        })
    );

    let overlay = next_overlay(&mut control_rx).await;
    let frame = String::from_utf8(overlay.frame).expect("overlay is utf-8");
    assert!(overlay.persistent);
    assert!(frame.contains("\u{1b}[?25l"));
    assert!(frame.contains("\u{1b}[31m"));
    assert!(frame.contains("AM") || frame.contains("PM"));
}

#[tokio::test]
async fn clock_mode_updates_pane_formats_and_exits_on_any_keypress() {
    let handler = RequestHandler::new();
    let target = create_session(&handler, "alpha", TerminalSize { cols: 32, rows: 8 }).await;
    let requester_pid = std::process::id();
    let (control_tx, mut control_rx) = mpsc::unbounded_channel();
    let _attach_id = handler
        .register_attach(requester_pid, target.session_name().clone(), control_tx)
        .await;

    assert!(matches!(
        handler
            .handle(Request::ClockMode(ClockModeRequest {
                target: Some(target.clone()),
            }))
            .await,
        Response::ClockMode(_)
    ));
    let _ = next_overlay(&mut control_rx).await;

    assert_eq!(
        list_panes_text(&handler, &target, "#{pane_in_mode} #{pane_mode}").await,
        "1 clock-mode\n"
    );

    handler
        .handle_attached_live_input_for_test(requester_pid, b"x")
        .await
        .expect("attached input succeeds");

    assert_eq!(
        list_panes_text(&handler, &target, "#{pane_in_mode} #{pane_mode}").await,
        "0 \n"
    );
}

#[tokio::test]
async fn clock_mode_exit_restores_underlying_hidden_cursor_state() {
    let handler = RequestHandler::new();
    let target = create_session(&handler, "alpha", TerminalSize { cols: 32, rows: 8 }).await;
    let requester_pid = std::process::id();
    let (control_tx, mut control_rx) = mpsc::unbounded_channel();
    let _attach_id = handler
        .register_attach(requester_pid, target.session_name().clone(), control_tx)
        .await;

    {
        let state = handler.state.lock().await;
        let transcript = state
            .transcript_handle(&target)
            .expect("pane transcript exists");
        let mut transcript = transcript
            .lock()
            .expect("pane transcript mutex must not be poisoned");
        transcript.append_bytes(b"\x1b[?25l");
    }
    {
        let state = handler.state.lock().await;
        let pane_id = state
            .sessions
            .session(target.session_name())
            .and_then(|session| session.window_at(target.window_index()))
            .and_then(|window| window.pane(target.pane_index()))
            .expect("pane exists")
            .id();
        let screen = state
            .pane_screen_state(target.session_name(), pane_id)
            .expect("pane screen state exists");
        assert_eq!(screen.mode & mode::MODE_CURSOR, 0);
    }

    assert!(matches!(
        handler
            .handle(Request::ClockMode(ClockModeRequest {
                target: Some(target.clone()),
            }))
            .await,
        Response::ClockMode(_)
    ));
    let _ = next_overlay(&mut control_rx).await;

    handler
        .handle_attached_live_input_for_test(requester_pid, b"x")
        .await
        .expect("attached input succeeds");

    let restore = next_transient_overlay(&mut control_rx).await;
    let frame = String::from_utf8(restore.frame).expect("restore frame is utf-8");
    assert!(frame.contains("\u{1b}[?25l"));
    assert!(!frame.contains("\u{1b}[?25h"));
}

#[tokio::test]
async fn clock_mode_exit_restores_visible_line_content() {
    let handler = RequestHandler::new();
    let target = create_session(&handler, "alpha", TerminalSize { cols: 16, rows: 3 }).await;
    let requester_pid = std::process::id();
    let (control_tx, mut control_rx) = mpsc::unbounded_channel();
    let _attach_id = handler
        .register_attach(requester_pid, target.session_name().clone(), control_tx)
        .await;

    {
        let state = handler.state.lock().await;
        let transcript = state
            .transcript_handle(&target)
            .expect("pane transcript exists");
        let mut transcript = transcript
            .lock()
            .expect("pane transcript mutex must not be poisoned");
        transcript.append_bytes(b"\x1b[31mred\r\nmore");
    }

    assert!(matches!(
        handler
            .handle(Request::ClockMode(ClockModeRequest {
                target: Some(target.clone()),
            }))
            .await,
        Response::ClockMode(_)
    ));
    let _ = next_overlay(&mut control_rx).await;

    handler
        .handle_attached_live_input_for_test(requester_pid, b"q")
        .await
        .expect("attached input succeeds");

    let restore = next_transient_overlay(&mut control_rx).await;
    let frame = String::from_utf8(restore.frame).expect("restore frame is utf-8");
    assert!(frame.contains("red"));
    assert!(frame.contains("more"));
}

#[tokio::test]
async fn clock_mode_fires_hooks_and_control_notifications_on_entry_and_exit() {
    let handler = RequestHandler::new();
    let target = create_session(&handler, "alpha", TerminalSize { cols: 24, rows: 7 }).await;
    let requester_pid = std::process::id();
    let (control_tx, _control_rx) = mpsc::unbounded_channel();
    let _attach_id = handler
        .register_attach(requester_pid, target.session_name().clone(), control_tx)
        .await;
    let mut notifications =
        register_control_client(&handler, 700, target.session_name().clone()).await;
    let _ = drain_control_notifications(&mut notifications);

    assert!(matches!(
        handler
            .handle(Request::SetHook(SetHookRequest {
                scope: ScopeSelector::Pane(target.clone()),
                hook: HookName::PaneModeChanged,
                command: "set-buffer -b pane-mode-hook ok".to_owned(),
                lifecycle: HookLifecycle::Persistent,
            }))
            .await,
        Response::SetHook(_)
    ));

    let response = dispatch_as(
        &handler,
        requester_pid,
        Request::ClockMode(ClockModeRequest {
            target: Some(target.clone()),
        }),
    )
    .await;
    assert!(matches!(response, Response::ClockMode(_)));

    let pane_id = pane_id(&handler, &target).await;
    assert_eq!(
        drain_control_notifications(&mut notifications),
        vec![format!("%pane-mode-changed %{pane_id}")]
    );

    let shown = handler
        .handle(Request::ShowBuffer(ShowBufferRequest {
            name: Some("pane-mode-hook".to_owned()),
        }))
        .await;
    let Response::ShowBuffer(buffer) = shown else {
        panic!("expected show-buffer response");
    };
    assert_eq!(buffer.command_output().stdout(), b"ok");

    let mut lifecycle_events = handler.subscribe_lifecycle_events();
    handler
        .handle_attached_live_input_for_test(requester_pid, b"q")
        .await
        .expect("attached input succeeds");
    drain_lifecycle_hooks(&handler, &mut lifecycle_events).await;

    assert_eq!(
        drain_control_notifications(&mut notifications),
        vec![format!("%pane-mode-changed %{pane_id}")]
    );
}
