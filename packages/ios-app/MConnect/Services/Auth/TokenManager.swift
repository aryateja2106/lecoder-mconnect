import Foundation

/// Manages JWT token storage and refresh via Keychain.
///
/// Access tokens are stored with standard Keychain protection.
/// Refresh tokens are stored with biometric protection (Face ID / Touch ID).
///
/// Token expiration is determined by decoding the JWT payload's `exp` claim.
/// A 60-second buffer is applied when checking validity to avoid edge-case
/// failures where a token expires mid-request.
class TokenManager {
    static let shared = TokenManager()

    private let keychain: KeychainService
    private let accessTokenKey = "auth.accessToken"
    private let refreshTokenKey = "auth.refreshToken"
    private let userProfileKey = "auth.userProfile"

    /// Buffer in seconds subtracted from `exp` when checking if a token is still valid.
    /// This prevents using a token that will expire during a network round-trip.
    private let expirationBuffer: TimeInterval = 60

    init(keychain: KeychainService = .shared) {
        self.keychain = keychain
    }

    // MARK: - Token Access

    /// The current access token, or `nil` if not stored.
    var accessToken: String? {
        try? keychain.loadString(forKey: accessTokenKey)
    }

    /// The current refresh token, or `nil` if not stored.
    /// Accessing this may trigger a biometric prompt on device.
    var refreshToken: String? {
        try? keychain.loadString(forKey: refreshTokenKey)
    }

    /// Whether a non-expired access token is available.
    var hasValidTokens: Bool {
        guard let token = accessToken else { return false }
        return !isTokenExpired(token)
    }

    /// Whether any tokens (valid or expired) are stored.
    var hasStoredTokens: Bool {
        keychain.exists(forKey: accessTokenKey)
    }

    /// The expiration date of the current access token, or `nil` if unavailable.
    var accessTokenExpiresAt: Date? {
        guard let token = accessToken else { return nil }
        return tokenExpirationDate(token)
    }

    // MARK: - Token Storage

    /// Store a new token pair in Keychain.
    ///
    /// The access token is stored with standard device-only protection.
    /// The refresh token is stored with biometric protection.
    func storeTokens(accessToken: String, refreshToken: String) throws {
        try keychain.saveString(accessToken, forKey: accessTokenKey)
        try keychain.saveString(refreshToken, forKey: refreshTokenKey, requireBiometric: true)
    }

    /// Remove all stored tokens.
    func clearTokens() {
        try? keychain.delete(forKey: accessTokenKey)
        try? keychain.delete(forKey: refreshTokenKey)
        try? keychain.delete(forKey: userProfileKey)
    }

    // MARK: - User Profile

    /// Store the authenticated user's profile for offline display.
    func storeUserProfile(_ profile: UserProfile) throws {
        try keychain.saveCodable(profile, forKey: userProfileKey)
    }

    /// Load the stored user profile, or `nil` if not available.
    func loadUserProfile() -> UserProfile? {
        try? keychain.loadCodable(UserProfile.self, forKey: userProfileKey)
    }

    // MARK: - JWT Decoding

    /// Check if a JWT token is expired (with buffer).
    func isTokenExpired(_ token: String) -> Bool {
        guard let expiration = tokenExpirationDate(token) else { return true }
        return expiration.addingTimeInterval(-expirationBuffer) < Date()
    }

    /// Extract the expiration date from a JWT token's payload.
    func tokenExpirationDate(_ token: String) -> Date? {
        guard let payload = decodeJWTPayload(token),
              let exp = payload["exp"] as? TimeInterval
        else {
            return nil
        }
        return Date(timeIntervalSince1970: exp)
    }

    /// Decode and return the JWT payload as a dictionary.
    func decodeJWTPayload(_ token: String) -> [String: Any]? {
        let parts = token.split(separator: ".")
        guard parts.count == 3 else { return nil }

        let payload = String(parts[1])
        // Convert base64url to standard base64 and add padding
        let base64 = payload
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let padded = base64.padding(
            toLength: ((base64.count + 3) / 4) * 4,
            withPad: "=",
            startingAt: 0
        )

        guard let data = Data(base64Encoded: padded),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            return nil
        }

        return json
    }
}

// MARK: - User Profile

/// Minimal user profile stored locally for offline display.
struct UserProfile: Codable, Equatable {
    let id: String
    let email: String
    let name: String
    let avatarUrl: String?
    let provider: String
}
