use serde::{Deserialize, Serialize};

use crate::PaneTarget;

/// Request payload for `bind-key`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BindKeyRequest {
    /// The key table to update.
    pub table_name: String,
    /// The raw tmux key string.
    pub key: String,
    /// The optional binding note.
    pub note: Option<String>,
    /// Whether the binding should repeat.
    pub repeat: bool,
    /// Optional command tokens. `None` means modify the existing binding in place.
    pub command: Option<Vec<String>>,
}

/// Request payload for `unbind-key`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UnbindKeyRequest {
    /// The key table to update.
    pub table_name: String,
    /// Whether every binding in the table should be removed.
    pub all: bool,
    /// The optional key to remove.
    pub key: Option<String>,
    /// Whether missing-table and missing-key diagnostics should be suppressed.
    pub quiet: bool,
}

/// Request payload for `list-keys`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ListKeysRequest {
    /// The optional key table to list.
    pub table_name: Option<String>,
    /// Whether only the first matching entry should be returned.
    pub first_only: bool,
    /// Whether notes mode is active.
    pub notes: bool,
    /// Whether notes mode should include bindings without notes.
    pub include_unnoted: bool,
    /// Whether the listing should be reversed.
    pub reversed: bool,
    /// Optional custom output format.
    pub format: Option<String>,
    /// Optional sort-order token.
    pub sort_order: Option<String>,
    /// Optional literal prefix inserted before each rendered line.
    pub prefix: Option<String>,
    /// Optional key filter.
    pub key: Option<String>,
}

/// Request payload for `send-prefix`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SendPrefixRequest {
    /// The optional explicit pane target.
    pub target: Option<PaneTarget>,
    /// Whether `prefix2` should be used instead of `prefix`.
    pub secondary: bool,
}

/// Request payload for `copy-mode`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CopyModeRequest {
    /// The optional target pane. When omitted, the active pane is used.
    pub target: Option<PaneTarget>,
    /// Whether copy-mode should start one page down.
    #[serde(default)]
    pub page_down: bool,
    /// Whether scroll exit should be enabled when entering the mode.
    #[serde(default)]
    pub exit_on_scroll: bool,
    /// Whether the position indicator should be hidden.
    #[serde(default)]
    pub hide_position: bool,
    /// Whether the command originated from a mouse drag start.
    #[serde(default)]
    pub mouse_drag_start: bool,
    /// Whether all active pane modes should be cancelled instead of entering.
    #[serde(default)]
    pub cancel_mode: bool,
    /// Whether the command originated from scrollbar scrolling.
    #[serde(default)]
    pub scrollbar_scroll: bool,
    /// Optional source pane whose screen should back the copy-mode view.
    #[serde(default)]
    pub source: Option<PaneTarget>,
    /// Whether copy-mode should start one page up.
    #[serde(default)]
    pub page_up: bool,
}

/// Request payload for `clock-mode`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ClockModeRequest {
    /// The optional exact target pane. When omitted, the active pane is used.
    pub target: Option<PaneTarget>,
}
