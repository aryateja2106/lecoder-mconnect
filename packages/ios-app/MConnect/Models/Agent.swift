import Foundation
import SwiftUI

struct Agent: Identifiable, Hashable, Codable {
    let id: String
    var name: String
    var preset: String
    var status: AgentStatus
    var sessionId: String?
    let createdAt: Date

    init(
        id: String = UUID().uuidString,
        name: String,
        preset: String,
        status: AgentStatus = .creating,
        sessionId: String? = nil,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.preset = preset
        self.status = status
        self.sessionId = sessionId
        self.createdAt = createdAt
    }

    /// Create from protocol `AgentInfo`.
    init(from info: AgentInfo, sessionId: String? = nil) {
        self.id = info.id
        self.name = info.name
        self.preset = info.preset
        self.status = info.status
        self.sessionId = sessionId
        self.createdAt = Date()
    }
}

// MARK: - AgentStatus UI Extensions

extension AgentStatus: CaseIterable {
    static var allCases: [AgentStatus] {
        [.creating, .running, .idle, .stopped, .error]
    }

    var displayName: String {
        switch self {
        case .creating: return "Creating"
        case .running: return "Running"
        case .idle: return "Idle"
        case .stopped: return "Stopped"
        case .error: return "Error"
        }
    }

    var iconName: String {
        switch self {
        case .creating: return "circle.dashed"
        case .running: return "circle.fill"
        case .idle: return "circle"
        case .stopped: return "stop.circle"
        case .error: return "exclamationmark.circle"
        }
    }

    var color: Color {
        switch self {
        case .creating: return .orange
        case .running: return .green
        case .idle: return .blue
        case .stopped: return .gray
        case .error: return .red
        }
    }

    /// Whether the agent can be started.
    var canStart: Bool {
        self == .stopped || self == .error
    }

    /// Whether the agent can be stopped.
    var canStop: Bool {
        self == .running || self == .idle || self == .creating
    }
}
