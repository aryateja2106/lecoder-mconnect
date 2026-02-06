import Foundation

/// WebSocket protocol v3 message types.
enum WSMessageType: String, Codable {
    // Client -> Server
    case auth
    case input
    case resize
    case heartbeatAck = "heartbeat_ack"
    case agentCreate = "agent_create"
    case agentStart = "agent_start"
    case agentStop = "agent_stop"

    // Server -> Client
    case authSuccess = "auth_success"
    case authError = "auth_error"
    case output
    case sessionState = "session_state"
    case agentStatus = "agent_status"
    case heartbeat
    case inputRejected = "input_rejected"
    case error
}

struct WSMessage: Codable {
    let type: WSMessageType
    let data: AnyCodable?
    let agentId: String?
    let sessionId: String?
    let timestamp: Date?

    init(type: WSMessageType, data: AnyCodable? = nil, agentId: String? = nil, sessionId: String? = nil) {
        self.type = type
        self.data = data
        self.agentId = agentId
        self.sessionId = sessionId
        self.timestamp = Date()
    }
}

/// Type-erased Codable wrapper for dynamic JSON values.
struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let string = try? container.decode(String.self) {
            value = string
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues(\.value)
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map(\.value)
        } else {
            value = NSNull()
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case let string as String:
            try container.encode(string)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let bool as Bool:
            try container.encode(bool)
        default:
            try container.encodeNil()
        }
    }
}
