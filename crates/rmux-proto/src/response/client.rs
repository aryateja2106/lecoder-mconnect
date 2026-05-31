use serde::{Deserialize, Serialize};

use super::CommandOutput;
use crate::SessionName;

/// Response payload for `attach-session`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AttachSessionResponse {
    /// The session prepared for attach upgrade.
    pub session_name: SessionName,
}

/// Response payload for `switch-client`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SwitchClientResponse {
    /// The session chosen for the client.
    pub session_name: SessionName,
}

/// Response payload for `detach-client`.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct DetachClientResponse;

/// Response payload for `refresh-client`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RefreshClientResponse {
    /// The canonical target-client string that was refreshed.
    pub target_client: String,
}

/// Response payload for `list-clients`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ListClientsResponse {
    /// The rendered `list-clients` stdout payload.
    pub output: CommandOutput,
    /// The number of clients included in the rendered output.
    pub match_count: usize,
}

impl ListClientsResponse {
    /// Returns the rendered stdout payload.
    #[must_use]
    pub const fn command_output(&self) -> &CommandOutput {
        &self.output
    }
}

/// Response payload for `suspend-client`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SuspendClientResponse {
    /// The canonical target-client string that was suspended.
    pub target_client: String,
}
