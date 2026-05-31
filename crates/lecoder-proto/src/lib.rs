//! LeCoder MConnect v3 wire protocol.
//!
//! The **authoritative contract is the iOS Swift app**
//! (`packages/ios-app/MConnect/Services/WebSocket/Protocol.swift`), NOT the prose
//! `docs/protocol/v3.md`, which has drifted. Every type here is shaped to (de)serialize
//! to the exact JSON the shipped iOS app emits and decodes.
//!
//! Scope note: MCP forwarding and push-notification payloads are intentionally absent —
//! they are not part of the Swift `ServerMessage` union and are out of scope for Slice 1.
#![forbid(unsafe_code)]

use serde::{Deserialize, Serialize};

/// Protocol version string carried in `auth` / `auth_success`.
pub const PROTOCOL_VERSION: &str = "3.0";

/// Rate limits, mirrored verbatim from `ProtocolRateLimits` in `Protocol.swift`.
pub mod rate_limits {
    /// Max terminal-input characters accepted per second.
    pub const INPUT_CHARS_PER_SECOND: u32 = 100;
    /// Allowed control requests per window.
    pub const CONTROL_REQUESTS_PER_WINDOW: u32 = 1;
    /// Control-request window length in milliseconds.
    pub const CONTROL_REQUEST_WINDOW_MS: u64 = 10_000;
    /// Max scrollback requests per second.
    pub const SCROLLBACK_REQUESTS_PER_SECOND: u32 = 10;
    /// Max MCP messages per second (reserved; MCP deferred past Slice 1).
    pub const MCP_MESSAGES_PER_SECOND: u32 = 20;
    /// Max reconnection attempts per minute.
    pub const RECONNECTION_ATTEMPTS_PER_MINUTE: u32 = 5;
}

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/// Client device type (`mobile` | `desktop` | `web`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ClientType {
    /// A phone / tablet client.
    Mobile,
    /// A desktop client (the "PC" in arbitration).
    Desktop,
    /// A browser client.
    Web,
}

/// Session lifecycle state (`active` | `idle` | `terminated`).
///
/// NOTE: these are the Swift values. The prose `v3.md` incorrectly says
/// running/paused/completed — do not use those.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SessionState {
    /// Session is live and recently active.
    Active,
    /// Session is live but idle.
    Idle,
    /// Session has ended (terminal state).
    Terminated,
}

/// Agent status (`creating` | `running` | `idle` | `stopped` | `error`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentStatus {
    /// Agent process is being spawned.
    Creating,
    /// Agent process is running.
    Running,
    /// Agent process is alive but idle.
    Idle,
    /// Agent process has stopped.
    Stopped,
    /// Agent process errored.
    Error,
}

/// Control state for input arbitration.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ControlState {
    /// PC client is actively typing.
    PcActive,
    /// PC client is connected but idle.
    PcIdle,
    /// No PC client is connected.
    PcDisconnected,
    /// A mobile client holds exclusive control.
    MobileExclusive,
}

/// Reason an input was rejected.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InputRejectionReason {
    /// The PC client is actively typing.
    PcTyping,
    /// Another client holds exclusive control.
    OtherExclusive,
    /// Input exceeded a rate limit.
    RateLimited,
    /// The session is read-only for this client.
    ReadOnly,
    /// A guardrail blocked the command.
    GuardrailBlocked,
}

/// Control request action (`exclusive` | `release`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ControlAction {
    /// Request exclusive control.
    Exclusive,
    /// Release exclusive control.
    Release,
}

/// Auth failure reason.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthFailureReason {
    /// Token was present but invalid.
    InvalidToken,
    /// Token was valid but expired.
    ExpiredToken,
    /// No token was supplied.
    MissingToken,
}

/// Protocol error codes (SCREAMING_SNAKE_CASE on the wire).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ProtocolErrorCode {
    /// Authentication failed.
    AuthFailed,
    /// Authentication expired mid-session.
    AuthExpired,
    /// Referenced session does not exist.
    SessionNotFound,
    /// Referenced session has completed.
    SessionCompleted,
    /// Operation requires an attached session.
    NotAttached,
    /// A rate limit was exceeded.
    RateLimited,
    /// A guardrail blocked the operation.
    GuardrailBlocked,
    /// Unexpected internal error.
    InternalError,
}

impl ProtocolErrorCode {
    /// Whether a client should retry after receiving this code.
    ///
    /// Mirrors the v3 error table: transient/auth-expiry conditions are retryable;
    /// "not found"/"completed"/"failed" are terminal for that request.
    pub fn retryable(self) -> bool {
        match self {
            ProtocolErrorCode::AuthExpired
            | ProtocolErrorCode::RateLimited
            | ProtocolErrorCode::InternalError
            | ProtocolErrorCode::NotAttached => true,
            ProtocolErrorCode::AuthFailed
            | ProtocolErrorCode::SessionNotFound
            | ProtocolErrorCode::SessionCompleted
            | ProtocolErrorCode::GuardrailBlocked => false,
        }
    }
}

// ---------------------------------------------------------------------------
// Info / nested types
// ---------------------------------------------------------------------------

/// Minimal session summary returned in session lists.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    /// Stable session id (ULID/UUID string).
    pub id: String,
    /// Optional human-friendly name.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub name: Option<String>,
    /// Current lifecycle state.
    pub state: SessionState,
    /// Number of agents in the session.
    pub agent_count: u32,
    /// Creation time (epoch milliseconds).
    pub created_at: f64,
    /// Last-activity time (epoch milliseconds).
    pub last_activity: f64,
}

/// Minimal agent summary returned in agent lists.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentInfo {
    /// Stable agent id.
    pub id: String,
    /// Human-friendly name.
    pub name: String,
    /// Preset the agent was created from (NOTE: Swift field is `preset`, not `type`).
    pub preset: String,
    /// Current status.
    pub status: AgentStatus,
}

/// Minimal client identity for presence notifications.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientInfo {
    /// Server-assigned client id.
    pub client_id: String,
    /// Client device type.
    pub client_type: ClientType,
    /// Owning user id.
    pub user_id: String,
}

// ---------------------------------------------------------------------------
// Client -> Server messages
// ---------------------------------------------------------------------------

/// Messages a client sends to the server. Internally tagged by `type`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    /// Authentication — must be the first message after connect.
    Auth {
        /// Bearer token (JWT).
        token: String,
        /// Protocol version the client speaks.
        #[serde(rename = "protocolVersion")]
        protocol_version: String,
        /// Client device type.
        #[serde(rename = "clientType")]
        client_type: ClientType,
    },
    /// Attach to an existing session.
    SessionAttach {
        /// Target session id.
        #[serde(rename = "sessionId")]
        session_id: String,
    },
    /// Detach from the current session.
    SessionDetach,
    /// Send terminal input to an agent.
    TerminalInput {
        /// Target agent id.
        #[serde(rename = "agentId")]
        agent_id: String,
        /// Raw input bytes as a UTF-8 string.
        data: String,
    },
    /// Resize an agent's terminal.
    Resize {
        /// Target agent id.
        #[serde(rename = "agentId")]
        agent_id: String,
        /// New column count.
        cols: u16,
        /// New row count.
        rows: u16,
    },
    /// Request or release input control.
    ControlRequest {
        /// Requested action.
        action: ControlAction,
    },
    /// Request a slice of scrollback history.
    ScrollbackRequest {
        /// Session whose scrollback is requested.
        #[serde(rename = "sessionId")]
        session_id: String,
        /// First absolute line to return.
        #[serde(rename = "fromLine")]
        from_line: u64,
        /// Number of lines to return.
        count: u64,
    },
    /// Acknowledge a server heartbeat.
    HeartbeatAck {
        /// Echoed heartbeat timestamp.
        timestamp: f64,
    },
    /// Liveness ping.
    Ping,
    /// Register an APNs/device token for push.
    DeviceTokenRegister {
        /// Opaque device token.
        #[serde(rename = "deviceToken")]
        device_token: String,
        /// Platform string (e.g. "ios").
        platform: String,
    },
}

/// Outcome of tolerantly parsing an inbound client message.
///
/// The daemon must never crash on a newer or malformed client, so unknown `type`
/// values and malformed payloads are surfaced as data, not panics.
#[derive(Debug, Clone, PartialEq)]
pub enum ClientParse {
    /// A recognized, well-formed message.
    Known(ClientMessage),
    /// A well-formed JSON object with an unrecognized `type`.
    Unknown {
        /// The unrecognized type tag.
        message_type: String,
        /// The raw JSON value, preserved.
        raw: serde_json::Value,
    },
    /// JSON that is not a tagged object, or a known type with a bad/missing field.
    Invalid {
        /// Human-readable reason.
        reason: String,
    },
}

/// The set of `type` tags this build recognizes for client messages.
const KNOWN_CLIENT_TYPES: &[&str] = &[
    "auth",
    "session_attach",
    "session_detach",
    "terminal_input",
    "resize",
    "control_request",
    "scrollback_request",
    "heartbeat_ack",
    "ping",
    "device_token_register",
];

impl ClientMessage {
    /// Tolerantly parse an inbound client message from a JSON string.
    ///
    /// - Unknown `type` -> [`ClientParse::Unknown`] (no error).
    /// - Missing `type` / non-object / bad field -> [`ClientParse::Invalid`].
    /// - Otherwise -> [`ClientParse::Known`].
    pub fn parse(input: &str) -> ClientParse {
        let value: serde_json::Value = match serde_json::from_str(input) {
            Ok(v) => v,
            Err(e) => return ClientParse::Invalid { reason: e.to_string() },
        };
        let Some(message_type) = value.get("type").and_then(|t| t.as_str()) else {
            return ClientParse::Invalid {
                reason: "missing or non-string `type` field".to_string(),
            };
        };
        if !KNOWN_CLIENT_TYPES.contains(&message_type) {
            return ClientParse::Unknown {
                message_type: message_type.to_string(),
                raw: value,
            };
        }
        match serde_json::from_value::<ClientMessage>(value) {
            Ok(msg) => ClientParse::Known(msg),
            Err(e) => ClientParse::Invalid { reason: e.to_string() },
        }
    }
}

// ---------------------------------------------------------------------------
// Server -> Client messages
// ---------------------------------------------------------------------------

/// Messages the server sends to a client. Internally tagged by `type`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    /// Authentication succeeded.
    AuthSuccess {
        /// Assigned client id.
        #[serde(rename = "clientId")]
        client_id: String,
        /// Negotiated protocol version.
        #[serde(rename = "protocolVersion")]
        protocol_version: String,
        /// Echoed client type.
        #[serde(rename = "clientType")]
        client_type: ClientType,
        /// Authenticated user id.
        #[serde(rename = "userId")]
        user_id: String,
        /// Server timestamp (epoch ms).
        timestamp: f64,
    },
    /// Authentication failed.
    AuthFailed {
        /// Failure reason.
        reason: AuthFailureReason,
        /// Whether the client should retry.
        retryable: bool,
        /// Server timestamp (epoch ms).
        timestamp: f64,
    },
    /// List of available sessions.
    SessionList {
        /// The sessions.
        sessions: Vec<SessionInfo>,
        /// Server timestamp (epoch ms).
        timestamp: f64,
    },
    /// A session state update.
    SessionState {
        /// Session id.
        #[serde(rename = "sessionId")]
        session_id: String,
        /// New state.
        state: SessionState,
        /// Last-activity time (epoch ms).
        #[serde(rename = "lastActivity")]
        last_activity: f64,
        /// Server timestamp (epoch ms).
        timestamp: f64,
    },
    /// Terminal output from an agent.
    TerminalOutput {
        /// Source agent id.
        #[serde(rename = "agentId")]
        agent_id: String,
        /// Raw output bytes as a UTF-8 (lossy) string.
        data: String,
        /// Server timestamp (epoch ms).
        timestamp: f64,
    },
    /// An agent status update.
    AgentStatus {
        /// Agent id.
        #[serde(rename = "agentId")]
        agent_id: String,
        /// New status.
        status: AgentStatus,
        /// Server timestamp (epoch ms).
        timestamp: f64,
    },
    /// List of agents in the attached session.
    AgentList {
        /// The agents.
        agents: Vec<AgentInfo>,
        /// Server timestamp (epoch ms).
        timestamp: f64,
    },
    /// Control-state update.
    ControlStatus {
        /// Session id.
        #[serde(rename = "sessionId")]
        session_id: String,
        /// Current control state.
        state: ControlState,
        /// Client currently holding focus, if any.
        #[serde(rename = "activeClient", skip_serializing_if = "Option::is_none", default)]
        active_client: Option<String>,
        /// When exclusive control expires (epoch ms), if applicable.
        #[serde(rename = "exclusiveExpires", skip_serializing_if = "Option::is_none", default)]
        exclusive_expires: Option<f64>,
        /// Last PC activity time (epoch ms), if known.
        #[serde(rename = "lastPcActivity", skip_serializing_if = "Option::is_none", default)]
        last_pc_activity: Option<f64>,
        /// Server timestamp (epoch ms).
        timestamp: f64,
    },
    /// Response to a control request.
    ControlResponse {
        /// Whether the request was granted.
        granted: bool,
        /// Optional reason string.
        #[serde(skip_serializing_if = "Option::is_none", default)]
        reason: Option<String>,
        /// When granted control expires (epoch ms), if applicable.
        #[serde(rename = "expiresAt", skip_serializing_if = "Option::is_none", default)]
        expires_at: Option<f64>,
        /// Server timestamp (epoch ms).
        timestamp: f64,
    },
    /// An input was rejected.
    InputRejected {
        /// Why it was rejected.
        reason: InputRejectionReason,
        /// The offending command, if surfaced.
        #[serde(skip_serializing_if = "Option::is_none", default)]
        command: Option<String>,
        /// Server timestamp (epoch ms).
        timestamp: f64,
    },
    /// Scrollback history slice.
    ScrollbackResponse {
        /// Session id.
        #[serde(rename = "sessionId")]
        session_id: String,
        /// Returned lines.
        lines: Vec<String>,
        /// Absolute line number of the first returned line.
        #[serde(rename = "fromLine")]
        from_line: u64,
        /// Total lines ever produced (for pagination).
        #[serde(rename = "totalLines")]
        total_lines: u64,
        /// Server timestamp (epoch ms).
        timestamp: f64,
    },
    /// A client joined the session.
    ClientJoined {
        /// The joining client.
        client: ClientInfo,
        /// Server timestamp (epoch ms).
        timestamp: f64,
    },
    /// A client left the session.
    ClientLeft {
        /// The departing client's id.
        #[serde(rename = "clientId")]
        client_id: String,
        /// Server timestamp (epoch ms).
        timestamp: f64,
    },
    /// Server heartbeat.
    Heartbeat {
        /// Heartbeat timestamp (epoch ms).
        timestamp: f64,
        /// Server wall-clock time (epoch ms).
        #[serde(rename = "serverTime")]
        server_time: f64,
    },
    /// Liveness pong.
    Pong {
        /// Echoed timestamp (epoch ms).
        timestamp: f64,
    },
    /// A protocol error.
    Error {
        /// Human-readable message.
        message: String,
        /// Machine error code.
        code: ProtocolErrorCode,
        /// Whether the client should retry.
        retryable: bool,
        /// Suggested retry delay in ms, if any.
        #[serde(rename = "retryAfterMs", skip_serializing_if = "Option::is_none", default)]
        retry_after_ms: Option<u64>,
        /// Server timestamp (epoch ms).
        timestamp: f64,
    },
}
