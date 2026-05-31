use super::*;

#[tokio::test]
async fn mutate_session_rolls_back_when_the_mutation_returns_an_error() {
    let handler = RequestHandler::new();
    let alpha = session_name("alpha");

    let created = handler
        .handle(Request::NewSession(NewSessionRequest {
            session_name: alpha.clone(),
            detached: true,
            size: Some(TerminalSize {
                cols: 120,
                rows: 40,
            }),

            environment: None,
        }))
        .await;
    assert!(matches!(created, Response::NewSession(_)));

    let previous_session = {
        let state = handler.state.lock().await;
        state
            .sessions
            .session(&alpha)
            .expect("session exists")
            .clone()
    };

    let result = {
        let mut state = handler.state.lock().await;
        state.mutate_session_and_resize_terminals(&alpha, |session| {
            session.split_active_pane()?;
            Err::<(), RmuxError>(RmuxError::Server("forced mutation failure".to_owned()))
        })
    };
    assert_eq!(
        result,
        Err(RmuxError::Server("forced mutation failure".to_owned()))
    );

    let state = handler.state.lock().await;
    let session = state.sessions.session(&alpha).expect("session exists");
    assert_eq!(session, &previous_session);
    assert_eq!(
        state.ensure_panes_exist(&alpha, &[rmux_core::PaneId::new(1)]),
        Err(RmuxError::Server(format!(
            "missing pane terminal for pane id 1 in session {}",
            alpha
        )))
    );
}

#[tokio::test]
async fn rename_session_missing_source_returns_session_not_found() {
    let handler = RequestHandler::new();

    let response = handler
        .handle(Request::RenameSession(RenameSessionRequest {
            target: session_name("missing"),
            new_name: session_name("gamma"),
        }))
        .await;

    assert_eq!(
        response,
        Response::Error(ErrorResponse {
            error: RmuxError::SessionNotFound("missing".to_owned()),
        })
    );
}

#[tokio::test]
async fn rename_session_to_existing_name_returns_duplicate_session() {
    let handler = RequestHandler::new();
    for name in ["alpha", "beta"] {
        let created = handler
            .handle(Request::NewSession(NewSessionRequest {
                session_name: session_name(name),
                detached: true,
                size: None,

                environment: None,
            }))
            .await;
        assert!(matches!(created, Response::NewSession(_)));
    }

    let response = handler
        .handle(Request::RenameSession(RenameSessionRequest {
            target: session_name("alpha"),
            new_name: session_name("beta"),
        }))
        .await;

    assert_eq!(
        response,
        Response::Error(ErrorResponse {
            error: RmuxError::DuplicateSession("beta".to_owned()),
        })
    );

    assert_eq!(
        handler
            .handle(Request::HasSession(HasSessionRequest {
                target: session_name("alpha"),
            }))
            .await,
        Response::HasSession(rmux_proto::HasSessionResponse { exists: true })
    );
}

#[tokio::test]
async fn rename_session_to_same_name_returns_success_without_mutation() {
    let handler = RequestHandler::new();
    let created = handler
        .handle(Request::NewSession(NewSessionRequest {
            session_name: session_name("alpha"),
            detached: true,
            size: None,

            environment: None,
        }))
        .await;
    assert!(matches!(created, Response::NewSession(_)));

    let response = handler
        .handle(Request::RenameSession(RenameSessionRequest {
            target: session_name("alpha"),
            new_name: session_name("alpha"),
        }))
        .await;

    assert_eq!(
        response,
        Response::RenameSession(rmux_proto::RenameSessionResponse {
            session_name: session_name("alpha"),
        })
    );
    assert_eq!(
        handler
            .handle(Request::HasSession(HasSessionRequest {
                target: session_name("alpha"),
            }))
            .await,
        Response::HasSession(rmux_proto::HasSessionResponse { exists: true })
    );
}

#[tokio::test]
async fn rename_session_happy_path_migrates_session() {
    let handler = RequestHandler::new();
    let created = handler
        .handle(Request::NewSession(NewSessionRequest {
            session_name: session_name("alpha"),
            detached: true,
            size: None,

            environment: None,
        }))
        .await;
    assert!(matches!(created, Response::NewSession(_)));

    let renamed = handler
        .handle(Request::RenameSession(RenameSessionRequest {
            target: session_name("alpha"),
            new_name: session_name("gamma"),
        }))
        .await;

    assert_eq!(
        renamed,
        Response::RenameSession(rmux_proto::RenameSessionResponse {
            session_name: session_name("gamma"),
        })
    );

    assert_eq!(
        handler
            .handle(Request::HasSession(HasSessionRequest {
                target: session_name("alpha"),
            }))
            .await,
        Response::HasSession(rmux_proto::HasSessionResponse { exists: false })
    );
    assert_eq!(
        handler
            .handle(Request::HasSession(HasSessionRequest {
                target: session_name("gamma"),
            }))
            .await,
        Response::HasSession(rmux_proto::HasSessionResponse { exists: true })
    );
}

#[tokio::test]
async fn rename_session_resolves_unique_prefix_targets() {
    let handler = RequestHandler::new();
    let created = handler
        .handle(Request::NewSession(NewSessionRequest {
            session_name: session_name("alpha"),
            detached: true,
            size: None,
            environment: None,
        }))
        .await;
    assert!(matches!(created, Response::NewSession(_)));

    let renamed = handler
        .handle(Request::RenameSession(RenameSessionRequest {
            target: session_name("alp"),
            new_name: session_name("gamma"),
        }))
        .await;

    assert_eq!(
        renamed,
        Response::RenameSession(rmux_proto::RenameSessionResponse {
            session_name: session_name("gamma"),
        })
    );
    assert_eq!(
        handler
            .handle(Request::HasSession(HasSessionRequest {
                target: session_name("gamma"),
            }))
            .await,
        Response::HasSession(rmux_proto::HasSessionResponse { exists: true })
    );
}
