import Foundation

enum WatchDeviceClass: String, Codable, Equatable {
    case watch
    case phone
    case iPad
}

enum WatchConnectionState: String, Codable, Equatable {
    case disconnected
    case connecting
    case authenticating
    case connected
    case reconnecting
    case waitingForNetwork

    init(_ state: ConnectionState) {
        switch state {
        case .disconnected:
            self = .disconnected
        case .connecting:
            self = .connecting
        case .authenticating:
            self = .authenticating
        case .connected:
            self = .connected
        case .reconnecting:
            self = .reconnecting
        case .waitingForNetwork:
            self = .waitingForNetwork
        }
    }
}

struct WatchUsageSnapshot: Codable, Equatable {
    var promptTokens: Int?
    var completionTokens: Int?
    var totalTokens: Int?
    var costUsd: Double?
    var window: String?
    var model: String?
    var updatedAt: Date?
    var errorMessage: String?

    static func unavailable(_ message: String) -> WatchUsageSnapshot {
        WatchUsageSnapshot(errorMessage: message)
    }
}

enum UsageCommandParser {
    static func snapshot(from stdout: String) -> WatchUsageSnapshot {
        let trimmed = stdout.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let data = trimmed.data(using: .utf8), !data.isEmpty else {
            return .unavailable("Usage command returned no output")
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        do {
            return try decoder.decode(WatchUsageSnapshot.self, from: data)
        } catch {
            return .unavailable("Usage command returned invalid JSON")
        }
    }
}

enum WatchCommandKind: String, Codable, Equatable {
    case dictation
    case quickPrompt
    case quickAction
}

struct WatchCommandDraft: Identifiable, Codable, Equatable {
    let id: UUID
    var kind: WatchCommandKind
    var text: String
    var createdAt: Date

    init(
        id: UUID = UUID(),
        kind: WatchCommandKind,
        text: String,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.kind = kind
        self.text = text
        self.createdAt = createdAt
    }
}

struct WatchCommandContext: Codable, Equatable {
    var deviceClass: WatchDeviceClass
    var hostName: String
    var sessionId: String?
    var agentName: String?
    var requiresConciseResponse: Bool
}

enum WatchCommandQueue {
    static func terminalInput(for draft: WatchCommandDraft, context: WatchCommandContext) -> String {
        let request = draft.text.trimmingCharacters(in: .whitespacesAndNewlines)
        let device = context.deviceClass == .watch ? "Apple Watch" : "mobile device"
        let agentName = context.agentName ?? "the active agent"
        let session = context.sessionId.map { " Session: \($0)." } ?? ""
        let responseStyle = context.requiresConciseResponse
            ? " Please respond concisely and ask only essential clarification questions."
            : ""

        return """
        [MConnect mobile context]
        User is speaking from \(device), likely on the go. Host: \(context.hostName). Target: \(agentName).\(session)\(responseStyle)

        User request:
        \(request)
        """
        + "\n"
    }
}

struct WatchAgentSummary: Identifiable, Codable, Equatable {
    let id: String
    var name: String
    var preset: String
    var status: AgentStatus

    init(_ agent: AgentInfo) {
        self.id = agent.id
        self.name = agent.name
        self.preset = agent.preset
        self.status = agent.status
    }
}

struct WatchSessionSummary: Codable, Equatable {
    var hostName: String
    var sessionId: String?
    var connectionState: WatchConnectionState
    var agents: [AgentInfo]
    var activeAgentId: String?
    var usage: WatchUsageSnapshot
    var lastActivity: Date?

    var activeAgent: AgentInfo? {
        guard let activeAgentId else { return agents.first }
        return agents.first { $0.id == activeAgentId }
    }

    static let empty = WatchSessionSummary(
        hostName: "No active host",
        sessionId: nil,
        connectionState: .disconnected,
        agents: [],
        activeAgentId: nil,
        usage: .unavailable("No active usage source"),
        lastActivity: nil
    )
}
