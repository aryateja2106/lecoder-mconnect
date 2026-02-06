import Foundation

struct Session: Identifiable, Hashable, Codable {
    let id: String
    let hostId: String
    let userId: String
    var status: SessionStatus
    let createdAt: Date
    var lastActiveAt: Date

    enum SessionStatus: String, Codable {
        case active
        case idle
        case terminated
    }
}
