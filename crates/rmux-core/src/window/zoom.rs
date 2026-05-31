use super::Window;
use crate::PaneGeometry;

impl Window {
    /// Returns whether this window is currently zoomed.
    #[must_use]
    pub const fn is_zoomed(&self) -> bool {
        self.zoomed
    }

    pub(crate) fn toggle_zoom(&mut self, pane_index: u32) -> bool {
        if self.pane(pane_index).is_none() {
            return self.zoomed;
        }

        if self.zoomed {
            self.auto_unzoom();
            return false;
        }

        if self.panes.len() <= 1 {
            return false;
        }

        let selected = self.select_pane(pane_index);
        debug_assert!(selected, "validated zoom target pane must be selectable");
        self.zoomed = true;
        self.apply_zoom_geometry();
        true
    }

    pub(crate) fn auto_unzoom(&mut self) -> bool {
        if !self.zoomed {
            return false;
        }

        self.zoomed = false;
        self.recalculate_geometry();
        true
    }

    /// Saves the current zoom state and unzooms. If `restore` is true, the
    /// following `pop_zoom` will re-zoom to the then-active pane.
    ///
    /// Matches tmux `window_push_zoom`.
    pub(crate) fn push_zoom(&mut self, restore: bool) -> bool {
        let was_zoomed = self.zoomed;
        if was_zoomed {
            self.auto_unzoom();
        }
        self.zoom_restore_pending = was_zoomed && restore;
        was_zoomed
    }

    /// Restores zoom state that was saved by a previous `push_zoom` call.
    ///
    /// Matches tmux `window_pop_zoom`.
    pub(crate) fn pop_zoom(&mut self) {
        if self.zoom_restore_pending {
            self.zoom_restore_pending = false;
            if self.panes.len() > 1 {
                self.zoomed = true;
                self.apply_zoom_geometry();
            }
        }
    }

    pub(crate) fn apply_zoom_geometry(&mut self) {
        let size = self.size;
        let active_pane = self.active_pane;
        if let Some(pane) = self.pane_mut(active_pane) {
            pane.set_geometry(PaneGeometry::new(0, 0, size.cols, size.rows));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rmux_proto::{LayoutName, ResizePaneAdjustment, TerminalSize};

    fn window_with_two_panes() -> Window {
        let mut window = Window::new(TerminalSize { cols: 80, rows: 24 });
        window.split_after_position(0);
        window
    }

    #[test]
    fn toggle_zoom_expands_the_target_pane_and_auto_unzoom_restores_layout() {
        let mut window = window_with_two_panes();
        let pane_zero = window.pane(0).expect("pane 0 exists").geometry();
        let pane_one = window.pane(1).expect("pane 1 exists").geometry();

        assert!(window.toggle_zoom(1));

        assert!(window.is_zoomed());
        assert_eq!(window.active_pane_index(), 1);
        assert_eq!(
            window.pane(1).expect("pane 1 exists").geometry(),
            PaneGeometry::new(0, 0, 80, 24)
        );

        assert!(window.auto_unzoom());
        assert!(!window.is_zoomed());
        assert_eq!(window.pane(0).expect("pane 0 exists").geometry(), pane_zero);
        assert_eq!(window.pane(1).expect("pane 1 exists").geometry(), pane_one);
    }

    #[test]
    fn single_pane_zoom_toggle_is_a_noop() {
        let mut window = Window::new(TerminalSize { cols: 80, rows: 24 });
        let geometry = window.pane(0).expect("pane 0 exists").geometry();

        assert!(!window.toggle_zoom(0));

        assert!(!window.is_zoomed());
        assert_eq!(window.pane(0).expect("pane 0 exists").geometry(), geometry);
    }

    #[test]
    fn select_pane_unzooms_before_switching_active_panes() {
        let mut window = window_with_two_panes();
        assert!(window.toggle_zoom(1));

        assert!(window.select_pane(0));

        assert!(!window.is_zoomed());
        assert_eq!(window.active_pane_index(), 0);
        assert_ne!(
            window.pane(1).expect("pane 1 exists").geometry(),
            PaneGeometry::new(0, 0, 80, 24)
        );
    }

    #[test]
    fn absolute_resize_auto_unzooms_before_recalculating_layout() {
        let mut window = window_with_two_panes();
        assert!(window.toggle_zoom(1));

        window.resize_main_pane(ResizePaneAdjustment::AbsoluteWidth { columns: 20 });

        assert!(!window.is_zoomed());
        assert_eq!(
            window.pane(0).expect("pane 0 exists").geometry(),
            PaneGeometry::new(0, 0, 20, 24)
        );
    }

    #[test]
    fn set_layout_auto_unzooms_before_recalculating_layout() {
        let mut window = window_with_two_panes();
        assert!(window.toggle_zoom(1));

        window.set_layout(LayoutName::MainHorizontal);

        assert!(!window.is_zoomed());
        assert_eq!(
            window.pane(0).expect("pane 0 exists").geometry(),
            PaneGeometry::new(0, 0, 80, 22)
        );
        assert_eq!(
            window.pane(1).expect("pane 1 exists").geometry(),
            PaneGeometry::new(0, 23, 80, 1)
        );
    }

    #[test]
    fn set_even_layout_auto_unzooms_before_recalculating_layout() {
        let mut window = window_with_two_panes();
        assert!(window.toggle_zoom(1));

        window.set_layout(LayoutName::EvenHorizontal);

        assert!(!window.is_zoomed());
        assert_eq!(
            window.pane(0).expect("pane 0 exists").geometry(),
            PaneGeometry::new(0, 0, 39, 24)
        );
        assert_eq!(
            window.pane(1).expect("pane 1 exists").geometry(),
            PaneGeometry::new(40, 0, 40, 24)
        );
    }

    #[test]
    fn push_zoom_without_restore_leaves_the_window_unzoomed_after_pop() {
        let mut window = window_with_two_panes();
        assert!(window.toggle_zoom(1));

        assert!(window.push_zoom(false));
        assert!(!window.is_zoomed());
        assert!(!window.zoom_restore_pending);

        window.select_pane(0);
        window.pop_zoom();

        assert!(!window.is_zoomed());
        assert_eq!(window.active_pane_index(), 0);
        assert_eq!(
            window.pane(0).expect("pane 0 exists").geometry(),
            PaneGeometry::new(0, 0, 40, 24)
        );
    }

    #[test]
    fn push_zoom_with_restore_rezooms_the_new_active_pane_on_pop() {
        let mut window = window_with_two_panes();
        assert!(window.toggle_zoom(1));

        assert!(window.push_zoom(true));
        assert!(!window.is_zoomed());
        assert!(window.zoom_restore_pending);

        assert!(window.select_pane(0));
        window.pop_zoom();

        assert!(window.is_zoomed());
        assert!(!window.zoom_restore_pending);
        assert_eq!(window.active_pane_index(), 0);
        assert_eq!(
            window.pane(0).expect("pane 0 exists").geometry(),
            PaneGeometry::new(0, 0, 80, 24)
        );
        assert_eq!(
            window.pane(1).expect("pane 1 exists").geometry(),
            PaneGeometry::new(41, 0, 39, 24)
        );
    }
}
