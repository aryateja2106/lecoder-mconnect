use super::*;

#[tokio::test]
async fn parsed_queue_resolves_bare_select_pane_against_the_current_pane() {
    let handler = RequestHandler::new();
    let alpha = session_name("alpha");
    assert!(matches!(
        handler
            .handle(Request::NewSession(NewSessionRequest {
                session_name: alpha.clone(),
                detached: true,
                size: Some(TerminalSize { cols: 80, rows: 24 }),
                environment: None,
            }))
            .await,
        Response::NewSession(_)
    ));
    assert!(matches!(
        handler
            .handle(Request::SplitWindow(SplitWindowRequest {
                target: SplitWindowTarget::Pane(PaneTarget::with_window(alpha.clone(), 0, 0)),
                direction: SplitDirection::Horizontal,
                before: false,
                environment: None,
            }))
            .await,
        Response::SplitWindow(_)
    ));

    let parsed = CommandParser::new()
        .parse("select-pane")
        .expect("command parses");
    handler
        .execute_parsed_commands(
            std::process::id(),
            parsed,
            QueueExecutionContext::without_caller_cwd().with_current_target(Some(Target::Pane(
                PaneTarget::with_window(alpha.clone(), 0, 0),
            ))),
        )
        .await
        .expect("bare select-pane should resolve against the current pane");

    let state = handler.state.lock().await;
    let session = state.sessions.session(&alpha).expect("session exists");
    assert_eq!(
        session
            .window_at(0)
            .expect("window exists")
            .active_pane_index(),
        0,
        "bare select-pane should fall back to the current pane target"
    );
}

#[tokio::test]
async fn parsed_queue_select_pane_title_sets_target_title_without_selecting_it() {
    let handler = RequestHandler::new();
    let alpha = session_name("alpha");
    assert!(matches!(
        handler
            .handle(Request::NewSession(NewSessionRequest {
                session_name: alpha.clone(),
                detached: true,
                size: Some(TerminalSize { cols: 80, rows: 24 }),
                environment: None,
            }))
            .await,
        Response::NewSession(_)
    ));
    assert!(matches!(
        handler
            .handle(Request::SplitWindow(SplitWindowRequest {
                target: SplitWindowTarget::Pane(PaneTarget::with_window(alpha.clone(), 0, 0)),
                direction: SplitDirection::Horizontal,
                before: false,
                environment: None,
            }))
            .await,
        Response::SplitWindow(_)
    ));
    assert!(matches!(
        handler
            .handle(Request::SelectPane(SelectPaneRequest {
                target: PaneTarget::with_window(alpha.clone(), 0, 0),
                title: None,
            }))
            .await,
        Response::SelectPane(_)
    ));

    let parsed = CommandParser::new()
        .parse("select-pane -t alpha:0.1 -T build-logs")
        .expect("command parses");
    handler
        .execute_parsed_commands(
            std::process::id(),
            parsed,
            QueueExecutionContext::without_caller_cwd().with_current_target(Some(Target::Pane(
                PaneTarget::with_window(alpha.clone(), 0, 0),
            ))),
        )
        .await
        .expect("select-pane -T should execute");

    let state = handler.state.lock().await;
    let session = state.sessions.session(&alpha).expect("session exists");
    assert_eq!(
        session
            .window_at(0)
            .expect("window exists")
            .active_pane_index(),
        0,
        "select-pane -T must not select an inactive target"
    );
    let pane_id = session
        .pane_id_in_window(0, 1)
        .expect("pane 1 id should exist");
    let screen_state = state
        .pane_screen_state(&alpha, pane_id)
        .expect("pane 1 screen state should exist");
    assert_eq!(screen_state.title, "build-logs");
}

#[tokio::test]
async fn parsed_queue_resolves_move_window_renumber_target_as_session() {
    let handler = RequestHandler::new();
    let alpha = session_name("alpha");
    assert!(matches!(
        handler
            .handle(Request::NewSession(NewSessionRequest {
                session_name: alpha.clone(),
                detached: true,
                size: Some(TerminalSize { cols: 80, rows: 24 }),
                environment: None,
            }))
            .await,
        Response::NewSession(_)
    ));
    assert!(matches!(
        handler
            .handle(Request::NewWindow(NewWindowRequest {
                target: alpha.clone(),
                name: Some("logs".to_owned()),
                detached: true,
                start_directory: None,
                environment: None,
                command: None,
                target_window_index: None,
                insert_at_target: false,
            }))
            .await,
        Response::NewWindow(_)
    ));
    let parsed = CommandParser::new()
        .parse("move-window -r -t alp")
        .expect("commands parse");

    handler
        .execute_parsed_commands_for_test(std::process::id(), parsed)
        .await
        .expect("queue command succeeds");
}

#[tokio::test]
async fn parsed_queue_uses_current_target_for_move_window_renumber_without_t() {
    let handler = RequestHandler::new();
    let alpha = session_name("alpha");
    assert!(matches!(
        handler
            .handle(Request::NewSession(NewSessionRequest {
                session_name: alpha.clone(),
                detached: true,
                size: Some(TerminalSize { cols: 80, rows: 24 }),
                environment: None,
            }))
            .await,
        Response::NewSession(_)
    ));
    assert!(matches!(
        handler
            .handle(Request::NewWindow(NewWindowRequest {
                target: alpha.clone(),
                name: Some("logs".to_owned()),
                detached: true,
                start_directory: None,
                environment: None,
                command: None,
                target_window_index: None,
                insert_at_target: false,
            }))
            .await,
        Response::NewWindow(_)
    ));
    let parsed = CommandParser::new()
        .parse("move-window -r")
        .expect("commands parse");

    handler
        .execute_parsed_commands(
            std::process::id(),
            parsed,
            QueueExecutionContext::without_caller_cwd()
                .with_current_target(Some(Target::Window(WindowTarget::with_window(alpha, 0)))),
        )
        .await
        .expect("move-window -r should use the current session target");
}

#[tokio::test]
async fn parsed_queue_new_window_accepts_nonexistent_target_window_index() {
    let handler = RequestHandler::new();
    let alpha = session_name("alpha");
    assert!(matches!(
        handler
            .handle(Request::NewSession(NewSessionRequest {
                session_name: alpha.clone(),
                detached: true,
                size: Some(TerminalSize { cols: 80, rows: 24 }),
                environment: None,
            }))
            .await,
        Response::NewSession(_)
    ));
    let parsed = CommandParser::new()
        .parse("new-window -d -t alpha:5 -n five")
        .expect("commands parse");

    handler
        .execute_parsed_commands_for_test(std::process::id(), parsed)
        .await
        .expect("new-window should create the requested window index");

    let state = handler.state.lock().await;
    let session = state.sessions.session(&alpha).expect("session exists");
    assert!(session.window_at(5).is_some());
    assert_eq!(
        session.window_at(5).and_then(|window| window.name()),
        Some("five")
    );
}

#[tokio::test]
async fn parsed_queue_rejects_pane_component_for_window_index_targets() {
    let handler = RequestHandler::new();
    let alpha = session_name("alpha");
    assert!(matches!(
        handler
            .handle(Request::NewSession(NewSessionRequest {
                session_name: alpha,
                detached: true,
                size: Some(TerminalSize { cols: 80, rows: 24 }),
                environment: None,
            }))
            .await,
        Response::NewSession(_)
    ));
    let parsed = CommandParser::new()
        .parse("break-pane -s alpha:0.0 -t alpha:9.0")
        .expect("commands parse");

    let error = handler
        .execute_parsed_commands_for_test(std::process::id(), parsed)
        .await
        .expect_err("pane component is invalid for window-index lookup");

    assert_eq!(
        error,
        rmux_proto::RmuxError::invalid_target("alpha:9.0", "can't specify pane here")
    );
}

#[tokio::test]
async fn parsed_queue_exposes_gated_mouse_target_errors() {
    let handler = RequestHandler::new();
    assert!(matches!(
        handler
            .handle(Request::NewSession(NewSessionRequest {
                session_name: session_name("alpha"),
                detached: true,
                size: Some(TerminalSize { cols: 80, rows: 24 }),
                environment: None,
            }))
            .await,
        Response::NewSession(_)
    ));
    let parsed = CommandParser::new()
        .parse("display-message -p -t '{mouse}' hello")
        .expect("commands parse");

    let error = handler
        .execute_parsed_commands_for_test(std::process::id(), parsed)
        .await
        .expect_err("mouse target is deferred");

    assert!(
        error
            .to_string()
            .contains("target form {mouse} is recognized"),
        "{error}"
    );
}

#[tokio::test]
async fn parsed_queue_resolves_mouse_targets_when_context_carries_mouse_state() {
    let handler = RequestHandler::new();
    let alpha = session_name("alpha");
    assert!(matches!(
        handler
            .handle(Request::NewSession(NewSessionRequest {
                session_name: alpha.clone(),
                detached: true,
                size: Some(TerminalSize { cols: 80, rows: 24 }),
                environment: None,
            }))
            .await,
        Response::NewSession(_)
    ));
    let parsed = CommandParser::new()
        .parse("display-message -p -t '=' '#{session_name}:#{window_index}:#{pane_index}'")
        .expect("commands parse");

    let output = handler
        .execute_parsed_commands(
            std::process::id(),
            parsed,
            QueueExecutionContext::without_caller_cwd()
                .with_current_target(Some(Target::Session(alpha.clone())))
                .with_mouse_target(Some(Target::Window(rmux_proto::WindowTarget::with_window(
                    alpha, 0,
                )))),
        )
        .await
        .expect("mouse target resolves through queued command");

    assert_eq!(output.stdout(), b"alpha:0:0\n");
}
