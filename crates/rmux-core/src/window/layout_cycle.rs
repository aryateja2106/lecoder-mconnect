use rmux_proto::LayoutName;

use super::Window;

const LAYOUT_CYCLE: [LayoutName; 5] = [
    LayoutName::EvenHorizontal,
    LayoutName::EvenVertical,
    LayoutName::MainHorizontal,
    LayoutName::MainVertical,
    LayoutName::Tiled,
];

impl Window {
    #[cfg_attr(not(test), allow(dead_code))]
    pub(crate) fn set_layout(&mut self, layout: LayoutName) {
        self.set_layout_with_main_pane_size(layout, None, None);
    }

    pub(crate) fn set_layout_with_main_pane_size(
        &mut self,
        layout: LayoutName,
        main_width: Option<u16>,
        main_height: Option<u16>,
    ) {
        self.auto_unzoom();
        self.layout = layout;
        self.last_layout = Some(layout);
        self.requested_main_width = main_width;
        self.requested_main_height = main_height;
        self.rebuild_named_layout_tree(layout);
    }

    #[cfg_attr(not(test), allow(dead_code))]
    pub(crate) fn next_layout(&mut self) -> LayoutName {
        self.next_layout_with_main_pane_size(None, None)
    }

    pub(crate) fn next_layout_with_main_pane_size(
        &mut self,
        main_width: Option<u16>,
        main_height: Option<u16>,
    ) -> LayoutName {
        let layout = next_cycle_layout(self.last_layout);
        self.set_layout_with_main_pane_size(layout, main_width, main_height);
        layout
    }

    #[cfg_attr(not(test), allow(dead_code))]
    pub(crate) fn previous_layout(&mut self) -> LayoutName {
        self.previous_layout_with_main_pane_size(None, None)
    }

    pub(crate) fn previous_layout_with_main_pane_size(
        &mut self,
        main_width: Option<u16>,
        main_height: Option<u16>,
    ) -> LayoutName {
        let layout = previous_cycle_layout(self.last_layout);
        self.set_layout_with_main_pane_size(layout, main_width, main_height);
        layout
    }

    pub(crate) fn recalculate_geometry(&mut self) {
        if let Some(tree) = &mut self.layout_tree {
            tree.resize(self.size);
            tree.apply_to_panes(&mut self.panes);
        }
    }
}

fn next_cycle_layout(last_layout: Option<LayoutName>) -> LayoutName {
    match last_layout {
        None => LAYOUT_CYCLE[0],
        Some(layout) => {
            let position = cycle_position(layout);
            LAYOUT_CYCLE[(position + 1) % LAYOUT_CYCLE.len()]
        }
    }
}

fn previous_cycle_layout(last_layout: Option<LayoutName>) -> LayoutName {
    match last_layout {
        None => *LAYOUT_CYCLE.last().expect("layout cycle is non-empty"),
        Some(layout) => {
            let position = cycle_position(layout);
            LAYOUT_CYCLE[(position + LAYOUT_CYCLE.len() - 1) % LAYOUT_CYCLE.len()]
        }
    }
}

fn cycle_position(layout: LayoutName) -> usize {
    let layout = match layout {
        LayoutName::MainHorizontalMirrored => LayoutName::MainHorizontal,
        LayoutName::MainVerticalMirrored => LayoutName::MainVertical,
        layout => layout,
    };
    LAYOUT_CYCLE
        .iter()
        .position(|candidate| *candidate == layout)
        .expect("all cycle-eligible LayoutName variants must be in the tmux cycle")
}

#[cfg(test)]
mod tests {
    use rmux_proto::{LayoutName, ResizePaneAdjustment, SplitDirection, TerminalSize};

    use crate::{PaneGeometry, PaneId};

    use super::Window;

    fn window_with_two_panes() -> Window {
        let mut window = Window::new(TerminalSize { cols: 80, rows: 24 });
        window.split_after_position(0);
        window
    }

    #[test]
    fn next_layout_from_tiled_wraps_to_even_horizontal() {
        let mut window = window_with_two_panes();

        window.set_layout(LayoutName::Tiled);

        assert_eq!(window.next_layout(), LayoutName::EvenHorizontal);
        assert_eq!(window.layout(), LayoutName::EvenHorizontal);
    }

    #[test]
    fn previous_layout_from_even_horizontal_wraps_to_tiled() {
        let mut window = window_with_two_panes();

        window.set_layout(LayoutName::EvenHorizontal);

        assert_eq!(window.previous_layout(), LayoutName::Tiled);
        assert_eq!(window.layout(), LayoutName::Tiled);
    }

    #[test]
    fn layout_cycle_uses_tmux_order_not_enum_declaration_order() {
        let mut window = Window::new(TerminalSize { cols: 80, rows: 24 });

        for expected in [
            LayoutName::EvenHorizontal,
            LayoutName::EvenVertical,
            LayoutName::MainHorizontal,
            LayoutName::MainVertical,
            LayoutName::Tiled,
        ] {
            assert_eq!(window.next_layout(), expected);
        }
    }

    #[test]
    fn previous_layout_cycles_backward_through_tmux_order() {
        let mut window = Window::new(TerminalSize { cols: 80, rows: 24 });
        window.set_layout(LayoutName::EvenHorizontal);

        for expected in [
            LayoutName::Tiled,
            LayoutName::MainVertical,
            LayoutName::MainHorizontal,
            LayoutName::EvenVertical,
            LayoutName::EvenHorizontal,
        ] {
            assert_eq!(window.previous_layout(), expected);
        }
    }

    #[test]
    fn split_layout_does_not_move_the_lastlayout_cycle_cursor() {
        let mut window = Window::new(TerminalSize { cols: 80, rows: 24 });
        assert_eq!(window.next_layout(), LayoutName::EvenHorizontal);

        window.split_after_position_with_id_and_direction(
            0,
            PaneId::new(1),
            SplitDirection::Horizontal,
        );

        assert_eq!(window.layout(), LayoutName::MainHorizontal);
        assert_eq!(window.next_layout(), LayoutName::EvenVertical);
    }

    #[test]
    fn selecting_named_layout_resets_resized_split_tree_main_size_like_tmux() {
        let mut window = Window::new(TerminalSize {
            cols: 120,
            rows: 35,
        });
        window.split_after_position_with_id_and_direction(
            0,
            PaneId::new(1),
            SplitDirection::Vertical,
        );
        window.split_after_position_with_id_and_direction(
            0,
            PaneId::new(2),
            SplitDirection::Horizontal,
        );
        window.split_after_position_with_id_and_direction(
            1,
            PaneId::new(3),
            SplitDirection::Vertical,
        );
        window.select_pane(2);

        assert!(window.resize_pane_by(2, ResizePaneAdjustment::Right { cells: 7 }));
        assert_eq!(window.pane(0).expect("pane exists").geometry().cols(), 60);

        window.set_layout(LayoutName::MainHorizontal);
        assert_eq!(window.next_layout(), LayoutName::MainVertical);

        assert_eq!(window.pane(0).expect("pane exists").geometry().cols(), 80);
    }

    #[test]
    fn next_layout_auto_unzooms_before_recalculating() {
        let mut window = window_with_two_panes();
        window.set_layout(LayoutName::Tiled);
        assert!(window.toggle_zoom(1));

        assert_eq!(window.next_layout(), LayoutName::EvenHorizontal);

        assert!(!window.is_zoomed());
        assert_eq!(
            window.pane(1).expect("pane 1 exists").geometry(),
            PaneGeometry::new(40, 0, 40, 24)
        );
    }

    #[test]
    fn previous_layout_auto_unzooms_before_recalculating() {
        let mut window = window_with_two_panes();
        window.set_layout(LayoutName::EvenHorizontal);
        assert!(window.toggle_zoom(1));

        assert_eq!(window.previous_layout(), LayoutName::Tiled);

        assert!(!window.is_zoomed());
        assert_eq!(
            window.pane(1).expect("pane 1 exists").geometry(),
            PaneGeometry::new(0, 12, 80, 12)
        );
    }
}
