use super::RequestHandler;
use rmux_core::PaneGeometry;
use rmux_proto::{
    LayoutName, NewSessionRequest, NextLayoutRequest, PaneTarget, PreviousLayoutRequest, Request,
    ResizePaneAdjustment, ResizePaneRequest, Response, SelectCustomLayoutRequest,
    SelectLayoutRequest, SelectLayoutTarget, SessionName, SplitWindowRequest, SplitWindowTarget,
    TerminalSize, WindowTarget,
};

fn session_name(value: &str) -> SessionName {
    SessionName::new(value).expect("valid session name")
}

fn layout_string(body: &str) -> String {
    let mut checksum = 0_u16;
    for byte in body.bytes() {
        checksum = (checksum >> 1) + ((checksum & 1) << 15);
        checksum = checksum.wrapping_add(u16::from(byte));
    }
    format!("{checksum:04x},{body}")
}

async fn create_session(handler: &RequestHandler, session_name: &SessionName, size: TerminalSize) {
    let created = handler
        .handle(Request::NewSession(NewSessionRequest {
            session_name: session_name.clone(),
            detached: true,
            size: Some(size),

            environment: None,
        }))
        .await;
    assert!(matches!(created, Response::NewSession(_)));
}

async fn split_pane_zero(handler: &RequestHandler, session_name: &SessionName, expected_pane: u32) {
    let split = handler
        .handle(Request::SplitWindow(SplitWindowRequest {
            target: SplitWindowTarget::Pane(PaneTarget::new(session_name.clone(), 0)),
            direction: rmux_proto::SplitDirection::Vertical,
            before: false,
            environment: None,
        }))
        .await;
    assert_eq!(
        split,
        Response::SplitWindow(rmux_proto::SplitWindowResponse {
            pane: PaneTarget::new(session_name.clone(), expected_pane),
        })
    );
}

#[tokio::test]
async fn select_layout_even_layouts_apply_tmux_geometry_through_the_handler() {
    let handler = RequestHandler::new();
    let alpha = session_name("alpha");

    create_session(
        &handler,
        &alpha,
        TerminalSize {
            cols: 100,
            rows: 40,
        },
    )
    .await;

    for expected_pane in [1, 1] {
        split_pane_zero(&handler, &alpha, expected_pane).await;
    }

    let even_horizontal = handler
        .handle(Request::SelectLayout(SelectLayoutRequest {
            target: SelectLayoutTarget::Window(WindowTarget::new(alpha.clone())),
            layout: LayoutName::EvenHorizontal,
        }))
        .await;
    assert_eq!(
        even_horizontal,
        Response::SelectLayout(rmux_proto::SelectLayoutResponse {
            layout: LayoutName::EvenHorizontal,
        })
    );

    {
        let state = handler.state.lock().await;
        let session = state.sessions.session(&alpha).expect("session exists");
        let window = session.window();
        assert_eq!(window.layout(), LayoutName::EvenHorizontal);
        assert_eq!(
            window.pane(0).expect("pane 0 exists").geometry(),
            PaneGeometry::new(0, 0, 32, 40)
        );
        assert_eq!(
            window.pane(1).expect("pane 1 exists").geometry(),
            PaneGeometry::new(33, 0, 32, 40)
        );
        assert_eq!(
            window.pane(2).expect("pane 2 exists").geometry(),
            PaneGeometry::new(66, 0, 34, 40)
        );
    }

    let even_vertical = handler
        .handle(Request::SelectLayout(SelectLayoutRequest {
            target: SelectLayoutTarget::Window(WindowTarget::new(alpha.clone())),
            layout: LayoutName::EvenVertical,
        }))
        .await;
    assert_eq!(
        even_vertical,
        Response::SelectLayout(rmux_proto::SelectLayoutResponse {
            layout: LayoutName::EvenVertical,
        })
    );

    let state = handler.state.lock().await;
    let session = state.sessions.session(&alpha).expect("session exists");
    let window = session.window();
    assert_eq!(window.layout(), LayoutName::EvenVertical);
    assert_eq!(
        window.pane(0).expect("pane 0 exists").geometry(),
        PaneGeometry::new(0, 0, 100, 12)
    );
    assert_eq!(
        window.pane(1).expect("pane 1 exists").geometry(),
        PaneGeometry::new(0, 13, 100, 12)
    );
    assert_eq!(
        window.pane(2).expect("pane 2 exists").geometry(),
        PaneGeometry::new(0, 26, 100, 14)
    );
}

#[tokio::test]
async fn next_layout_uses_tmux_cycle_order_and_wraps() {
    let handler = RequestHandler::new();
    let alpha = session_name("alpha");
    create_session(&handler, &alpha, TerminalSize { cols: 80, rows: 24 }).await;

    let selected = handler
        .handle(Request::SelectLayout(SelectLayoutRequest {
            target: SelectLayoutTarget::Window(WindowTarget::new(alpha.clone())),
            layout: LayoutName::EvenHorizontal,
        }))
        .await;
    assert_eq!(
        selected,
        Response::SelectLayout(rmux_proto::SelectLayoutResponse {
            layout: LayoutName::EvenHorizontal,
        })
    );

    for (offset, expected) in [
        LayoutName::EvenVertical,
        LayoutName::MainHorizontal,
        LayoutName::MainVertical,
        LayoutName::Tiled,
        LayoutName::EvenHorizontal,
        LayoutName::EvenVertical,
        LayoutName::MainHorizontal,
    ]
    .into_iter()
    .enumerate()
    {
        let response = handler
            .handle(Request::NextLayout(NextLayoutRequest {
                target: WindowTarget::new(alpha.clone()),
            }))
            .await;
        assert_eq!(
            response,
            Response::NextLayout(rmux_proto::NextLayoutResponse { layout: expected }),
            "unexpected next-layout response at cycle offset {offset}"
        );
    }
}

#[tokio::test]
async fn previous_layout_from_even_horizontal_wraps_to_tiled() {
    let handler = RequestHandler::new();
    let alpha = session_name("alpha");
    create_session(&handler, &alpha, TerminalSize { cols: 80, rows: 24 }).await;

    let selected = handler
        .handle(Request::SelectLayout(SelectLayoutRequest {
            target: SelectLayoutTarget::Window(WindowTarget::new(alpha.clone())),
            layout: LayoutName::EvenHorizontal,
        }))
        .await;
    assert_eq!(
        selected,
        Response::SelectLayout(rmux_proto::SelectLayoutResponse {
            layout: LayoutName::EvenHorizontal,
        })
    );

    let previous = handler
        .handle(Request::PreviousLayout(PreviousLayoutRequest {
            target: WindowTarget::new(alpha.clone()),
        }))
        .await;
    assert_eq!(
        previous,
        Response::PreviousLayout(rmux_proto::PreviousLayoutResponse {
            layout: LayoutName::Tiled,
        })
    );
}

#[tokio::test]
async fn next_and_previous_layout_auto_unzoom_zoomed_windows() {
    let handler = RequestHandler::new();
    let alpha = session_name("alpha");
    create_session(&handler, &alpha, TerminalSize { cols: 80, rows: 24 }).await;
    split_pane_zero(&handler, &alpha, 1).await;

    let selected = handler
        .handle(Request::SelectLayout(SelectLayoutRequest {
            target: SelectLayoutTarget::Window(WindowTarget::new(alpha.clone())),
            layout: LayoutName::Tiled,
        }))
        .await;
    assert_eq!(
        selected,
        Response::SelectLayout(rmux_proto::SelectLayoutResponse {
            layout: LayoutName::Tiled,
        })
    );

    let zoomed = handler
        .handle(Request::ResizePane(ResizePaneRequest {
            target: PaneTarget::new(alpha.clone(), 1),
            adjustment: ResizePaneAdjustment::Zoom,
        }))
        .await;
    assert!(matches!(zoomed, Response::ResizePane(_)));

    {
        let state = handler.state.lock().await;
        let session = state.sessions.session(&alpha).expect("session exists");
        assert!(session.window().is_zoomed());
    }

    let next = handler
        .handle(Request::NextLayout(NextLayoutRequest {
            target: WindowTarget::new(alpha.clone()),
        }))
        .await;
    assert_eq!(
        next,
        Response::NextLayout(rmux_proto::NextLayoutResponse {
            layout: LayoutName::EvenHorizontal,
        })
    );

    {
        let state = handler.state.lock().await;
        let session = state.sessions.session(&alpha).expect("session exists");
        assert!(!session.window().is_zoomed());
        assert_eq!(session.window().layout(), LayoutName::EvenHorizontal);
    }

    let zoomed = handler
        .handle(Request::ResizePane(ResizePaneRequest {
            target: PaneTarget::new(alpha.clone(), 1),
            adjustment: ResizePaneAdjustment::Zoom,
        }))
        .await;
    assert!(matches!(zoomed, Response::ResizePane(_)));

    let previous = handler
        .handle(Request::PreviousLayout(PreviousLayoutRequest {
            target: WindowTarget::new(alpha.clone()),
        }))
        .await;
    assert_eq!(
        previous,
        Response::PreviousLayout(rmux_proto::PreviousLayoutResponse {
            layout: LayoutName::Tiled,
        })
    );

    let state = handler.state.lock().await;
    let session = state.sessions.session(&alpha).expect("session exists");
    assert!(!session.window().is_zoomed());
    assert_eq!(session.window().layout(), LayoutName::Tiled);
}

#[tokio::test]
async fn resize_pane_preserves_custom_layout_trees_through_the_handler() {
    let handler = RequestHandler::new();
    let alpha = session_name("alpha");
    create_session(
        &handler,
        &alpha,
        TerminalSize {
            cols: 100,
            rows: 40,
        },
    )
    .await;
    split_pane_zero(&handler, &alpha, 1).await;
    split_pane_zero(&handler, &alpha, 1).await;

    let custom_layout =
        layout_string("100x40,0,0{60x40,0,0,0,39x40,61,0[39x19,61,0,2,39x20,61,20,1]}");
    let selected = handler
        .handle(Request::SelectCustomLayout(SelectCustomLayoutRequest {
            target: SelectLayoutTarget::Window(WindowTarget::new(alpha.clone())),
            layout: custom_layout,
        }))
        .await;
    assert!(matches!(selected, Response::SelectLayout(_)));

    let resized = handler
        .handle(Request::ResizePane(ResizePaneRequest {
            target: PaneTarget::new(alpha.clone(), 0),
            adjustment: ResizePaneAdjustment::AbsoluteWidth { columns: 34 },
        }))
        .await;
    assert!(matches!(resized, Response::ResizePane(_)));

    let state = handler.state.lock().await;
    let session = state.sessions.session(&alpha).expect("session exists");
    assert_eq!(
        session.window().layout_dump(),
        layout_string("100x40,0,0{34x40,0,0,0,65x40,35,0[65x19,35,0,2,65x20,35,20,1]}")
    );
}
