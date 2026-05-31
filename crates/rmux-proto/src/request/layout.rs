use serde::{Deserialize, Serialize};

use crate::{LayoutName, SessionName, WindowTarget};

/// Target forms accepted by `select-layout`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum SelectLayoutTarget {
    /// Applies to the addressed session's single V1 window.
    Session(SessionName),
    /// Applies to the addressed V1 window target.
    Window(WindowTarget),
}

/// Request payload for `select-layout`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SelectLayoutRequest {
    /// The exact layout target.
    pub target: SelectLayoutTarget,
    /// The requested layout.
    pub layout: LayoutName,
}

/// Request payload for `select-layout` with a custom layout string.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SelectCustomLayoutRequest {
    /// The exact layout target.
    pub target: SelectLayoutTarget,
    /// The tmux custom layout string, including checksum.
    pub layout: String,
}

/// Request payload for `select-layout -o`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SelectOldLayoutRequest {
    /// The exact layout target.
    pub target: SelectLayoutTarget,
}

/// Request payload for `select-layout -E`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SpreadLayoutRequest {
    /// The exact layout target.
    pub target: SelectLayoutTarget,
}

/// Request payload for `next-layout`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NextLayoutRequest {
    /// The exact window target.
    pub target: WindowTarget,
}

/// Request payload for `previous-layout`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PreviousLayoutRequest {
    /// The exact window target.
    pub target: WindowTarget,
}
