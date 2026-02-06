import Foundation
import Network
import os

/// Monitors network path changes using `NWPathMonitor` and publishes reachability state.
///
/// - Detects transitions between satisfied / unsatisfied / requiresConnection.
/// - Fires a callback when the network becomes reachable after a period of being unreachable,
///   which the WebSocket client uses to trigger immediate reconnection.
@MainActor
class NetworkMonitor: ObservableObject {

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

    // MARK: - Callback

    /// Called on the main actor when the network transitions from unreachable to reachable.
    var onNetworkRestored: (() -> Void)?

    // MARK: - Private

    private let monitor: NWPathMonitor
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

        let interfaceName = path.availableInterfaces.first?.type.debugDescription ?? "none"
        logger.info("Network path: \(path.status == .satisfied ? "satisfied" : "unsatisfied"), interface: \(interfaceName), expensive: \(path.isExpensive)")

        // Fire restoration callback when transitioning from unreachable → reachable
        if !wasReachable && nowReachable {
            logger.info("Network restored — triggering reconnection callback")
            onNetworkRestored?()
        }
    }
}

// MARK: - NWInterface.InterfaceType Debug

extension NWInterface.InterfaceType {
    var debugDescription: String {
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
