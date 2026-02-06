import Foundation
import CryptoKit
import AuthenticationServices

/// OAuth 2.0 + PKCE authentication service.
///
/// Orchestrates the full OAuth flow:
/// 1. Generate PKCE code_verifier / code_challenge
/// 2. Open the server's `/auth/authorize` endpoint (redirects to GitHub)
/// 3. Handle `mconnect://callback?code=...&state=...&provider=...`
/// 4. Exchange the authorization code for JWT tokens via `POST /auth/token`
/// 5. Store tokens in Keychain via ``TokenManager``
@MainActor
class AuthService: ObservableObject {
    @Published var isAuthenticated = false
    @Published var isLoading = false
    @Published var error: AuthError?

    private let tokenManager: TokenManager
    private let urlSession: URLSession

    /// Pending OAuth state kept between `startOAuthFlow` and `handleCallback`.
    private var pendingOAuth: PendingOAuthState?

    struct PendingOAuthState {
        let codeVerifier: String
        let state: String
        let serverURL: String
    }

    // MARK: - Initialization

    init(tokenManager: TokenManager = .shared, urlSession: URLSession = .shared) {
        self.tokenManager = tokenManager
        self.urlSession = urlSession
        self.isAuthenticated = tokenManager.hasValidTokens
    }

    // MARK: - OAuth Flow

    /// Build the OAuth authorization URL with PKCE parameters.
    ///
    /// Call this to get the URL that should be opened in Safari / ASWebAuthenticationSession.
    /// The `serverURL` should be the base URL of the MConnect server (e.g. `https://host:port`).
    ///
    /// - Parameter serverURL: Base URL of the MConnect server.
    /// - Parameter provider: OAuth provider (defaults to `github`).
    /// - Returns: The authorization URL to open, or `nil` if URL construction failed.
    func startOAuthFlow(serverURL: String, provider: String = "github") -> URL? {
        let verifier = generateCodeVerifier()
        guard let challenge = generateCodeChallenge(from: verifier) else { return nil }

        let state = generateState()

        pendingOAuth = PendingOAuthState(
            codeVerifier: verifier,
            state: state,
            serverURL: serverURL
        )

        var components = URLComponents(string: "\(serverURL)/auth/authorize")
        components?.queryItems = [
            URLQueryItem(name: "provider", value: provider),
            URLQueryItem(name: "redirect_uri", value: "mconnect://callback"),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "state", value: state),
        ]

        return components?.url
    }

    /// Handle the OAuth callback URL and exchange the authorization code for tokens.
    ///
    /// Expected URL format: `mconnect://callback?code=...&state=...&provider=...`
    ///
    /// This method:
    /// 1. Validates the `state` parameter matches the pending OAuth state
    /// 2. Sends `POST /auth/token` with the code + code_verifier
    /// 3. Stores the returned JWT tokens in Keychain
    ///
    /// - Parameter url: The callback URL received from the OAuth redirect.
    func handleCallback(_ url: URL) async throws {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let queryItems = components.queryItems
        else {
            throw AuthError.invalidCallback
        }

        // Check for OAuth error from provider
        if let errorParam = queryItems.first(where: { $0.name == "error" })?.value {
            let description = queryItems.first(where: { $0.name == "error_description" })?.value
            throw AuthError.providerError(errorParam, description)
        }

        guard let code = queryItems.first(where: { $0.name == "code" })?.value,
              let state = queryItems.first(where: { $0.name == "state" })?.value,
              let pending = pendingOAuth
        else {
            throw AuthError.invalidCallback
        }

        // Validate state to prevent CSRF
        guard state == pending.state else {
            pendingOAuth = nil
            throw AuthError.stateMismatch
        }

        let provider = queryItems.first(where: { $0.name == "provider" })?.value ?? "github"

        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            let tokenResponse = try await exchangeCodeForTokens(
                code: code,
                codeVerifier: pending.codeVerifier,
                provider: provider,
                serverURL: pending.serverURL
            )

            try tokenManager.storeTokens(
                accessToken: tokenResponse.accessToken,
                refreshToken: tokenResponse.refreshToken
            )

            pendingOAuth = nil
            isAuthenticated = true
        } catch {
            pendingOAuth = nil
            if let authError = error as? AuthError {
                self.error = authError
                throw authError
            }
            let wrapped = AuthError.tokenExchangeFailed(error.localizedDescription)
            self.error = wrapped
            throw wrapped
        }
    }

    /// Attempt to refresh the access token using the stored refresh token.
    ///
    /// - Parameter serverURL: Base URL of the MConnect server.
    /// - Returns: The new access token on success.
    @discardableResult
    func refreshAccessToken(serverURL: String) async throws -> String {
        guard let refreshToken = tokenManager.refreshToken else {
            throw AuthError.noRefreshToken
        }

        let tokenResponse = try await performTokenRefresh(
            refreshToken: refreshToken,
            serverURL: serverURL
        )

        try tokenManager.storeTokens(
            accessToken: tokenResponse.accessToken,
            refreshToken: tokenResponse.refreshToken
        )

        isAuthenticated = true
        return tokenResponse.accessToken
    }

    /// Sign out by clearing all stored tokens and revoking the refresh token server-side.
    ///
    /// - Parameter serverURL: Optional server URL to revoke the token server-side.
    func signOut(serverURL: String? = nil) {
        if let serverURL, let refreshToken = tokenManager.refreshToken {
            Task {
                try? await revokeToken(refreshToken: refreshToken, serverURL: serverURL)
            }
        }
        tokenManager.clearTokens()
        pendingOAuth = nil
        isAuthenticated = false
        error = nil
    }

    /// Check if the current access token is still valid, refreshing if needed.
    ///
    /// - Parameter serverURL: Base URL of the MConnect server.
    /// - Returns: A valid access token string.
    func validAccessToken(serverURL: String) async throws -> String {
        if let token = tokenManager.accessToken, tokenManager.hasValidTokens {
            return token
        }

        // Access token expired or missing - try refresh
        return try await refreshAccessToken(serverURL: serverURL)
    }

    // MARK: - Network Requests

    /// Exchange the authorization code for JWT tokens via `POST /auth/token`.
    private func exchangeCodeForTokens(
        code: String,
        codeVerifier: String,
        provider: String,
        serverURL: String
    ) async throws -> TokenResponse {
        guard let url = URL(string: "\(serverURL)/auth/token") else {
            throw AuthError.invalidServerURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: String] = [
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": "mconnect://callback",
            "code_verifier": codeVerifier,
            "provider": provider,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await urlSession.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw AuthError.tokenExchangeFailed("Invalid response")
        }

        guard httpResponse.statusCode == 200 else {
            let errorBody = try? JSONDecoder().decode(OAuthErrorResponse.self, from: data)
            throw AuthError.tokenExchangeFailed(
                errorBody?.errorDescription ?? "Server returned \(httpResponse.statusCode)"
            )
        }

        return try JSONDecoder().decode(TokenResponse.self, from: data)
    }

    /// Refresh tokens via `POST /auth/refresh`.
    private func performTokenRefresh(
        refreshToken: String,
        serverURL: String
    ) async throws -> TokenResponse {
        guard let url = URL(string: "\(serverURL)/auth/refresh") else {
            throw AuthError.invalidServerURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: String] = ["refresh_token": refreshToken]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await urlSession.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw AuthError.refreshFailed("Invalid response")
        }

        guard httpResponse.statusCode == 200 else {
            let errorBody = try? JSONDecoder().decode(OAuthErrorResponse.self, from: data)
            throw AuthError.refreshFailed(
                errorBody?.errorDescription ?? "Server returned \(httpResponse.statusCode)"
            )
        }

        return try JSONDecoder().decode(TokenResponse.self, from: data)
    }

    /// Revoke the refresh token via `POST /auth/revoke`. Best-effort, errors are ignored.
    private func revokeToken(refreshToken: String, serverURL: String) async throws {
        guard let url = URL(string: "\(serverURL)/auth/revoke") else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: String] = ["token": refreshToken]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        _ = try? await urlSession.data(for: request)
    }

    // MARK: - PKCE Helpers

    /// Generate a cryptographically random code_verifier (32 bytes, base64url-encoded).
    func generateCodeVerifier() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes).base64URLEncodedString()
    }

    /// Compute the PKCE code_challenge as base64url(SHA256(verifier)).
    func generateCodeChallenge(from verifier: String) -> String? {
        guard let data = verifier.data(using: .utf8) else { return nil }
        let hash = SHA256.hash(data: data)
        return Data(hash).base64URLEncodedString()
    }

    /// Generate a cryptographically random state parameter (24 bytes, base64url-encoded).
    private func generateState() -> String {
        var bytes = [UInt8](repeating: 0, count: 24)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes).base64URLEncodedString()
    }
}

// MARK: - Token Response

/// Server response from `POST /auth/token` and `POST /auth/refresh`.
/// Matches the OAuth 2.0 token response format from the server.
struct TokenResponse: Codable, Equatable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int
    let tokenType: String

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
        case tokenType = "token_type"
    }
}

/// Server error response from OAuth endpoints.
struct OAuthErrorResponse: Codable {
    let error: String
    let errorDescription: String?

    enum CodingKeys: String, CodingKey {
        case error
        case errorDescription = "error_description"
    }
}

// MARK: - Auth Errors

enum AuthError: LocalizedError, Equatable {
    case invalidCallback
    case stateMismatch
    case invalidServerURL
    case noRefreshToken
    case tokenExchangeFailed(String)
    case refreshFailed(String)
    case providerError(String, String?)

    var errorDescription: String? {
        switch self {
        case .invalidCallback:
            return "Invalid OAuth callback URL"
        case .stateMismatch:
            return "OAuth state mismatch — possible CSRF attack. Please try again."
        case .invalidServerURL:
            return "Invalid server URL"
        case .noRefreshToken:
            return "No refresh token available. Please sign in again."
        case .tokenExchangeFailed(let detail):
            return "Failed to exchange authorization code: \(detail)"
        case .refreshFailed(let detail):
            return "Failed to refresh access token: \(detail)"
        case .providerError(let code, let description):
            return "OAuth provider error (\(code)): \(description ?? "Unknown")"
        }
    }
}

// MARK: - Data Base64URL Extension

extension Data {
    /// Base64url encoding without padding (RFC 4648 §5).
    func base64URLEncodedString() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
