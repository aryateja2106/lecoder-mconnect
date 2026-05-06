import Foundation

/// Decoded pairing payload extracted from a QR code or deep link.
struct PairingPayload: Codable, Equatable {
    let hostname: String
    let port: Int
    let token: String
    let useTLS: Bool
}
