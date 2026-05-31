use serde::{Deserialize, Serialize};

use super::CommandOutput;
use crate::SessionName;

/// Response payload for `new-session`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NewSessionResponse {
    /// The created session name.
    pub session_name: SessionName,
    /// Whether the server left the session detached.
    pub detached: bool,
    /// Optional printable output for `new-session -P`.
    #[serde(default)]
    pub output: Option<CommandOutput>,
}

impl NewSessionResponse {
    /// Returns the optional printable session output.
    #[must_use]
    pub const fn command_output(&self) -> Option<&CommandOutput> {
        self.output.as_ref()
    }
}

/// Response payload for `has-session`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct HasSessionResponse {
    /// Whether the target session exists.
    pub exists: bool,
}

/// Response payload for `kill-session`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct KillSessionResponse {
    /// Whether a session existed and was removed.
    pub existed: bool,
}

/// Response payload for creating an app-owner session lease.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct CreateSessionLeaseResponse {
    /// Server-issued lease token.
    pub token: u64,
    /// Effective lease time-to-live in milliseconds.
    pub ttl_millis: u64,
}

/// Response payload for renewing an app-owner session lease.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct RenewSessionLeaseResponse {
    /// Whether the lease was renewed.
    pub renewed: bool,
}

/// Response payload for releasing an app-owner session lease.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReleaseSessionLeaseResponse {
    /// Whether a matching lease was released.
    pub released: bool,
}

/// Response payload for `rename-session`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RenameSessionResponse {
    /// The renamed session name after the operation succeeds.
    pub session_name: SessionName,
}

/// Response payload for `list-sessions`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ListSessionsResponse {
    /// The pre-rendered stdout bytes for the CLI.
    pub output: CommandOutput,
}

impl ListSessionsResponse {
    /// Returns the reusable stdout payload for the list command.
    #[must_use]
    pub fn command_output(&self) -> &CommandOutput {
        &self.output
    }
}
