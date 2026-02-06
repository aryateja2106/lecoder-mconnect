import Foundation
import CryptoKit

/// OAuth 2.0 + PKCE authentication service.
@MainActor
class AuthService: ObservableObject {
    @Published var isAuthenticated = false
    @Published var isLoading = false

    private let tokenManager: TokenManager
    private var codeVerifier: String?

    init(tokenManager: TokenManager = .shared) {
        self.tokenManager = tokenManager
        self.isAuthenticated = tokenManager.hasValidTokens
    }

    /// Generate PKCE code challenge and open OAuth authorization URL.
    func startOAuthFlow(serverURL: String) -> URL? {
        let verifier = generateCodeVerifier()
        self.codeVerifier = verifier

        guard let challenge = generateCodeChallenge(from: verifier) else { return nil }

        var components = URLComponents(string: "\(serverURL)/auth/authorize")
        components?.queryItems = [
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "client_id", value: "mconnect-ios"),
            URLQueryItem(name: "redirect_uri", value: "mconnect://callback"),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "scope", value: "read write"),
        ]

        return components?.url
    }

    /// Handle the OAuth callback URL and exchange the code for tokens.
    func handleCallback(_ url: URL) async throws {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let code = components.queryItems?.first(where: { $0.name == "code" })?.value,
              let verifier = codeVerifier
        else {
            throw AuthError.invalidCallback
        }

        isLoading = true
        defer { isLoading = false }

        // Exchange code for tokens (implementation in later step)
        _ = code
        _ = verifier

        codeVerifier = nil
        isAuthenticated = true
    }

    func signOut() {
        tokenManager.clearTokens()
        isAuthenticated = false
    }

    // MARK: - PKCE Helpers

    private func generateCodeVerifier() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes)
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private func generateCodeChallenge(from verifier: String) -> String? {
        guard let data = verifier.data(using: .utf8) else { return nil }
        let hash = SHA256.hash(data: data)
        return Data(hash)
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

enum AuthError: LocalizedError {
    case invalidCallback
    case tokenExchangeFailed
    case refreshFailed

    var errorDescription: String? {
        switch self {
        case .invalidCallback: return "Invalid OAuth callback URL"
        case .tokenExchangeFailed: return "Failed to exchange authorization code for tokens"
        case .refreshFailed: return "Failed to refresh access token"
        }
    }
}
