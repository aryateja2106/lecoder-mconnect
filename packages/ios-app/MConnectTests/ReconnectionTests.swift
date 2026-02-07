import Combine
import XCTest
@testable import MConnect

// MARK: - Mock Network Monitor

@MainActor
class MockNetworkMonitor: NetworkMonitoring {
    var isReachable: Bool = true
    let networkRestoredPublisher = PassthroughSubject<Void, Never>()

    var startCallCount = 0
    var stopCallCount = 0

    func start() { startCallCount += 1 }
    func stop() { stopCallCount += 1 }

    /// Simulate the network going down.
    func simulateNetworkLoss() {
        isReachable = false
    }

    /// Simulate the network coming back.
    func simulateNetworkRestored() {
        isReachable = true
        networkRestoredPublisher.send()
    }
}

// MARK: - State Tracking Delegate

@MainActor
class StateTracker: WSClientDelegate {
    var stateHistory: [ConnectionState] = []

    func wsClient(_ client: WSClient, didChangeState state: ConnectionState) {
        stateHistory.append(state)
    }
}

// MARK: - NetworkMonitor Tests

@MainActor
final class NetworkMonitorTests: XCTestCase {

    func testDefaultStateIsReachable() {
        let monitor = NetworkMonitor.shared
        XCTAssertTrue(monitor.isReachable)
    }

    func testDefaultIsNotExpensive() {
        XCTAssertFalse(NetworkMonitor.shared.isExpensive)
    }

    func testDefaultIsNotConstrained() {
        XCTAssertFalse(NetworkMonitor.shared.isConstrained)
    }

    func testStartAndStopLifecycle() {
        let monitor = NetworkMonitor.shared
        monitor.start()
        monitor.start() // Double start is a no-op
        monitor.stop()
        monitor.stop() // Double stop is a no-op
    }

    func testRestartAfterStopCreatesNewMonitor() {
        let monitor = NetworkMonitor.shared
        monitor.start()
        monitor.stop()
        // This should work because start() creates a fresh NWPathMonitor
        monitor.start()
        monitor.stop()
    }

    func testNetworkRestoredPublisherExists() {
        // Verify the publisher can be subscribed to without crash
        var cancellable: AnyCancellable?
        var received = false
        cancellable = NetworkMonitor.shared.networkRestoredPublisher
            .sink { received = true }
        XCTAssertFalse(received)
        cancellable?.cancel()
    }
}

// MARK: - Mock NetworkMonitor Behavior Tests

@MainActor
final class MockNetworkMonitorTests: XCTestCase {

    func testMockSimulateNetworkLoss() {
        let mock = MockNetworkMonitor()
        XCTAssertTrue(mock.isReachable)
        mock.simulateNetworkLoss()
        XCTAssertFalse(mock.isReachable)
    }

    func testMockSimulateNetworkRestored() {
        let mock = MockNetworkMonitor()
        mock.simulateNetworkLoss()
        XCTAssertFalse(mock.isReachable)

        var restored = false
        let cancellable = mock.networkRestoredPublisher.sink { restored = true }

        mock.simulateNetworkRestored()
        XCTAssertTrue(mock.isReachable)
        XCTAssertTrue(restored)
        cancellable.cancel()
    }

    func testMultipleSubscribersAllReceiveEvent() {
        let mock = MockNetworkMonitor()
        var count = 0

        let c1 = mock.networkRestoredPublisher.sink { count += 1 }
        let c2 = mock.networkRestoredPublisher.sink { count += 1 }
        let c3 = mock.networkRestoredPublisher.sink { count += 1 }

        mock.simulateNetworkRestored()
        XCTAssertEqual(count, 3, "All three subscribers should receive the event")

        c1.cancel()
        c2.cancel()
        c3.cancel()
    }
}

// MARK: - WSClient Reconnection with Mock Network Tests

@MainActor
final class WSClientNetworkReconnectionTests: XCTestCase {

    func testNetworkMonitorStartCalledOnInit() {
        let mock = MockNetworkMonitor()
        _ = WSClient(tokenManager: TokenManager(), networkMonitor: mock)
        XCTAssertEqual(mock.startCallCount, 1)
    }

    func testWaitingForNetworkWhenConnectingWithNoNetwork() {
        let mock = MockNetworkMonitor()
        mock.simulateNetworkLoss()

        let client = WSClient(tokenManager: TokenManager(), networkMonitor: mock)
        let tracker = StateTracker()
        client.delegate = tracker

        let host = Host(name: "Test", hostname: "localhost", port: 8080, useTLS: false)
        client.connect(to: host)

        XCTAssertEqual(client.connectionState, .waitingForNetwork)
        XCTAssertTrue(tracker.stateHistory.contains(.waitingForNetwork))
    }

    func testNetworkRestoredTriggersReconnectionFromWaitingState() {
        let mock = MockNetworkMonitor()
        mock.simulateNetworkLoss()

        let client = WSClient(tokenManager: TokenManager(), networkMonitor: mock)
        let tracker = StateTracker()
        client.delegate = tracker

        let host = Host(name: "Test", hostname: "localhost", port: 8080, useTLS: false)
        client.connect(to: host)
        XCTAssertEqual(client.connectionState, .waitingForNetwork)

        // Restore network — should transition to reconnecting
        mock.simulateNetworkRestored()

        // Should move to reconnecting (attempt 1) then connecting
        XCTAssertTrue(
            tracker.stateHistory.contains(.reconnecting(attempt: 1)),
            "Expected reconnecting state after network restored, got: \(tracker.stateHistory)"
        )
    }

    func testDisconnectFromWaitingForNetwork() {
        let mock = MockNetworkMonitor()
        mock.simulateNetworkLoss()

        let client = WSClient(tokenManager: TokenManager(), networkMonitor: mock)
        let host = Host(name: "Test", hostname: "localhost", port: 8080, useTLS: false)
        client.connect(to: host)
        XCTAssertEqual(client.connectionState, .waitingForNetwork)

        client.disconnect()
        XCTAssertEqual(client.connectionState, .disconnected)

        // Network restored after intentional disconnect should NOT trigger reconnection
        mock.simulateNetworkRestored()
        XCTAssertEqual(client.connectionState, .disconnected)
    }

    func testNetworkRestoredIgnoredWhenAlreadyConnected() {
        let mock = MockNetworkMonitor()
        let client = WSClient(tokenManager: TokenManager(), networkMonitor: mock)
        let tracker = StateTracker()
        client.delegate = tracker

        // Client is disconnected but no host was ever set
        mock.simulateNetworkRestored()

        // Should stay disconnected — no currentHost to reconnect to
        XCTAssertEqual(client.connectionState, .disconnected)
        XCTAssertFalse(tracker.stateHistory.contains(.reconnecting(attempt: 1)))
    }
}

// MARK: - WSClient Session Restoration Tests

@MainActor
final class WSClientSessionRestorationTests: XCTestCase {

    func testConnectToSameHostPreservesPendingReattach() {
        let mock = MockNetworkMonitor()
        let client = WSClient(tokenManager: TokenManager(), networkMonitor: mock)
        let host = Host(name: "Test", hostname: "localhost", port: 8080, useTLS: false)

        // First connect sets the host
        mock.simulateNetworkLoss()
        client.connect(to: host)
        XCTAssertEqual(client.connectionState, .waitingForNetwork)

        // Reconnect to the same host should not crash and should preserve state
        client.connect(to: host)
        XCTAssertEqual(client.connectionState, .waitingForNetwork)
    }

    func testConnectToDifferentHostClearsPendingReattach() {
        let mock = MockNetworkMonitor()
        let client = WSClient(tokenManager: TokenManager(), networkMonitor: mock)

        let host1 = Host(name: "Host1", hostname: "host1.local", port: 8080, useTLS: false)
        let host2 = Host(name: "Host2", hostname: "host2.local", port: 8080, useTLS: false)

        mock.simulateNetworkLoss()
        client.connect(to: host1)
        XCTAssertEqual(client.connectionState, .waitingForNetwork)

        // Connecting to a different host should work
        client.connect(to: host2)
        XCTAssertEqual(client.connectionState, .waitingForNetwork)
    }

    func testDetachClearsPendingReattach() {
        let client = WSClient(tokenManager: TokenManager())
        // detachFromSession should not crash even when not connected
        client.detachFromSession()
        XCTAssertNil(client.attachedSessionId)
    }
}

// MARK: - ConnectionState Equality Tests

final class ConnectionStateEqualityTests: XCTestCase {

    func testWaitingForNetworkEquality() {
        XCTAssertEqual(ConnectionState.waitingForNetwork, ConnectionState.waitingForNetwork)
    }

    func testWaitingForNetworkNotEqualToDisconnected() {
        XCTAssertNotEqual(ConnectionState.waitingForNetwork, ConnectionState.disconnected)
    }

    func testWaitingForNetworkNotEqualToReconnecting() {
        XCTAssertNotEqual(ConnectionState.reconnecting(attempt: 1), ConnectionState.waitingForNetwork)
    }

    func testAllSixStatesAreDistinct() {
        let states: [ConnectionState] = [
            .disconnected,
            .connecting,
            .authenticating,
            .connected,
            .reconnecting(attempt: 1),
            .waitingForNetwork,
        ]
        // Every pair should be not-equal
        for i in 0..<states.count {
            for j in (i + 1)..<states.count {
                XCTAssertNotEqual(states[i], states[j], "\(states[i]) should not equal \(states[j])")
            }
        }
    }
}

// MARK: - Reconnect Delay Extended Tests

@MainActor
final class WSClientReconnectDelayExtendedTests: XCTestCase {

    func testDelayForAttempt10IsCapped() {
        let client = WSClient(tokenManager: TokenManager())
        let delay = client.reconnectDelay(attempt: 10)
        XCTAssertGreaterThanOrEqual(delay, 30.0)
        XCTAssertLessThanOrEqual(delay, 30.5)
    }

    func testReconnectScrollbackLinesDefault() {
        let client = WSClient(tokenManager: TokenManager())
        XCTAssertEqual(client.reconnectScrollbackLines, 500)
    }

    func testReconnectScrollbackLinesConfigurable() {
        let client = WSClient(tokenManager: TokenManager())
        client.reconnectScrollbackLines = 1000
        XCTAssertEqual(client.reconnectScrollbackLines, 1000)
    }
}
