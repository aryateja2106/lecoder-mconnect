import Foundation
import SwiftUI

struct Host: Identifiable, Hashable, Codable {
    let id: String
    var name: String
    var hostname: String
    var port: Int
    var useTLS: Bool
    var requireBiometric: Bool
    var isConnected: Bool
    var accessToken: String?

    init(
        id: String = UUID().uuidString,
        name: String,
        hostname: String,
        port: Int = 8080,
        useTLS: Bool = true,
        requireBiometric: Bool = false,
        isConnected: Bool = false,
        accessToken: String? = nil
    ) {
        self.id = id
        self.name = name
        self.hostname = hostname
        self.port = port
        self.useTLS = useTLS
        self.requireBiometric = requireBiometric
        self.isConnected = isConnected
        self.accessToken = accessToken
    }

    enum CodingKeys: String, CodingKey {
        case id, name, hostname, port, useTLS, requireBiometric, isConnected, accessToken
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        hostname = try c.decode(String.self, forKey: .hostname)
        port = try c.decode(Int.self, forKey: .port)
        useTLS = try c.decode(Bool.self, forKey: .useTLS)
        requireBiometric = try c.decode(Bool.self, forKey: .requireBiometric)
        isConnected = try c.decode(Bool.self, forKey: .isConnected)
        accessToken = try c.decodeIfPresent(String.self, forKey: .accessToken)
    }
}
