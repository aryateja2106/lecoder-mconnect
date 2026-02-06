import Foundation

/// Manages JWT token storage and refresh via Keychain.
class TokenManager {
    static let shared = TokenManager()

    private let keychain = KeychainService.shared
    private let accessTokenKey = "auth.accessToken"
    private let refreshTokenKey = "auth.refreshToken"

    private init() {}

    var accessToken: String? {
        try? keychain.loadString(forKey: accessTokenKey)
    }

    var refreshToken: String? {
        try? keychain.loadString(forKey: refreshTokenKey)
    }

    var hasValidTokens: Bool {
        guard let token = accessToken else { return false }
        return !isTokenExpired(token)
    }

    func storeTokens(accessToken: String, refreshToken: String) throws {
        try keychain.saveString(accessToken, forKey: accessTokenKey)
        try keychain.saveString(refreshToken, forKey: refreshTokenKey, requireBiometric: true)
    }

    func clearTokens() {
        try? keychain.delete(forKey: accessTokenKey)
        try? keychain.delete(forKey: refreshTokenKey)
    }

    /// Check if a JWT token is expired by decoding the payload.
    private func isTokenExpired(_ token: String) -> Bool {
        let parts = token.split(separator: ".")
        guard parts.count == 3 else { return true }

        let payload = String(parts[1])
        // Add padding if needed
        let padded = payload.padding(
            toLength: ((payload.count + 3) / 4) * 4,
            withPad: "=",
            startingAt: 0
        )

        guard let data = Data(base64Encoded: padded),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let exp = json["exp"] as? TimeInterval
        else {
            return true
        }

        return Date(timeIntervalSince1970: exp) < Date()
    }
}
