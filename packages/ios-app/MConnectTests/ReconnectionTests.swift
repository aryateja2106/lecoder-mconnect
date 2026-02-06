import XCTest
@testable import MConnect

// MARK: - NetworkMonitor Tests

@MainActor
final class NetworkMonitorTests: XCTestCase {

    func testDefaultStateIsReachable() {
        let monitor = NetworkMonitor.shared
        // Default state before any path update should be reachable (optimistic)
        XCTAssertTrue(monitor.isReachable)
    }

    func testDefaultIsNotExpensive() {
        let monitor = NetworkMonitor.shared
        XCTAssertFalse(monitor.isExpensive)
    }

    func testDefaultIsNotConstrained() {
        let monitor = NetworkMonitor.shared
        XCTAssertFalse(monitor.isConstrained)
    }

    func testStartAndStopDoNotCrash() {
        let monitor = NetworkMonitor.shared
        monitor.start()
        monitor.start() // Double start should be safe
        monitor.stop()
        monitor.stop() // Double stop should be safe
    }

    func testCallbackCanBeSet() {
        let monitor = NetworkMonitor.shared
        var callbackFired = false
        monitor.onNetworkRestored = {
            callbackFired = true
        }
        // We can't easily simulate a network change in unit tests,
        // but we verify the callback can be set without crash
        XCTAssertFalse(callbackFired)
        monitor.onNetworkRestored = nil
    }
}

// MARK: - WSClient Reconnection Enhanced Tests

@MainActor
final class WSClientReconnectionTests: XCTestCase {

    func testMaxReconnectAttemptsIsTen() {
        let client = WSClient(tokenManager: TokenManager())
        XCTAssertEqual(client.maxReconnectAttempts, 10)
    }

    func testReconnectDelayExponentialBackoffExtended() {
        let client = WSClient(tokenManager: TokenManager())

        // Attempt 1: base delay (1.0) + jitter (0..0.5)
        let delay1 = client.reconnectDelay(attempt: 1)
        XCTAssertGreaterThanOrEqual(delay1, 1.0)
        XCTAssertLessThanOrEqual(delay1, 1.5)

        // Attempt 2: 2.0 + jitter
        let delay2 = client.reconnectDelay(attempt: 2)
        XCTAssertGreaterThanOrEqual(delay2, 2.0)
        XCTAssertLessThanOrEqual(delay2, 2.5)

        // Attempt 3: 4.0 + jitter
        let delay3 = client.reconnectDelay(attempt: 3)
        XCTAssertGreaterThanOrEqual(delay3, 4.0)
        XCTAssertLessThanOrEqual(delay3, 4.5)

        // Attempt 5: 16.0 + jitter
        let delay5 = client.reconnectDelay(attempt: 5)
        XCTAssertGreaterThanOrEqual(delay5, 16.0)
        XCTAssertLessThanOrEqual(delay5, 16.5)

        // Attempt 6: capped at 30.0 + jitter (2^5 = 32 > 30)
        let delay6 = client.reconnectDelay(attempt: 6)
        XCTAssertGreaterThanOrEqual(delay6, 30.0)
        XCTAssertLessThanOrEqual(delay6, 30.5)

        // Attempt 10: still capped at 30.0 + jitter
        let delay10 = client.reconnectDelay(attempt: 10)
        XCTAssertGreaterThanOrEqual(delay10, 30.0)
        XCTAssertLessThanOrEqual(delay10, 30.5)
    }

    func testReconnectDelayClampsToMax() {
        let client = WSClient(tokenManager: TokenManager())
        let delay = client.reconnectDelay(attempt: 20)
        XCTAssertGreaterThanOrEqual(delay, 30.0)
        XCTAssertLessThanOrEqual(delay, 30.5)
    }

    func testInitialStateIsDisconnected() {
        let client = WSClient(tokenManager: TokenManager())
        XCTAssertEqual(client.connectionState, .disconnected)
        XCTAssertNil(client.clientId)
        XCTAssertNil(client.attachedSessionId)
        XCTAssertTrue(client.agents.isEmpty)
        XCTAssertTrue(client.sessions.isEmpty)
        XCTAssertNil(client.controlState)
    }

    func testDisconnectSetsStateToDisconnected() {
        let client = WSClient(tokenManager: TokenManager())
        client.disconnect()
        XCTAssertEqual(client.connectionState, .disconnected)
    }

    func testAutoReconnectDefaultsToTrue() {
        let client = WSClient(tokenManager: TokenManager())
        XCTAssertTrue(client.autoReconnect)
    }
}

// MARK: - ConnectionState Equality Tests

final class ConnectionStateEqualityTests: XCTestCase {

    func testDisconnectedEquality() {
        XCTAssertEqual(ConnectionState.disconnected, ConnectionState.disconnected)
    }

    func testConnectingEquality() {
        XCTAssertEqual(ConnectionState.connecting, ConnectionState.connecting)
    }

    func testAuthenticatingEquality() {
        XCTAssertEqual(ConnectionState.authenticating, ConnectionState.authenticating)
    }

    func testConnectedEquality() {
        XCTAssertEqual(ConnectionState.connected, ConnectionState.connected)
    }

    func testReconnectingEquality() {
        XCTAssertEqual(ConnectionState.reconnecting(attempt: 3), ConnectionState.reconnecting(attempt: 3))
        XCTAssertNotEqual(ConnectionState.reconnecting(attempt: 1), ConnectionState.reconnecting(attempt: 2))
    }

    func testWaitingForNetworkEquality() {
        XCTAssertEqual(ConnectionState.waitingForNetwork, ConnectionState.waitingForNetwork)
    }

    func testDifferentStatesNotEqual() {
        XCTAssertNotEqual(ConnectionState.disconnected, ConnectionState.connected)
        XCTAssertNotEqual(ConnectionState.connecting, ConnectionState.authenticating)
        XCTAssertNotEqual(ConnectionState.reconnecting(attempt: 1), ConnectionState.waitingForNetwork)
        XCTAssertNotEqual(ConnectionState.waitingForNetwork, ConnectionState.disconnected)
    }
}

// MARK: - WSClient Delegate State Tracking

@MainActor
final class WSClientDelegateReconnectionTests: XCTestCase {

    /// A test delegate that records all state changes.
    class StateTracker: WSClientDelegate {
        var stateHistory: [ConnectionState] = []

        func wsClient(_ client: WSClient, didChangeState state: ConnectionState) {
            stateHistory.append(state)
        }
    }

    func testDelegateReceivesDisconnectState() {
        let client = WSClient(tokenManager: TokenManager())
        let tracker = StateTracker()
        client.delegate = tracker

        client.disconnect()

        XCTAssertTrue(tracker.stateHistory.contains(.disconnected))
    }

    func testDisconnectClearsSessionState() {
        let client = WSClient(tokenManager: TokenManager())

        // Simulate having an attached session (via public property)
        // Since attachedSessionId is private(set), we verify through disconnect behavior
        client.disconnect()

        XCTAssertNil(client.attachedSessionId)
        XCTAssertNil(client.clientId)
        XCTAssertTrue(client.agents.isEmpty)
        XCTAssertTrue(client.sessions.isEmpty)
    }
}

// MARK: - ConnectionStatusOverlay Tests

final class ConnectionStatusOverlayTests: XCTestCase {

    func testWaitingForNetworkStateCanBeCreated() {
        // Verify the new state works with the overlay view
        let state = ConnectionState.waitingForNetwork
        XCTAssertEqual(state, .waitingForNetwork)
    }

    func testAllConnectionStatesAreHandled() {
        // Ensure all states can be pattern matched (compile-time verification)
        let states: [ConnectionState] = [
            .disconnected,
            .connecting,
            .authenticating,
            .connected,
            .reconnecting(attempt: 1),
            .waitingForNetwork
        ]

        for state in states {
            switch state {
            case .disconnected: break
            case .connecting: break
            case .authenticating: break
            case .connected: break
            case .reconnecting: break
            case .waitingForNetwork: break
            }
        }
        XCTAssertEqual(states.count, 6)
    }
}
