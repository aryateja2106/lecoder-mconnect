import Foundation
import SwiftUI

struct Session: Identifiable, Hashable, Codable {
    let id: String
    let hostId: String
    let userId: String
    var status: SessionState
    let createdAt: Date
    var lastActiveAt: Date
    var agentCount: Int

    init(
        id: String = UUID().uuidString,
        hostId: String,
        userId: String,
        status: SessionState = .active,
        createdAt: Date = Date(),
        lastActiveAt: Date = Date(),
        agentCount: Int = 0
    ) {
        self.id = id
        self.hostId = hostId
        self.userId = userId
        self.status = status
        self.createdAt = createdAt
        self.lastActiveAt = lastActiveAt
        self.agentCount = agentCount
    }

    /// Create from protocol `SessionInfo`.
    init(from info: SessionInfo, hostId: String, userId: String) {
        self.id = info.id
        self.hostId = hostId
        self.userId = userId
        self.status = info.state
        self.createdAt = Date(timeIntervalSince1970: info.createdAt)
        self.lastActiveAt = Date(timeIntervalSince1970: info.lastActivity)
        self.agentCount = info.agentCount ?? 0
    }
}

// MARK: - SessionState UI Extensions

extension SessionState {
    var displayName: String {
        switch self {
        case .active: return "Active"
        case .idle: return "Idle"
        case .terminated: return "Terminated"
        }
    }

    var iconName: String {
        switch self {
        case .active: return "circle.fill"
        case .idle: return "circle"
        case .terminated: return "xmark.circle"
        }
    }

    var color: Color {
        switch self {
        case .active: return .green
        case .idle: return .blue
        case .terminated: return .gray
        }
    }
}
