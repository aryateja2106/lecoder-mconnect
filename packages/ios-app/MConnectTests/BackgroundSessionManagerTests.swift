import XCTest
@testable import MConnect

@MainActor
final class BackgroundSessionManagerTests: XCTestCase {

    private var manager: BackgroundSessionManager!

    override func setUp() {
        super.setUp()
        manager = BackgroundSessionManager.shared
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
        // Should not crash when no WSClient is configured
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

    // MARK: - Configure Accepts WSClient

    func testConfigureAcceptsWSClient() {
        let client = WSClient(tokenManager: TokenManager())
        manager.configure(wsClient: client)
        // Should not crash; manager holds a weak reference
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
}
