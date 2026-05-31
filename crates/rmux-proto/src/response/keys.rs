use serde::{Deserialize, Serialize};

use super::CommandOutput;
use crate::PaneTarget;

/// Response payload for `bind-key`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BindKeyResponse {
    /// The mutated key table.
    pub table_name: String,
    /// The canonical key string stored in the table.
    pub key: String,
}

/// Response payload for `unbind-key`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UnbindKeyResponse {
    /// The mutated key table.
    pub table_name: String,
    /// The optional canonical key string that was addressed.
    pub key: Option<String>,
    /// Whether any active binding was removed.
    pub removed: bool,
    /// Whether the request operated on the whole table.
    pub all: bool,
}

/// Response payload for `list-keys`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ListKeysResponse {
    /// The rendered `list-keys` stdout payload.
    pub output: CommandOutput,
    /// The number of bindings included in the rendered output.
    pub match_count: usize,
}

impl ListKeysResponse {
    /// Returns the rendered stdout payload.
    #[must_use]
    pub const fn command_output(&self) -> &CommandOutput {
        &self.output
    }
}

/// Response payload for `send-prefix`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SendPrefixResponse {
    /// The pane that received the prefix key when one was resolved.
    pub target: Option<PaneTarget>,
    /// The canonical tmux key string that was injected.
    pub key: String,
    /// The number of key tokens accepted by the server.
    pub key_count: usize,
}

/// Response payload for `copy-mode`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CopyModeResponse {
    /// The pane whose mode state changed.
    pub target: PaneTarget,
    /// Whether copy-mode remains active after the command.
    pub active: bool,
    /// Whether the pane is currently in read-only view mode.
    pub view_mode: bool,
}

/// Response payload for `clock-mode`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ClockModeResponse {
    /// The exact pane now in clock mode.
    pub target: PaneTarget,
    /// Whether clock mode is active after the request.
    pub active: bool,
}
