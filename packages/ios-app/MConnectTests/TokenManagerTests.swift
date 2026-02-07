import XCTest
@testable import MConnect

final class TokenManagerTests: XCTestCase {

    private var tokenManager: TokenManager!

    override func setUp() {
        super.setUp()
        tokenManager = TokenManager()
    }

    override func tearDown() {
        tokenManager.clearTokens()
        super.tearDown()
    }

    // MARK: - Helpers

    /// Build a minimal JWT with a given `exp` claim.
    /// Format: base64url(header).base64url(payload).signature
    private func makeJWT(exp: TimeInterval, sub: String = "user-123", email: String = "test@example.com") -> String {
        let header = Data(#"{"alg":"HS256","typ":"JWT"}"#.utf8).base64URLEncodedString()
        let payloadDict: [String: Any] = [
            "iss": "mconnect",
            "sub": sub,
            "email": email,
            "name": "Test User",
            "provider": "github",
            "exp": exp,
            "iat": Date().timeIntervalSince1970,
            "jti": UUID().uuidString,
        ]
        let payloadData = try! JSONSerialization.data(withJSONObject: payloadDict)
        let payload = payloadData.base64URLEncodedString()
        let signature = Data("fake-signature".utf8).base64URLEncodedString()
        return "\(header).\(payload).\(signature)"
    }

    // MARK: - Token Storage

    func testStoreAndLoadTokens() throws {
        let access = makeJWT(exp: Date().timeIntervalSince1970 + 900)
        let refresh = makeJWT(exp: Date().timeIntervalSince1970 + 2_592_000)

        try tokenManager.storeTokens(accessToken: access, refreshToken: refresh)

        XCTAssertEqual(tokenManager.accessToken, access)
        // Refresh token requires biometric, may not be loadable in tests on simulator
        // but at least verify accessToken works
    }

    func testClearTokensRemovesAll() throws {
        let access = makeJWT(exp: Date().timeIntervalSince1970 + 900)
        let refresh = makeJWT(exp: Date().timeIntervalSince1970 + 2_592_000)

        try tokenManager.storeTokens(accessToken: access, refreshToken: refresh)
        tokenManager.clearTokens()

        XCTAssertNil(tokenManager.accessToken)
        XCTAssertFalse(tokenManager.hasValidTokens)
        XCTAssertFalse(tokenManager.hasStoredTokens)
    }

    // MARK: - Token Validation

    func testHasValidTokensWithFutureExpiry() throws {
        let futureExp = Date().timeIntervalSince1970 + 900 // 15 min from now
        let access = makeJWT(exp: futureExp)
        let refresh = makeJWT(exp: futureExp + 2_592_000)

        try tokenManager.storeTokens(accessToken: access, refreshToken: refresh)
        XCTAssertTrue(tokenManager.hasValidTokens)
    }

    func testHasValidTokensWithPastExpiry() throws {
        let pastExp = Date().timeIntervalSince1970 - 100 // Expired 100 seconds ago
        let access = makeJWT(exp: pastExp)
        let refresh = makeJWT(exp: pastExp + 2_592_000)

        try tokenManager.storeTokens(accessToken: access, refreshToken: refresh)
        XCTAssertFalse(tokenManager.hasValidTokens)
    }

    func testHasValidTokensReturnsFalseWithNoTokens() {
        XCTAssertFalse(tokenManager.hasValidTokens)
    }

    func testIsTokenExpiredWithBuffer() {
        // Token expires in 30 seconds, but buffer is 60 seconds, so should be "expired"
        let token = makeJWT(exp: Date().timeIntervalSince1970 + 30)
        XCTAssertTrue(tokenManager.isTokenExpired(token), "Token expiring within buffer should be considered expired")
    }

    func testIsTokenNotExpiredOutsideBuffer() {
        // Token expires in 120 seconds, buffer is 60, so should be valid
        let token = makeJWT(exp: Date().timeIntervalSince1970 + 120)
        XCTAssertFalse(tokenManager.isTokenExpired(token))
    }

    func testIsTokenExpiredWithInvalidJWT() {
        XCTAssertTrue(tokenManager.isTokenExpired("not-a-jwt"))
        XCTAssertTrue(tokenManager.isTokenExpired(""))
        XCTAssertTrue(tokenManager.isTokenExpired("a.b")) // Only 2 parts
    }

    // MARK: - JWT Decoding

    func testDecodeJWTPayloadExtractsClaims() {
        let exp = Date().timeIntervalSince1970 + 900
        let token = makeJWT(exp: exp, sub: "user-456", email: "alice@example.com")

        let payload = tokenManager.decodeJWTPayload(token)
        XCTAssertNotNil(payload)
        XCTAssertEqual(payload?["sub"] as? String, "user-456")
        XCTAssertEqual(payload?["email"] as? String, "alice@example.com")
        XCTAssertEqual(payload?["iss"] as? String, "mconnect")
        XCTAssertEqual(payload?["provider"] as? String, "github")
    }

    func testDecodeJWTPayloadReturnsNilForInvalid() {
        XCTAssertNil(tokenManager.decodeJWTPayload("not-a-jwt"))
        XCTAssertNil(tokenManager.decodeJWTPayload("a.b"))
        XCTAssertNil(tokenManager.decodeJWTPayload(""))
    }

    func testDecodeJWTPayloadHandlesBase64URL() {
        // Verify it correctly handles base64url encoding (- and _ characters)
        let exp = Date().timeIntervalSince1970 + 900
        let token = makeJWT(exp: exp)
        let payload = tokenManager.decodeJWTPayload(token)
        XCTAssertNotNil(payload, "Should handle base64url-encoded payloads")
    }

    func testTokenExpirationDate() {
        let exp = Date().timeIntervalSince1970 + 900
        let token = makeJWT(exp: exp)

        let date = tokenManager.tokenExpirationDate(token)
        XCTAssertNotNil(date)

        // Should be within 1 second of expected
        XCTAssertEqual(date!.timeIntervalSince1970, exp, accuracy: 1.0)
    }

    func testAccessTokenExpiresAt() throws {
        let exp = Date().timeIntervalSince1970 + 900
        let access = makeJWT(exp: exp)
        let refresh = makeJWT(exp: exp + 2_592_000)

        try tokenManager.storeTokens(accessToken: access, refreshToken: refresh)

        let expiresAt = tokenManager.accessTokenExpiresAt
        XCTAssertNotNil(expiresAt)
        XCTAssertEqual(expiresAt!.timeIntervalSince1970, exp, accuracy: 1.0)
    }

    func testAccessTokenExpiresAtReturnsNilWithNoToken() {
        XCTAssertNil(tokenManager.accessTokenExpiresAt)
    }

    // MARK: - hasStoredTokens

    func testHasStoredTokensAfterStorage() throws {
        let access = makeJWT(exp: Date().timeIntervalSince1970 + 900)
        let refresh = makeJWT(exp: Date().timeIntervalSince1970 + 2_592_000)

        try tokenManager.storeTokens(accessToken: access, refreshToken: refresh)
        XCTAssertTrue(tokenManager.hasStoredTokens)
    }

    func testHasStoredTokensWhenEmpty() {
        XCTAssertFalse(tokenManager.hasStoredTokens)
    }

    // MARK: - User Profile

    func testStoreAndLoadUserProfile() throws {
        let profile = UserProfile(
            id: "user-123",
            email: "test@example.com",
            name: "Test User",
            avatarUrl: "https://example.com/avatar.png",
            provider: "github"
        )

        try tokenManager.storeUserProfile(profile)

        let loaded = tokenManager.loadUserProfile()
        XCTAssertNotNil(loaded)
        XCTAssertEqual(loaded, profile)
    }

    func testLoadUserProfileReturnsNilWhenEmpty() {
        XCTAssertNil(tokenManager.loadUserProfile())
    }

    func testUserProfileWithoutAvatarUrl() throws {
        let profile = UserProfile(
            id: "user-456",
            email: "noavatar@example.com",
            name: "No Avatar",
            avatarUrl: nil,
            provider: "github"
        )

        try tokenManager.storeUserProfile(profile)

        let loaded = tokenManager.loadUserProfile()
        XCTAssertNotNil(loaded)
        XCTAssertNil(loaded?.avatarUrl)
        XCTAssertEqual(loaded?.name, "No Avatar")
    }

    func testClearTokensAlsoClearsProfile() throws {
        let profile = UserProfile(
            id: "user-789",
            email: "cleared@example.com",
            name: "Cleared",
            avatarUrl: nil,
            provider: "github"
        )
        try tokenManager.storeUserProfile(profile)

        tokenManager.clearTokens()

        XCTAssertNil(tokenManager.loadUserProfile())
    }

    // MARK: - UserProfile Codable

    func testUserProfileEquality() {
        let a = UserProfile(id: "1", email: "a@b.c", name: "A", avatarUrl: nil, provider: "github")
        let b = UserProfile(id: "1", email: "a@b.c", name: "A", avatarUrl: nil, provider: "github")
        let c = UserProfile(id: "2", email: "a@b.c", name: "A", avatarUrl: nil, provider: "github")

        XCTAssertEqual(a, b)
        XCTAssertNotEqual(a, c)
    }
}

// MARK: - Test Helper Extension

private extension Data {
    func base64URLEncodedString() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
