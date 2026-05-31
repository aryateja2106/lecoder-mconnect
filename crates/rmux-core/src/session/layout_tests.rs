use super::Session;
use crate::PaneGeometry;
use rmux_proto::{LayoutName, SessionName, TerminalSize};

fn session_name(value: &str) -> SessionName {
    SessionName::new(value).expect("valid session name")
}

#[test]
fn even_layout_selection_is_isolated_to_the_addressed_window() {
    let mut session = Session::new(
        session_name("alpha"),
        TerminalSize {
            cols: 100,
            rows: 40,
        },
    );
    session
        .split_pane_in_window(0, 0)
        .expect("window 0 first split succeeds");
    session
        .split_pane_in_window(0, 0)
        .expect("window 0 second split succeeds");
    session
        .insert_window_with_initial_pane(
            1,
            TerminalSize {
                cols: 100,
                rows: 40,
            },
        )
        .expect("window 1 insert succeeds");
    session
        .split_pane_in_window(1, 0)
        .expect("window 1 split succeeds");

    session
        .select_layout_in_window(0, LayoutName::EvenHorizontal)
        .expect("layout selection succeeds");

    let window0 = session.window_at(0).expect("window 0 exists");
    assert_eq!(window0.layout(), LayoutName::EvenHorizontal);
    assert_eq!(
        window0.pane(0).expect("window 0 pane 0 exists").geometry(),
        PaneGeometry::new(0, 0, 32, 40)
    );
    assert_eq!(
        window0.pane(1).expect("window 0 pane 1 exists").geometry(),
        PaneGeometry::new(33, 0, 32, 40)
    );
    assert_eq!(
        window0.pane(2).expect("window 0 pane 2 exists").geometry(),
        PaneGeometry::new(66, 0, 34, 40)
    );

    let window1 = session.window_at(1).expect("window 1 exists");
    assert_eq!(window1.layout(), LayoutName::MainVertical);
    assert_eq!(
        window1.pane(0).expect("window 1 pane 0 exists").geometry(),
        PaneGeometry::new(0, 0, 50, 40)
    );
    assert_eq!(
        window1.pane(1).expect("window 1 pane 1 exists").geometry(),
        PaneGeometry::new(51, 0, 49, 40)
    );
}
