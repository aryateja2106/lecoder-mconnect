use serde::{Deserialize, Serialize};

use super::CommandOutput;
use crate::{LayoutName, SessionName, TerminalSize, WindowTarget};

/// Response payload for `new-window`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NewWindowResponse {
    /// The newly created window target.
    pub target: WindowTarget,
}

/// Response payload for `kill-window`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct KillWindowResponse {
    /// The surviving active window after the kill completes.
    pub target: WindowTarget,
}

/// Response payload for `select-window`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SelectWindowResponse {
    /// The window that became active.
    pub target: WindowTarget,
}

/// Response payload for `rename-window`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RenameWindowResponse {
    /// The renamed window target.
    pub target: WindowTarget,
}

/// Response payload for `next-window`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NextWindowResponse {
    /// The window that became active.
    pub target: WindowTarget,
}

/// Response payload for `previous-window`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PreviousWindowResponse {
    /// The window that became active.
    pub target: WindowTarget,
}

/// Response payload for `last-window`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LastWindowResponse {
    /// The window that became active.
    pub target: WindowTarget,
}

/// Structured list-windows entry data paired with rendered stdout.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WindowListEntry {
    /// The exact window target for the entry.
    pub target: WindowTarget,
    /// The stable tmux-style window identifier such as `@3`.
    pub window_id: String,
    /// The user-visible window name when one exists.
    pub name: Option<String>,
    /// The number of panes in the window.
    pub pane_count: u32,
    /// The current window dimensions.
    pub size: TerminalSize,
    /// The active layout recorded for the window.
    pub layout: LayoutName,
    /// Whether the window is currently active in the session.
    pub active: bool,
    /// Whether the window is the session's last-active window.
    pub last: bool,
    /// The exact rendered line contributed to command stdout.
    pub rendered: String,
}

/// Response payload for `list-windows`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ListWindowsResponse {
    /// The structured window data emitted by the server.
    pub windows: Vec<WindowListEntry>,
    /// The pre-rendered stdout bytes for the CLI.
    pub output: CommandOutput,
}

impl ListWindowsResponse {
    /// Returns the reusable stdout payload for the list command.
    #[must_use]
    pub fn command_output(&self) -> &CommandOutput {
        &self.output
    }
}

/// Response payload for `link-window`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LinkWindowResponse {
    /// The linked destination slot.
    pub target: WindowTarget,
}

/// Response payload for `move-window`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MoveWindowResponse {
    /// The session affected by the operation.
    pub session_name: SessionName,
    /// The moved window target when one specific window was relocated.
    pub target: Option<WindowTarget>,
}

/// Response payload for `swap-window`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SwapWindowResponse {
    /// The source slot involved in the swap.
    pub source: WindowTarget,
    /// The target slot involved in the swap.
    pub target: WindowTarget,
}

/// Response payload for `rotate-window`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RotateWindowResponse {
    /// The window whose pane positions were rotated.
    pub target: WindowTarget,
}

/// Response payload for `resize-window`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResizeWindowResponse {
    /// The resized window target.
    pub target: WindowTarget,
}

/// Response payload for `respawn-window`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RespawnWindowResponse {
    /// The respawned window target.
    pub target: WindowTarget,
}

/// Response payload for `unlink-window`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UnlinkWindowResponse {
    /// The surviving active window after the unlink completes.
    pub target: WindowTarget,
}
