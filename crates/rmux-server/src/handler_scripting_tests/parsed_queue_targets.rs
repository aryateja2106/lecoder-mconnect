use super::*;

#[tokio::test]
async fn parsed_queue_uses_current_target_for_rename_window_session_and_last_window() {
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
                name: Some("w1".to_owned()),
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
    assert!(matches!(
        handler
            .handle(Request::SelectWindow(rmux_proto::SelectWindowRequest {
                target: rmux_proto::WindowTarget::with_window(alpha.clone(), 1),
            }))
            .await,
        Response::SelectWindow(_)
    ));

    for command in [
        "rename-window renamed",
        "last-window",
        "rename-session beta",
    ] {
        let parsed = CommandParser::new().parse(command).expect("command parses");
        handler
            .execute_parsed_commands(
                std::process::id(),
                parsed,
                QueueExecutionContext::without_caller_cwd().with_current_target(Some(
                    Target::Pane(PaneTarget::with_window(alpha.clone(), 1, 0)),
                )),
            )
            .await
            .unwrap_or_else(|error| {
                panic!("{command} should succeed with current target: {error}")
            });
    }

    let state = handler.state.lock().await;
    let beta = session_name("beta");
    let session = state
        .sessions
        .session(&beta)
        .expect("renamed session exists");
    assert_eq!(
        session.window_at(1).expect("window 1 exists").name(),
        Some("renamed")
    );
    assert_eq!(
        session.active_window_index(),
        0,
        "last-window should return to window 0"
    );
}

#[tokio::test]
async fn parsed_queue_uses_current_target_for_more_default_targeted_commands() {
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

    let current_pane = PaneTarget::with_window(alpha.clone(), 0, 0);
    let current_window = WindowTarget::with_window(alpha.clone(), 0);
    let context = TargetFindContext::from_target(Target::Pane(current_pane.clone()));
    let state = handler.state.lock().await;

    let cases = [
        (
            "kill-window",
            Vec::new(),
            Request::KillWindow(KillWindowRequest {
                target: current_window.clone(),
                kill_all_others: false,
            }),
        ),
        (
            "rotate-window",
            vec!["-U".to_owned()],
            Request::RotateWindow(RotateWindowRequest {
                target: current_window.clone(),
                direction: RotateWindowDirection::Up,
                restore_zoom: false,
            }),
        ),
        (
            "break-pane",
            vec!["-d".to_owned()],
            Request::BreakPane(BreakPaneRequest {
                source: current_pane.clone(),
                target: None,
                name: None,
                detached: true,
                after: false,
                before: false,
                print_target: false,
                format: None,
            }),
        ),
        (
            "respawn-window",
            vec![
                "-k".to_owned(),
                "--".to_owned(),
                "printf".to_owned(),
                "hello".to_owned(),
            ],
            Request::RespawnWindow(RespawnWindowRequest {
                target: current_window.clone(),
                kill: true,
                environment: None,
                command: Some(vec!["printf".to_owned(), "hello".to_owned()]),
                start_directory: None,
            }),
        ),
        (
            "respawn-pane",
            vec![
                "-k".to_owned(),
                "--".to_owned(),
                "printf".to_owned(),
                "hello".to_owned(),
            ],
            Request::RespawnPane(RespawnPaneRequest {
                target: current_pane.clone(),
                kill: true,
                environment: None,
                command: Some(vec!["printf".to_owned(), "hello".to_owned()]),
                process_command: None,
                start_directory: None,
            }),
        ),
        (
            "swap-pane",
            vec!["-U".to_owned()],
            Request::SwapPane(SwapPaneRequest {
                source: current_pane.clone(),
                target: current_pane.clone(),
                direction: Some(SwapPaneDirection::Up),
                detached: false,
                preserve_zoom: false,
            }),
        ),
    ];

    for (command, arguments, expected) in cases {
        let parsed = crate::handler::scripting_support::parse_request_from_parts(
            command.to_owned(),
            arguments,
            None,
            &state.sessions,
            &context,
        )
        .unwrap_or_else(|error| panic!("{command} should use the current target: {error}"));
        assert_eq!(parsed, expected, "unexpected parsed request for {command}");
    }
}

#[tokio::test]
async fn parsed_queue_resolves_attached_short_target_values_for_select_pane() {
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
        .parse("select-pane -t:.+")
        .expect("command parses");
    handler
        .execute_parsed_commands(
            std::process::id(),
            parsed,
            QueueExecutionContext::without_caller_cwd().with_current_target(Some(Target::Pane(
                PaneTarget::with_window(alpha.clone(), 0, 1),
            ))),
        )
        .await
        .expect("select-pane binding should resolve");

    let state = handler.state.lock().await;
    let session = state.sessions.session(&alpha).expect("session exists");
    assert_eq!(
        session
            .window_at(0)
            .expect("window exists")
            .active_pane_index(),
        0,
        "attached short-form -t target should resolve relative pane targets"
    );
}

#[tokio::test]
async fn parsed_queue_resolves_select_pane_mark_against_the_current_pane() {
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
        .parse("select-pane -m")
        .expect("command parses");
    handler
        .execute_parsed_commands(
            std::process::id(),
            parsed,
            QueueExecutionContext::without_caller_cwd().with_current_target(Some(Target::Pane(
                PaneTarget::with_window(alpha.clone(), 0, 1),
            ))),
        )
        .await
        .expect("select-pane -m should resolve against the current pane");

    let state = handler.state.lock().await;
    assert_eq!(
        state
            .marked_pane_target()
            .expect("marked pane target exists")
            .to_string(),
        "alpha:0.1"
    );
}
