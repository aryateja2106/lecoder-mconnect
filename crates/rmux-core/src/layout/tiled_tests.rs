use super::apply_layout;
use crate::{Pane, PaneGeometry};
use rmux_proto::{LayoutName, TerminalSize};

fn pane(index: u32) -> Pane {
    Pane::new(index, PaneGeometry::new(0, 0, 0, 0))
}

fn assert_tiled_layout(
    pane_count: u32,
    requested_main_width: Option<u16>,
    expected: Vec<PaneGeometry>,
) {
    let mut panes = (0..pane_count).map(pane).collect::<Vec<_>>();

    apply_layout(
        &mut panes,
        LayoutName::Tiled,
        TerminalSize { cols: 80, rows: 24 },
        requested_main_width,
    );

    assert_eq!(
        panes.iter().map(|pane| pane.geometry()).collect::<Vec<_>>(),
        expected
    );
}

#[test]
fn tiled_geometry_for_one_to_six_panes_matches_tmux_grid() {
    for (pane_count, expected) in [
        (1, vec![PaneGeometry::new(0, 0, 80, 24)]),
        (
            2,
            vec![
                PaneGeometry::new(0, 0, 80, 11),
                PaneGeometry::new(0, 12, 80, 12),
            ],
        ),
        (
            3,
            vec![
                PaneGeometry::new(0, 0, 39, 11),
                PaneGeometry::new(40, 0, 40, 11),
                PaneGeometry::new(0, 12, 80, 12),
            ],
        ),
        (
            4,
            vec![
                PaneGeometry::new(0, 0, 39, 11),
                PaneGeometry::new(40, 0, 40, 11),
                PaneGeometry::new(0, 12, 39, 12),
                PaneGeometry::new(40, 12, 40, 12),
            ],
        ),
        (
            5,
            vec![
                PaneGeometry::new(0, 0, 39, 7),
                PaneGeometry::new(40, 0, 40, 7),
                PaneGeometry::new(0, 8, 39, 7),
                PaneGeometry::new(40, 8, 40, 7),
                PaneGeometry::new(0, 16, 80, 8),
            ],
        ),
        (
            6,
            vec![
                PaneGeometry::new(0, 0, 39, 7),
                PaneGeometry::new(40, 0, 40, 7),
                PaneGeometry::new(0, 8, 39, 7),
                PaneGeometry::new(40, 8, 40, 7),
                PaneGeometry::new(0, 16, 39, 8),
                PaneGeometry::new(40, 16, 40, 8),
            ],
        ),
    ] {
        assert_tiled_layout(pane_count, None, expected);
    }
}

#[test]
fn tiled_ignores_requested_main_width() {
    assert_tiled_layout(
        4,
        Some(79),
        vec![
            PaneGeometry::new(0, 0, 39, 11),
            PaneGeometry::new(40, 0, 40, 11),
            PaneGeometry::new(0, 12, 39, 12),
            PaneGeometry::new(40, 12, 40, 12),
        ],
    );
}

#[test]
fn tiled_partial_final_row_absorbs_remaining_width_in_the_last_pane() {
    assert_tiled_layout(
        8,
        None,
        vec![
            PaneGeometry::new(0, 0, 26, 7),
            PaneGeometry::new(27, 0, 26, 7),
            PaneGeometry::new(54, 0, 26, 7),
            PaneGeometry::new(0, 8, 26, 7),
            PaneGeometry::new(27, 8, 26, 7),
            PaneGeometry::new(54, 8, 26, 7),
            PaneGeometry::new(0, 16, 26, 8),
            PaneGeometry::new(27, 16, 53, 8),
        ],
    );
}
