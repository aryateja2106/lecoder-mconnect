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

    init(
        id: String = UUID().uuidString,
        name: String,
        hostname: String,
        port: Int = 8080,
        useTLS: Bool = true,
        requireBiometric: Bool = false,
        isConnected: Bool = false
    ) {
        self.id = id
        self.name = name
        self.hostname = hostname
        self.port = port
        self.useTLS = useTLS
        self.requireBiometric = requireBiometric
        self.isConnected = isConnected
    }
}
