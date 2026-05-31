use super::*;

#[tokio::test]
async fn link_window_shares_runtime_tracks_linked_sessions_and_unlinks_cleanly() {
    let handler = RequestHandler::new();
    let alpha = session_name("alpha");
    let beta = session_name("beta");
    create_session(&handler, "alpha").await;
    create_session(&handler, "beta").await;

    let response = handler
        .handle(Request::LinkWindow(LinkWindowRequest {
            source: WindowTarget::with_window(alpha.clone(), 0),
            target: WindowTarget::with_window(beta.clone(), 1),
            after: false,
            before: false,
            kill_destination: false,
            detached: false,
        }))
        .await;

    assert!(
        matches!(&response, Response::LinkWindow(r) if r.target == WindowTarget::with_window(beta.clone(), 1)),
        "expected link-window success, got {response:?}"
    );

    {
        let state = handler.state.lock().await;
        let alpha_window = state
            .sessions
            .session(&alpha)
            .and_then(|session| session.window_at(0))
            .expect("alpha window 0 should exist");
        let beta_window = state
            .sessions
            .session(&beta)
            .and_then(|session| session.window_at(1))
            .expect("beta window 1 should exist");

        assert_eq!(alpha_window.id(), beta_window.id());
        assert_eq!(state.window_link_count(&alpha, 0), 2);
        assert_eq!(state.window_linked_session_count(&alpha, 0), 2);
        assert_eq!(
            state.window_linked_sessions_list(&alpha, 0),
            vec![alpha.clone(), beta.clone()]
        );
        assert!(
            state.pane_profile_in_window(&beta, 1, 0).is_ok(),
            "linked target should resolve pane runtime through the shared terminal owner"
        );
    }

    let rename = handler
        .handle(Request::RenameWindow(RenameWindowRequest {
            target: WindowTarget::with_window(beta.clone(), 1),
            name: "logs".to_owned(),
        }))
        .await;
    assert!(
        matches!(&rename, Response::RenameWindow(r) if r.target == WindowTarget::with_window(beta.clone(), 1)),
        "expected rename-window success, got {rename:?}"
    );

    {
        let state = handler.state.lock().await;
        let alpha_window = state
            .sessions
            .session(&alpha)
            .and_then(|session| session.window_at(0))
            .expect("alpha window 0 should exist after rename");
        let beta_window = state
            .sessions
            .session(&beta)
            .and_then(|session| session.window_at(1))
            .expect("beta window 1 should exist after rename");

        assert_eq!(alpha_window.name(), Some("logs"));
        assert_eq!(beta_window.name(), Some("logs"));
    }

    let unlink = handler
        .handle(Request::UnlinkWindow(UnlinkWindowRequest {
            target: WindowTarget::with_window(beta.clone(), 1),
            kill_if_last: false,
        }))
        .await;
    assert!(
        matches!(&unlink, Response::UnlinkWindow(r) if r.target == WindowTarget::with_window(beta.clone(), 0)),
        "expected unlink-window success, got {unlink:?}"
    );

    let state = handler.state.lock().await;
    assert_eq!(state.window_link_count(&alpha, 0), 1);
    assert_eq!(state.window_linked_session_count(&alpha, 0), 1);
    assert_eq!(
        state.window_linked_sessions_list(&alpha, 0),
        vec![alpha.clone()]
    );
    assert!(
        state
            .sessions
            .session(&beta)
            .and_then(|session| session.window_at(1))
            .is_none(),
        "unlink-window should remove the target slot from beta"
    );
    assert!(
        state.pane_profile_in_window(&beta, 1, 0).is_err(),
        "unlinked target slot should no longer resolve pane runtime"
    );
}

#[tokio::test]
async fn unlink_window_kill_if_last_deletes_an_unshared_window_slot() {
    let handler = RequestHandler::new();
    let alpha = session_name("alpha");
    create_session(&handler, "alpha").await;
    insert_window(&handler, &alpha, 1).await;

    let response = handler
        .handle(Request::UnlinkWindow(UnlinkWindowRequest {
            target: WindowTarget::with_window(alpha.clone(), 1),
            kill_if_last: true,
        }))
        .await;

    assert!(
        matches!(&response, Response::UnlinkWindow(r) if r.target == WindowTarget::with_window(alpha.clone(), 0)),
        "expected unlink-window -k to remove the unshared slot, got {response:?}"
    );

    let state = handler.state.lock().await;
    let session = state.sessions.session(&alpha).expect("alpha should exist");
    assert!(
        session.window_at(1).is_none(),
        "unlink-window -k should delete the unshared destination window"
    );
    assert_eq!(session.active_window_index(), 0);
}

#[tokio::test]
async fn unlink_window_restores_previous_last_window_flag_after_active_link_removal() {
    let handler = RequestHandler::new();
    let alpha = session_name("alpha");
    create_session(&handler, "alpha").await;
    insert_window(&handler, &alpha, 1).await;
    insert_window(&handler, &alpha, 2).await;

    assert!(matches!(
        handler
            .handle(Request::SelectWindow(SelectWindowRequest {
                target: WindowTarget::with_window(alpha.clone(), 1),
            }))
            .await,
        Response::SelectWindow(_)
    ));
    assert!(matches!(
        handler
            .handle(Request::SelectWindow(SelectWindowRequest {
                target: WindowTarget::with_window(alpha.clone(), 0),
            }))
            .await,
        Response::SelectWindow(_)
    ));

    assert!(matches!(
        handler
            .handle(Request::LinkWindow(LinkWindowRequest {
                source: WindowTarget::with_window(alpha.clone(), 0),
                target: WindowTarget::with_window(alpha.clone(), 9),
                after: false,
                before: false,
                kill_destination: false,
                detached: false,
            }))
            .await,
        Response::LinkWindow(_)
    ));
    assert!(matches!(
        handler
            .handle(Request::UnlinkWindow(UnlinkWindowRequest {
                target: WindowTarget::with_window(alpha.clone(), 9),
                kill_if_last: true,
            }))
            .await,
        Response::UnlinkWindow(_)
    ));

    let state = handler.state.lock().await;
    let session = state.sessions.session(&alpha).expect("alpha should exist");
    assert_eq!(session.active_window_index(), 0);
    assert_eq!(session.last_window_index(), Some(1));
}
