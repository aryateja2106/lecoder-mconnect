use serde::{Deserialize, Serialize};

/// Response payload for internal detached target resolution.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResolveTargetResponse {
    /// The fully resolved exact target.
    pub target: crate::Target,
}
