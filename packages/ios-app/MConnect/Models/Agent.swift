import Foundation
import SwiftUI

struct Agent: Identifiable, Hashable, Codable {
    let id: String
    var name: String
    var preset: String
    var status: AgentStatus
    var sessionId: String?
    let createdAt: Date

    enum AgentStatus: String, Codable, CaseIterable {
        case creating
        case running
        case idle
        case stopped
        case error

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
    }
}
