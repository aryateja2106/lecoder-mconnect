use serde::{Deserialize, Serialize};

/// The requested detached target type for tmux-style raw target lookup.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ResolveTargetType {
    /// Resolve to a session target.
    Session,
    /// Resolve to a window target.
    Window,
    /// Resolve to a pane target.
    Pane,
}

/// Internal request payload for tmux-style raw target resolution.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResolveTargetRequest {
    /// The raw `-s`/`-t` text exactly as typed by the caller.
    pub target: Option<String>,
    /// The detached target type requested by the caller.
    pub target_type: ResolveTargetType,
    /// Whether window slots should allow a nonexistent numeric index.
    #[serde(default)]
    pub window_index: bool,
    /// Whether detached resolution should prefer unattached sessions.
    #[serde(default)]
    pub prefer_unattached: bool,
}
