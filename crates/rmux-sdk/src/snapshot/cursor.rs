use serde::{Deserialize, Serialize};

/// Captured cursor coordinates and rendering state.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PaneCursor {
    /// Zero-based cursor row within the visible pane.
    #[serde(default)]
    pub row: u16,
    /// Zero-based cursor column within the visible pane.
    #[serde(default)]
    pub col: u16,
    /// Whether the cursor is visible.
    #[serde(default = "default_cursor_visible")]
    pub visible: bool,
    /// Raw cursor style value.
    #[serde(default)]
    pub style: u32,
}

impl PaneCursor {
    /// Creates a cursor DTO from plain coordinates and state.
    #[must_use]
    pub const fn new(row: u16, col: u16, visible: bool, style: u32) -> Self {
        Self {
            row,
            col,
            visible,
            style,
        }
    }
}

impl Default for PaneCursor {
    fn default() -> Self {
        Self {
            row: 0,
            col: 0,
            visible: true,
            style: 0,
        }
    }
}

const fn default_cursor_visible() -> bool {
    true
}
