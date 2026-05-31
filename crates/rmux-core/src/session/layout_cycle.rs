use rmux_proto::{LayoutName, RmuxError};

use super::Session;

impl Session {
    /// Applies a layout to the session's active window.
    pub fn select_layout(&mut self, layout: LayoutName) {
        self.select_layout_in_window(self.active_window, layout)
            .expect("active session window must exist");
    }

    /// Applies a layout to the addressed window.
    pub fn select_layout_in_window(
        &mut self,
        window_index: u32,
        layout: LayoutName,
    ) -> Result<(), RmuxError> {
        self.select_layout_in_window_with_main_pane_size(window_index, layout, None, None)
    }

    /// Applies a layout to the addressed window using tmux `main-pane-*` option values.
    pub fn select_layout_in_window_with_main_pane_size(
        &mut self,
        window_index: u32,
        layout: LayoutName,
        main_width: Option<u16>,
        main_height: Option<u16>,
    ) -> Result<(), RmuxError> {
        self.resolve_window_target_mut(window_index)?
            .set_layout_with_main_pane_size(layout, main_width, main_height);
        Ok(())
    }

    /// Applies a tmux custom layout string to the addressed window.
    pub fn select_custom_layout_in_window(
        &mut self,
        window_index: u32,
        layout: &str,
    ) -> Result<(), RmuxError> {
        self.resolve_window_target_mut(window_index)?
            .apply_custom_layout(layout)
    }

    /// Reapplies the previously saved tmux old layout to the addressed window.
    pub fn reapply_old_layout_in_window(&mut self, window_index: u32) -> Result<bool, RmuxError> {
        self.resolve_window_target_mut(window_index)?
            .reapply_old_layout()
    }

    /// Saves the current serialized layout as the window old layout.
    pub fn save_old_layout_in_window(&mut self, window_index: u32) -> Result<(), RmuxError> {
        self.resolve_window_target_mut(window_index)?
            .save_old_layout();
        Ok(())
    }

    /// Spreads the addressed window around its active pane, matching tmux `select-layout -E`.
    pub fn spread_layout_in_window(&mut self, window_index: u32) -> Result<bool, RmuxError> {
        let window = self.resolve_window_target_mut(window_index)?;
        Ok(window.spread_layout(window.active_pane_index()))
    }

    /// Selects the next tmux-standard layout for the addressed window.
    pub fn next_layout_in_window(&mut self, window_index: u32) -> Result<LayoutName, RmuxError> {
        self.next_layout_in_window_with_main_pane_size(window_index, None, None)
    }

    /// Selects the next tmux-standard layout using tmux `main-pane-*` option values.
    pub fn next_layout_in_window_with_main_pane_size(
        &mut self,
        window_index: u32,
        main_width: Option<u16>,
        main_height: Option<u16>,
    ) -> Result<LayoutName, RmuxError> {
        Ok(self
            .resolve_window_target_mut(window_index)?
            .next_layout_with_main_pane_size(main_width, main_height))
    }

    /// Selects the previous tmux-standard layout for the addressed window.
    pub fn previous_layout_in_window(
        &mut self,
        window_index: u32,
    ) -> Result<LayoutName, RmuxError> {
        self.previous_layout_in_window_with_main_pane_size(window_index, None, None)
    }

    /// Selects the previous tmux-standard layout using tmux `main-pane-*` option values.
    pub fn previous_layout_in_window_with_main_pane_size(
        &mut self,
        window_index: u32,
        main_width: Option<u16>,
        main_height: Option<u16>,
    ) -> Result<LayoutName, RmuxError> {
        Ok(self
            .resolve_window_target_mut(window_index)?
            .previous_layout_with_main_pane_size(main_width, main_height))
    }
}
