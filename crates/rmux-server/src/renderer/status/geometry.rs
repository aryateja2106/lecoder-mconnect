use rmux_core::{OptionStore, Session};
use rmux_proto::{OptionName, TerminalSize};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(in crate::renderer) struct StatusGeometry {
    pub(in crate::renderer) terminal_size: TerminalSize,
    pub(in crate::renderer) content_rows: u16,
    pub(in crate::renderer) content_y_offset: u16,
    pub(in crate::renderer) status_y: Option<u16>,
}

impl StatusGeometry {
    pub(in crate::renderer) fn for_session(session: &Session, options: &OptionStore) -> Self {
        let size = session.window().size();
        let status = options.resolve(Some(session.name()), OptionName::Status);
        if size.cols == 0 || size.rows == 0 || matches!(status, Some("off")) {
            return Self::without_status(size);
        }

        match options.resolve(Some(session.name()), OptionName::StatusPosition) {
            Some("top") => Self {
                terminal_size: size,
                content_rows: size.rows.saturating_sub(1),
                content_y_offset: 1,
                status_y: Some(0),
            },
            _ => Self {
                terminal_size: size,
                content_rows: size.rows.saturating_sub(1),
                content_y_offset: 0,
                status_y: Some(size.rows.saturating_sub(1)),
            },
        }
    }

    pub(in crate::renderer) const fn without_status(size: TerminalSize) -> Self {
        Self {
            terminal_size: size,
            content_rows: size.rows,
            content_y_offset: 0,
            status_y: None,
        }
    }

    pub(in crate::renderer) const fn content_size(self) -> TerminalSize {
        TerminalSize {
            cols: self.terminal_size.cols,
            rows: self.content_rows,
        }
    }
}
