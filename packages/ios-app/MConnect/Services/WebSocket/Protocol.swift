import Foundation

// MARK: - Protocol Constants

/// Current WebSocket protocol version.
let protocolVersion = "3.0"

/// Rate limits for protocol operations.
enum ProtocolRateLimits {
    static let inputCharsPerSecond = 100
    static let controlRequestsPerWindow = 1
    static let controlRequestWindowMs = 10_000
    static let scrollbackRequestsPerSecond = 10
    static let mcpMessagesPerSecond = 20
    static let reconnectionAttemptsPerMinute = 5
}

// MARK: - Enums

/// Client device type.
enum ClientType: String, Codable {
    case mobile
    case desktop
    case web
}

/// Session state.
enum SessionState: String, Codable {
    case active
    case idle
    case terminated
}

/// Agent status.
enum AgentStatus: String, Codable {
    case creating
    case running
    case idle
    case stopped
    case error
}

/// Control state for input arbitration.
enum ControlState: String, Codable {
    case pcActive = "pc_active"
    case pcIdle = "pc_idle"
    case pcDisconnected = "pc_disconnected"
    case mobileExclusive = "mobile_exclusive"
}

/// Input rejection reasons.
enum InputRejectionReason: String, Codable {
    case pcTyping = "pc_typing"
    case otherExclusive = "other_exclusive"
    case rateLimited = "rate_limited"
    case readOnly = "read_only"
    case guardrailBlocked = "guardrail_blocked"
}

/// Control request action.
enum ControlAction: String, Codable {
    case exclusive
    case release
}

/// Auth failure reason.
enum AuthFailureReason: String, Codable {
    case invalidToken = "invalid_token"
    case expiredToken = "expired_token"
    case missingToken = "missing_token"
}

/// Protocol error codes.
enum ProtocolErrorCode: String, Codable {
    case authFailed = "AUTH_FAILED"
    case authExpired = "AUTH_EXPIRED"
    case sessionNotFound = "SESSION_NOT_FOUND"
    case sessionCompleted = "SESSION_COMPLETED"
    case notAttached = "NOT_ATTACHED"
    case rateLimited = "RATE_LIMITED"
    case guardrailBlocked = "GUARDRAIL_BLOCKED"
    case internalError = "INTERNAL_ERROR"
}

// MARK: - Info Types

/// Minimal session info returned in session lists.
struct SessionInfo: Codable, Identifiable, Equatable {
    let id: String
    let name: String?
    let state: SessionState
    let agentCount: Int
    let createdAt: Double
    let lastActivity: Double
}

/// Minimal agent info returned in agent lists.
struct AgentInfo: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let preset: String
    let status: AgentStatus
}

/// Minimal client info for presence notifications.
struct ClientInfo: Codable, Equatable {
    let clientId: String
    let clientType: ClientType
    let userId: String
}

// MARK: - Client → Server Messages

/// Authentication message — must be first message after connection.
struct AuthMessage: Codable {
    let type: String
    let token: String
    let protocolVersion: String
    let clientType: ClientType

    init(token: String, clientType: ClientType = .mobile) {
        self.type = "auth"
        self.token = token
        self.protocolVersion = MConnect.protocolVersion
        self.clientType = clientType
    }
}

/// Attach to a session.
struct SessionAttachMessage: Codable {
    let type: String
    let sessionId: String

    init(sessionId: String) {
        self.type = "session_attach"
        self.sessionId = sessionId
    }
}

/// Detach from current session.
struct SessionDetachMessage: Codable {
    let type: String

    init() {
        self.type = "session_detach"
    }
}

/// Send terminal input to an agent.
struct TerminalInputMessage: Codable {
    let type: String
    let agentId: String
    let data: String

    init(agentId: String, data: String) {
        self.type = "terminal_input"
        self.agentId = agentId
        self.data = data
    }
}

/// Resize terminal for an agent.
struct ResizeMessage: Codable {
    let type: String
    let agentId: String
    let cols: Int
    let rows: Int

    init(agentId: String, cols: Int, rows: Int) {
        self.type = "resize"
        self.agentId = agentId
        self.cols = cols
        self.rows = rows
    }
}

/// Request input control.
struct ControlRequestMessage: Codable {
    let type: String
    let action: ControlAction

    init(action: ControlAction) {
        self.type = "control_request"
        self.action = action
    }
}

/// Request scrollback history.
struct ScrollbackRequestMessage: Codable {
    let type: String
    let sessionId: String
    let fromLine: Int
    let count: Int

    init(sessionId: String, fromLine: Int, count: Int) {
        self.type = "scrollback_request"
        self.sessionId = sessionId
        self.fromLine = fromLine
        self.count = count
    }
}

/// Heartbeat acknowledgment.
struct HeartbeatAckMessage: Codable {
    let type: String
    let timestamp: Double

    init(timestamp: Double) {
        self.type = "heartbeat_ack"
        self.timestamp = timestamp
    }
}

/// Ping message.
struct PingMessage: Codable {
    let type: String

    init() {
        self.type = "ping"
    }
}

/// Request configured token/cost usage from the server.
struct UsageRequestMessage: Codable {
    let type: String

    init() {
        self.type = "usage_request"
    }
}

/// Device token registration for push notifications.
struct DeviceTokenRegisterMessage: Codable {
    let type: String
    let deviceToken: String
    let platform: String

    init(deviceToken: String, platform: String = "ios") {
        self.type = "device_token_register"
        self.deviceToken = deviceToken
        self.platform = platform
    }
}

// MARK: - Server → Client Messages

/// Authentication success response.
struct AuthSuccessResponse: Codable, Equatable {
    let type: String
    let clientId: String
    let protocolVersion: String
    let clientType: ClientType
    let userId: String
    let timestamp: Double
}

/// Authentication failure response.
struct AuthFailedResponse: Codable, Equatable {
    let type: String
    let reason: AuthFailureReason
    let retryable: Bool
    let timestamp: Double
}

/// List of available sessions.
struct SessionListResponse: Codable, Equatable {
    let type: String
    let sessions: [SessionInfo]
    let timestamp: Double
}

/// Session state update.
struct SessionStateResponse: Codable, Equatable {
    let type: String
    let sessionId: String
    let state: SessionState
    let lastActivity: Double
    let timestamp: Double
}

/// Terminal output from an agent.
struct TerminalOutputResponse: Codable, Equatable {
    let type: String
    let agentId: String
    let data: String
    let timestamp: Double
}

/// Agent status update.
struct AgentStatusResponse: Codable, Equatable {
    let type: String
    let agentId: String
    let status: AgentStatus
    let timestamp: Double
}

/// List of agents in session.
struct AgentListResponse: Codable, Equatable {
    let type: String
    let agents: [AgentInfo]
    let timestamp: Double
}

/// Control status update.
struct ControlStatusResponse: Codable, Equatable {
    let type: String
    let sessionId: String
    let state: ControlState
    let activeClient: String?
    let exclusiveExpires: Double?
    let lastPcActivity: Double?
    let timestamp: Double
}

/// Control request response.
struct ControlResponse: Codable, Equatable {
    let type: String
    let granted: Bool
    let reason: String?
    let expiresAt: Double?
    let timestamp: Double
}

/// Input rejection notification.
struct InputRejectedResponse: Codable, Equatable {
    let type: String
    let reason: InputRejectionReason
    let command: String?
    let timestamp: Double
}

/// Scrollback history response.
struct ScrollbackResponse: Codable, Equatable {
    let type: String
    let sessionId: String
    let lines: [String]
    let fromLine: Int
    let totalLines: Int
    let timestamp: Double
}

/// Client joined notification.
struct ClientJoinedResponse: Codable, Equatable {
    let type: String
    let client: ClientInfo
    let timestamp: Double
}

/// Client left notification.
struct ClientLeftResponse: Codable, Equatable {
    let type: String
    let clientId: String
    let timestamp: Double
}

/// Server heartbeat.
struct HeartbeatResponse: Codable, Equatable {
    let type: String
    let timestamp: Double
    let serverTime: Double
}

/// Pong response.
struct PongResponse: Codable, Equatable {
    let type: String
    let timestamp: Double
}

/// Configured token/cost usage snapshot.
struct UsageSnapshotResponse: Codable, Equatable {
    let type: String
    let usage: WatchUsageSnapshot
    let timestamp: Double
}

/// Protocol error message.
struct ErrorResponse: Codable, Equatable {
    let type: String
    let message: String
    let code: ProtocolErrorCode
    let retryable: Bool
    let retryAfterMs: Int?
    let timestamp: Double
}

// MARK: - Server Message Discriminator

/// Parsed server message — discriminated union over all server → client message types.
enum ServerMessage: Equatable {
    case authSuccess(AuthSuccessResponse)
    case authFailed(AuthFailedResponse)
    case sessionList(SessionListResponse)
    case sessionState(SessionStateResponse)
    case terminalOutput(TerminalOutputResponse)
    case agentStatus(AgentStatusResponse)
    case agentList(AgentListResponse)
    case controlStatus(ControlStatusResponse)
    case controlResponse(ControlResponse)
    case inputRejected(InputRejectedResponse)
    case scrollbackResponse(ScrollbackResponse)
    case clientJoined(ClientJoinedResponse)
    case clientLeft(ClientLeftResponse)
    case heartbeat(HeartbeatResponse)
    case pong(PongResponse)
    case usageSnapshot(UsageSnapshotResponse)
    case error(ErrorResponse)

    /// Parse a JSON data blob into a typed server message.
    static func parse(from data: Data) -> ServerMessage? {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = json["type"] as? String
        else {
            return nil
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        switch type {
        case "auth_success":
            guard let msg = try? decoder.decode(AuthSuccessResponse.self, from: data) else { return nil }
            return .authSuccess(msg)
        case "auth_failed":
            guard let msg = try? decoder.decode(AuthFailedResponse.self, from: data) else { return nil }
            return .authFailed(msg)
        case "session_list":
            guard let msg = try? decoder.decode(SessionListResponse.self, from: data) else { return nil }
            return .sessionList(msg)
        case "session_state":
            guard let msg = try? decoder.decode(SessionStateResponse.self, from: data) else { return nil }
            return .sessionState(msg)
        case "terminal_output":
            guard let msg = try? decoder.decode(TerminalOutputResponse.self, from: data) else { return nil }
            return .terminalOutput(msg)
        case "agent_status":
            guard let msg = try? decoder.decode(AgentStatusResponse.self, from: data) else { return nil }
            return .agentStatus(msg)
        case "agent_list":
            guard let msg = try? decoder.decode(AgentListResponse.self, from: data) else { return nil }
            return .agentList(msg)
        case "control_status":
            guard let msg = try? decoder.decode(ControlStatusResponse.self, from: data) else { return nil }
            return .controlStatus(msg)
        case "control_response":
            guard let msg = try? decoder.decode(ControlResponse.self, from: data) else { return nil }
            return .controlResponse(msg)
        case "input_rejected":
            guard let msg = try? decoder.decode(InputRejectedResponse.self, from: data) else { return nil }
            return .inputRejected(msg)
        case "scrollback_response":
            guard let msg = try? decoder.decode(ScrollbackResponse.self, from: data) else { return nil }
            return .scrollbackResponse(msg)
        case "client_joined":
            guard let msg = try? decoder.decode(ClientJoinedResponse.self, from: data) else { return nil }
            return .clientJoined(msg)
        case "client_left":
            guard let msg = try? decoder.decode(ClientLeftResponse.self, from: data) else { return nil }
            return .clientLeft(msg)
        case "heartbeat":
            guard let msg = try? decoder.decode(HeartbeatResponse.self, from: data) else { return nil }
            return .heartbeat(msg)
        case "pong":
            guard let msg = try? decoder.decode(PongResponse.self, from: data) else { return nil }
            return .pong(msg)
        case "usage_snapshot":
            guard let msg = try? decoder.decode(UsageSnapshotResponse.self, from: data) else { return nil }
            return .usageSnapshot(msg)
        case "error":
            guard let msg = try? decoder.decode(ErrorResponse.self, from: data) else { return nil }
            return .error(msg)
        default:
            return nil
        }
    }
}
