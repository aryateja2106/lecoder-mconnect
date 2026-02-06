import Foundation

struct Session: Identifiable, Hashable, Codable {
    let id: String
    let hostId: String
    let userId: String
    var status: SessionState
    let createdAt: Date
    var lastActiveAt: Date
}
