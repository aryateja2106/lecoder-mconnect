import Foundation

struct VaultItem: Identifiable, Hashable, Codable {
    let id: String
    var label: String
    var category: Category
    let createdAt: Date
    var updatedAt: Date

    enum Category: String, Codable, CaseIterable {
        case apiKey = "api_key"
        case oauthToken = "oauth_token"
        case sshKey = "ssh_key"
        case password
        case certificate
        case other

        var displayName: String {
            switch self {
            case .apiKey: return "API Key"
            case .oauthToken: return "OAuth Token"
            case .sshKey: return "SSH Key"
            case .password: return "Password"
            case .certificate: return "Certificate"
            case .other: return "Other"
            }
        }

        var iconName: String {
            switch self {
            case .apiKey: return "key"
            case .oauthToken: return "person.badge.key"
            case .sshKey: return "lock.laptopcomputer"
            case .password: return "lock"
            case .certificate: return "checkmark.seal"
            case .other: return "ellipsis.circle"
            }
        }
    }

    init(
        id: String = UUID().uuidString,
        label: String,
        category: Category,
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.label = label
        self.category = category
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}
