use rmux_core::{OptionStore, Pane, Session, Window};
use rmux_proto::{OptionName, ResizePaneAdjustment, TerminalSize};

use super::RuntimeFormatContext;

impl RuntimeFormatContext<'_> {
    pub(super) fn visible_session_snapshot(&self) -> Option<Session> {
        let mut session = self.session?.clone();
        if !self.use_unclipped_geometry {
            let size =
                visible_session_size(self.option_store(), &session, self.session_attached_count());
            if size != session.window().size() {
                session.resize_terminal(size);
            }
        }
        Some(session)
    }

    pub(super) fn visible_window_snapshot(&self) -> Option<Window> {
        let session = self.visible_session_snapshot()?;
        let window_index = self
            .window_index
            .unwrap_or_else(|| session.active_window_index());
        session.window_at(window_index).cloned()
    }

    pub(super) fn layout_window_snapshot(&self) -> Option<Window> {
        let mut session = self.session?.clone();
        for window_index in session.windows().keys().copied().collect::<Vec<_>>() {
            let Some(active_pane_index) = session
                .window_at(window_index)
                .map(|window| (window.is_zoomed(), window.active_pane_index()))
                .and_then(|(zoomed, active_pane_index)| zoomed.then_some(active_pane_index))
            else {
                continue;
            };
            let _ = session.resize_pane_in_window(
                window_index,
                active_pane_index,
                ResizePaneAdjustment::Zoom,
            );
        }
        if !self.use_unclipped_geometry {
            let size =
                visible_session_size(self.option_store(), &session, self.session_attached_count());
            if size != session.window().size() {
                session.resize_terminal(size);
            }
        }
        let window_index = self
            .window_index
            .unwrap_or_else(|| session.active_window_index());
        session.window_at(window_index).cloned()
    }

    pub(super) fn visible_pane_snapshot(&self) -> Option<Pane> {
        let session = self.visible_session_snapshot()?;
        let window_index = self
            .window_index
            .unwrap_or_else(|| session.active_window_index());
        let window = session.window_at(window_index)?;
        let pane_index = self
            .pane
            .map(Pane::index)
            .unwrap_or_else(|| window.active_pane_index());
        window.pane(pane_index).cloned()
    }
}

fn visible_session_size(
    options: Option<&OptionStore>,
    session: &Session,
    attached_count: usize,
) -> TerminalSize {
    let size = session.window().size();
    if size.cols == 0 || size.rows == 0 {
        return size;
    }
    if attached_count == 0 {
        return size;
    }

    let Some(options) = options else {
        return size;
    };

    if matches!(
        options.resolve(Some(session.name()), OptionName::Status),
        Some("off")
    ) {
        size
    } else {
        TerminalSize {
            cols: size.cols,
            rows: size.rows.saturating_sub(1),
        }
    }
}
