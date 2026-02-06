import XCTest
@testable import MConnect

final class AuthServiceTests: XCTestCase {

    // MARK: - PKCE

    func testGenerateCodeVerifierIsBase64URL() async {
        let authService = await AuthService(urlSession: .shared)
        let verifier = await authService.generateCodeVerifier()

        // Must be base64url-safe: no +, /, or =
        XCTAssertFalse(verifier.contains("+"), "Code verifier must not contain '+'")
        XCTAssertFalse(verifier.contains("/"), "Code verifier must not contain '/'")
        XCTAssertFalse(verifier.contains("="), "Code verifier must not contain '='")

        // 32 bytes base64url-encoded = 43 characters
        XCTAssertEqual(verifier.count, 43, "32 bytes should produce 43 base64url characters")
    }

    func testGenerateCodeVerifierIsUnique() async {
        let authService = await AuthService(urlSession: .shared)
        let v1 = await authService.generateCodeVerifier()
        let v2 = await authService.generateCodeVerifier()
        XCTAssertNotEqual(v1, v2, "Each verifier must be cryptographically unique")
    }

    func testGenerateCodeChallengeIsDeterministic() async {
        let authService = await AuthService(urlSession: .shared)
        let verifier = "test-verifier-for-determinism"

        let c1 = await authService.generateCodeChallenge(from: verifier)
        let c2 = await authService.generateCodeChallenge(from: verifier)

        XCTAssertNotNil(c1)
        XCTAssertEqual(c1, c2, "Same verifier must produce same challenge")
    }

    func testGenerateCodeChallengeIsBase64URL() async {
        let authService = await AuthService(urlSession: .shared)
        let verifier = "any-verifier"
        let challenge = await authService.generateCodeChallenge(from: verifier)

        XCTAssertNotNil(challenge)
        XCTAssertFalse(challenge!.contains("+"))
        XCTAssertFalse(challenge!.contains("/"))
        XCTAssertFalse(challenge!.contains("="))
    }

    func testCodeChallengeDiffersFromVerifier() async {
        let authService = await AuthService(urlSession: .shared)
        let verifier = await authService.generateCodeVerifier()
        let challenge = await authService.generateCodeChallenge(from: verifier)

        XCTAssertNotNil(challenge)
        XCTAssertNotEqual(verifier, challenge!, "Challenge must be SHA256 hash, not verifier itself")
    }

    // MARK: - OAuth Flow URL

    func testStartOAuthFlowReturnsValidURL() async {
        let authService = await AuthService(urlSession: .shared)
        let url = await authService.startOAuthFlow(serverURL: "https://example.com:8080")

        XCTAssertNotNil(url)
        XCTAssertEqual(url!.host, "example.com")

        let components = URLComponents(url: url!, resolvingAgainstBaseURL: false)!
        let queryItems = components.queryItems ?? []
        let queryDict = Dictionary(uniqueKeysWithValues: queryItems.map { ($0.name, $0.value ?? "") })

        XCTAssertEqual(queryDict["provider"], "github")
        XCTAssertEqual(queryDict["redirect_uri"], "mconnect://callback")
        XCTAssertEqual(queryDict["code_challenge_method"], "S256")
        XCTAssertNotNil(queryDict["code_challenge"])
        XCTAssertNotNil(queryDict["state"])
        XCTAssertTrue(components.path.hasSuffix("/auth/authorize"))
    }

    func testStartOAuthFlowCustomProvider() async {
        let authService = await AuthService(urlSession: .shared)
        let url = await authService.startOAuthFlow(serverURL: "https://example.com", provider: "google")

        XCTAssertNotNil(url)
        let components = URLComponents(url: url!, resolvingAgainstBaseURL: false)!
        let provider = components.queryItems?.first(where: { $0.name == "provider" })?.value
        XCTAssertEqual(provider, "google")
    }

    func testStartOAuthFlowGeneratesUniqueState() async {
        let authService = await AuthService(urlSession: .shared)
        let url1 = await authService.startOAuthFlow(serverURL: "https://example.com")
        let url2 = await authService.startOAuthFlow(serverURL: "https://example.com")

        XCTAssertNotNil(url1)
        XCTAssertNotNil(url2)

        let state1 = URLComponents(url: url1!, resolvingAgainstBaseURL: false)?
            .queryItems?.first(where: { $0.name == "state" })?.value
        let state2 = URLComponents(url: url2!, resolvingAgainstBaseURL: false)?
            .queryItems?.first(where: { $0.name == "state" })?.value

        XCTAssertNotEqual(state1, state2, "Each flow must have a unique state")
    }

    // MARK: - handleCallback Validation

    func testHandleCallbackRejectsInvalidURL() async {
        let authService = await AuthService(urlSession: .shared)

        // No pending OAuth state, should fail
        let url = URL(string: "mconnect://callback?code=abc&state=xyz")!
        do {
            try await authService.handleCallback(url)
            XCTFail("Should have thrown invalidCallback")
        } catch let error as AuthError {
            XCTAssertEqual(error, .invalidCallback)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testHandleCallbackRejectsStateMismatch() async {
        let authService = await AuthService(urlSession: .shared)

        // Start a flow to create pending state
        _ = await authService.startOAuthFlow(serverURL: "https://example.com")

        // Use a different state in the callback
        let url = URL(string: "mconnect://callback?code=abc&state=wrong-state&provider=github")!
        do {
            try await authService.handleCallback(url)
            XCTFail("Should have thrown stateMismatch")
        } catch let error as AuthError {
            XCTAssertEqual(error, .stateMismatch)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testHandleCallbackRejectsProviderError() async {
        let authService = await AuthService(urlSession: .shared)
        _ = await authService.startOAuthFlow(serverURL: "https://example.com")

        let url = URL(string: "mconnect://callback?error=access_denied&error_description=User+denied")!
        do {
            try await authService.handleCallback(url)
            XCTFail("Should have thrown providerError")
        } catch let error as AuthError {
            if case .providerError(let code, let desc) = error {
                XCTAssertEqual(code, "access_denied")
                XCTAssertEqual(desc, "User denied")
            } else {
                XCTFail("Expected providerError, got \(error)")
            }
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testHandleCallbackRejectsMissingCode() async {
        let authService = await AuthService(urlSession: .shared)
        _ = await authService.startOAuthFlow(serverURL: "https://example.com")

        let url = URL(string: "mconnect://callback?state=some-state")!
        do {
            try await authService.handleCallback(url)
            XCTFail("Should have thrown invalidCallback")
        } catch let error as AuthError {
            XCTAssertEqual(error, .invalidCallback)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    // MARK: - signOut

    func testSignOutClearsAuthenticatedState() async {
        let authService = await AuthService(urlSession: .shared)
        await authService.signOut()

        let isAuthenticated = await authService.isAuthenticated
        XCTAssertFalse(isAuthenticated)
    }

    // MARK: - refreshAccessToken

    func testRefreshWithNoTokenThrows() async {
        let authService = await AuthService(urlSession: .shared)
        do {
            try await authService.refreshAccessToken(serverURL: "https://example.com")
            XCTFail("Should have thrown noRefreshToken")
        } catch let error as AuthError {
            XCTAssertEqual(error, .noRefreshToken)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    // MARK: - AuthError

    func testAuthErrorEquality() {
        XCTAssertEqual(AuthError.invalidCallback, AuthError.invalidCallback)
        XCTAssertEqual(AuthError.stateMismatch, AuthError.stateMismatch)
        XCTAssertEqual(AuthError.invalidServerURL, AuthError.invalidServerURL)
        XCTAssertEqual(AuthError.noRefreshToken, AuthError.noRefreshToken)
        XCTAssertEqual(
            AuthError.tokenExchangeFailed("msg"),
            AuthError.tokenExchangeFailed("msg")
        )
        XCTAssertNotEqual(
            AuthError.tokenExchangeFailed("a"),
            AuthError.tokenExchangeFailed("b")
        )
        XCTAssertNotEqual(AuthError.invalidCallback, AuthError.stateMismatch)
    }

    func testAuthErrorDescriptions() {
        let errors: [AuthError] = [
            .invalidCallback,
            .stateMismatch,
            .invalidServerURL,
            .noRefreshToken,
            .tokenExchangeFailed("detail"),
            .refreshFailed("detail"),
            .providerError("code", "desc"),
            .providerError("code", nil),
        ]

        for error in errors {
            XCTAssertNotNil(error.errorDescription, "Missing description for \(error)")
        }
    }

    // MARK: - TokenResponse

    func testTokenResponseDecoding() throws {
        let json = """
        {
            "access_token": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMiLCJleHAiOjk5OTk5OTk5OTl9.sig",
            "refresh_token": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMiLCJleHAiOjk5OTk5OTk5OTl9.sig",
            "expires_in": 900,
            "token_type": "Bearer"
        }
        """.data(using: .utf8)!

        let response = try JSONDecoder().decode(TokenResponse.self, from: json)
        XCTAssertEqual(response.expiresIn, 900)
        XCTAssertEqual(response.tokenType, "Bearer")
        XCTAssertTrue(response.accessToken.hasPrefix("eyJ"))
        XCTAssertTrue(response.refreshToken.hasPrefix("eyJ"))
    }

    func testTokenResponseEncoding() throws {
        let response = TokenResponse(
            accessToken: "access",
            refreshToken: "refresh",
            expiresIn: 900,
            tokenType: "Bearer"
        )

        let data = try JSONEncoder().encode(response)
        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]

        XCTAssertEqual(json["access_token"] as? String, "access")
        XCTAssertEqual(json["refresh_token"] as? String, "refresh")
        XCTAssertEqual(json["expires_in"] as? Int, 900)
        XCTAssertEqual(json["token_type"] as? String, "Bearer")
    }

    // MARK: - OAuthErrorResponse

    func testOAuthErrorResponseDecoding() throws {
        let json = """
        {
            "error": "invalid_request",
            "error_description": "Missing code parameter"
        }
        """.data(using: .utf8)!

        let response = try JSONDecoder().decode(OAuthErrorResponse.self, from: json)
        XCTAssertEqual(response.error, "invalid_request")
        XCTAssertEqual(response.errorDescription, "Missing code parameter")
    }

    func testOAuthErrorResponseWithoutDescription() throws {
        let json = """
        { "error": "server_error" }
        """.data(using: .utf8)!

        let response = try JSONDecoder().decode(OAuthErrorResponse.self, from: json)
        XCTAssertEqual(response.error, "server_error")
        XCTAssertNil(response.errorDescription)
    }

    // MARK: - Data Base64URL Extension

    func testBase64URLEncodedString() {
        // Known values that produce +, /, and = in standard base64
        let data = Data([0xFB, 0xFF, 0xBE]) // produces "+/++\n" in base64
        let encoded = data.base64URLEncodedString()

        XCTAssertFalse(encoded.contains("+"), "Must not contain '+'")
        XCTAssertFalse(encoded.contains("/"), "Must not contain '/'")
        XCTAssertFalse(encoded.contains("="), "Must not contain '='")
    }

    func testBase64URLEmptyData() {
        let data = Data()
        let encoded = data.base64URLEncodedString()
        XCTAssertEqual(encoded, "")
    }
}
