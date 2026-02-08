import Combine
import Foundation
import Network
import os

/// Protocol for network monitoring — extracted for testability.
@MainActor
protocol NetworkMonitoring: AnyObject {
    var isReachable: Bool { get }
    var networkRestoredPublisher: PassthroughSubject<Void, Never> { get }
    func start()
    func stop()
}

/// Monitors network path changes using `NWPathMonitor` and publishes reachability state.
///
/// - Detects transitions between satisfied / unsatisfied / requiresConnection.
/// - Publishes a `networkRestored` event when the network transitions from
///   unreachable to reachable, which subscribers (e.g., `WSClient`) use to
///   trigger immediate reconnection.
@MainActor
class NetworkMonitor: ObservableObject, NetworkMonitoring {

    static let shared = NetworkMonitor()

    // MARK: - Published State

    /// Whether a usable network path currently exists.
    @Published private(set) var isReachable: Bool = true

    /// The current interface type (wifi, cellular, wiredEthernet, etc.).
    @Published private(set) var interfaceType: NWInterface.InterfaceType?

    /// Whether the connection is expensive (cellular, hotspot).
    @Published private(set) var isExpensive: Bool = false

    /// Whether the connection is constrained (Low Data Mode).
    @Published private(set) var isConstrained: Bool = false

    // MARK: - Network Restored Event

    /// Fires when the network transitions from unreachable to reachable.
    /// Multiple subscribers can listen without clobbering each other.
    let networkRestoredPublisher = PassthroughSubject<Void, Never>()

    // MARK: - Private

    /// The active path monitor. Replaced on each `start()` because
    /// `NWPathMonitor.cancel()` is terminal — a cancelled monitor cannot be restarted.
    private var monitor: NWPathMonitor
    private let queue = DispatchQueue(label: "com.lecoder.mconnect.network-monitor")
    private let logger = Logger(subsystem: "com.lecoder.mconnect", category: "NetworkMonitor")
    private var isMonitoring = false

    private init() {
        monitor = NWPathMonitor()
    }

    // MARK: - Lifecycle

    /// Start monitoring network changes. Safe to call multiple times.
    func start() {
        guard !isMonitoring else { return }
        isMonitoring = true

        // Create a fresh monitor — NWPathMonitor.cancel() is terminal, so a
        // previously stopped monitor cannot be reused.
        monitor = NWPathMonitor()
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                self?.handlePathUpdate(path)
            }
        }
        monitor.start(queue: queue)
        logger.info("Network monitoring started")
    }

    /// Stop monitoring. Safe to call if not started.
    func stop() {
        guard isMonitoring else { return }
        isMonitoring = false
        monitor.cancel()
        logger.info("Network monitoring stopped")
    }

    // MARK: - Path Update

    private func handlePathUpdate(_ path: NWPath) {
        let wasReachable = isReachable
        let nowReachable = path.status == .satisfied

        isReachable = nowReachable
        isExpensive = path.isExpensive
        isConstrained = path.isConstrained
        interfaceType = path.availableInterfaces.first?.type

        let interfaceName = path.availableInterfaces.first?.type.displayName ?? "none"
        logger.info("Network path: \(path.status == .satisfied ? "satisfied" : "unsatisfied"), interface: \(interfaceName), expensive: \(path.isExpensive)")

        // Fire restoration event when transitioning from unreachable → reachable
        if !wasReachable && nowReachable {
            logger.info("Network restored — notifying subscribers")
            networkRestoredPublisher.send()
        }
    }
}

// MARK: - NWInterface.InterfaceType Display Name

extension NWInterface.InterfaceType {
    var displayName: String {
        switch self {
        case .wifi: return "wifi"
        case .cellular: return "cellular"
        case .wiredEthernet: return "wiredEthernet"
        case .loopback: return "loopback"
        case .other: return "other"
        @unknown default: return "unknown"
        }
    }
}
