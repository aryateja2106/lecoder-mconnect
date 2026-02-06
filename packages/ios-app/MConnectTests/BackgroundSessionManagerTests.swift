import XCTest
@testable import MConnect

@MainActor
final class BackgroundSessionManagerTests: XCTestCase {

    private var manager: BackgroundSessionManager!

    override func setUp() {
        super.setUp()
        manager = BackgroundSessionManager.shared
        manager.resetForTesting()
    }

    override func tearDown() {
        manager.resetForTesting()
        manager = nil
        super.tearDown()
    }

    // MARK: - Initial State

    func testInitialState() {
        XCTAssertFalse(manager.isInBackground)
        XCTAssertFalse(manager.wasConnectedBeforeBackground)
        XCTAssertNil(manager.lastConnectedHost)
        XCTAssertNil(manager.lastAttachedSessionId)
    }

    // MARK: - Background Entry Without Connection

    func testAppDidEnterBackgroundWithNoClient() {
        manager.appDidEnterBackground()
        XCTAssertTrue(manager.isInBackground)
        XCTAssertFalse(manager.wasConnectedBeforeBackground)
    }

    // MARK: - Background Entry With Disconnected Client

    func testAppDidEnterBackgroundWithDisconnectedClient() {
        let client = WSClient(tokenManager: TokenManager())
        manager.configure(wsClient: client)

        manager.appDidEnterBackground()

        XCTAssertTrue(manager.isInBackground)
        XCTAssertFalse(manager.wasConnectedBeforeBackground)
        XCTAssertNil(manager.lastConnectedHost)
        XCTAssertNil(manager.lastAttachedSessionId)
    }

    // MARK: - Foreground Entry

    func testAppWillEnterForegroundResetsBackgroundFlag() {
        manager.appDidEnterBackground()
        XCTAssertTrue(manager.isInBackground)

        manager.appWillEnterForeground()
        XCTAssertFalse(manager.isInBackground)
        XCTAssertFalse(manager.wasConnectedBeforeBackground)
    }

    func testForegroundWithoutPriorBackgroundIsNoOp() {
        let client = WSClient(tokenManager: TokenManager())
        manager.configure(wsClient: client)

        // Going foreground without prior background should not crash
        manager.appWillEnterForeground()
        XCTAssertFalse(manager.isInBackground)
        XCTAssertFalse(manager.wasConnectedBeforeBackground)
    }

    // MARK: - Configure

    func testConfigureAcceptsWSClient() {
        let client = WSClient(tokenManager: TokenManager())
        manager.configure(wsClient: client)
        // Manager holds a weak reference — should not crash
    }

    func testConfigureOverwritesPreviousClient() {
        let client1 = WSClient(tokenManager: TokenManager())
        let client2 = WSClient(tokenManager: TokenManager())
        manager.configure(wsClient: client1)
        manager.configure(wsClient: client2)
        // No crash, most recent client is tracked
    }

    // MARK: - Round-Trip Background/Foreground

    func testRoundTripDoesNotCrash() {
        let client = WSClient(tokenManager: TokenManager())
        manager.configure(wsClient: client)

        manager.appDidEnterBackground()
        XCTAssertTrue(manager.isInBackground)

        manager.appWillEnterForeground()
        XCTAssertFalse(manager.isInBackground)
    }

    // MARK: - Multiple Background Cycles

    func testMultipleBackgroundCycles() {
        let client = WSClient(tokenManager: TokenManager())
        manager.configure(wsClient: client)

        for _ in 0..<5 {
            manager.appDidEnterBackground()
            XCTAssertTrue(manager.isInBackground)
            manager.appWillEnterForeground()
            XCTAssertFalse(manager.isInBackground)
        }
    }

    // MARK: - WSClient Host Exposure

    func testCurrentHostForBackgroundExposesHost() {
        let client = WSClient(tokenManager: TokenManager())
        // Before connecting, the host should be nil
        XCTAssertNil(client.currentHostForBackground)
    }

    // MARK: - Task Identifier Constant

    func testKeepAliveTaskIdentifier() {
        XCTAssertEqual(
            BackgroundSessionManager.keepAliveTaskIdentifier,
            "com.lecoder.mconnect.ws-keepalive"
        )
    }

    // MARK: - Weak Client Reference

    func testClientDeallocatedAfterConfigure() {
        var client: WSClient? = WSClient(tokenManager: TokenManager())
        manager.configure(wsClient: client!)
        client = nil

        // Should not crash — manager holds a weak reference
        manager.appDidEnterBackground()
        XCTAssertTrue(manager.isInBackground)
        XCTAssertFalse(manager.wasConnectedBeforeBackground)
    }

    // MARK: - Reset

    func testResetClearsAllState() {
        let client = WSClient(tokenManager: TokenManager())
        manager.configure(wsClient: client)
        manager.appDidEnterBackground()

        manager.resetForTesting()

        XCTAssertFalse(manager.isInBackground)
        XCTAssertFalse(manager.wasConnectedBeforeBackground)
        XCTAssertNil(manager.lastConnectedHost)
        XCTAssertNil(manager.lastAttachedSessionId)
    }

    // MARK: - Background Without Client Then Client Configured

    func testBackgroundThenConfigureDoesNotCrash() {
        // Background with no client
        manager.appDidEnterBackground()
        XCTAssertTrue(manager.isInBackground)

        // Configure while in background
        let client = WSClient(tokenManager: TokenManager())
        manager.configure(wsClient: client)

        // Foreground
        manager.appWillEnterForeground()
        XCTAssertFalse(manager.isInBackground)
    }
}
