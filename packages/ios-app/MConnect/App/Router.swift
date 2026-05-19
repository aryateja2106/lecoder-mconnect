import SwiftUI
import Combine

@MainActor
class Router: ObservableObject {
    enum Tab: Hashable {
        case hosts
        case agents
        case vault
        case screen
    }

    enum Destination: Hashable {
        case hostDetail(Host)
        case terminal(Host)
        case agentDetail(Agent)
        case agentTerminal(Agent, Host)
        case qrScanner
        case vaultItem(VaultItem?)
    }

    @Published var selectedTab: Tab = .hosts
    @Published var hostPath = NavigationPath()
    @Published var agentPath = NavigationPath()

    /// Session ID to navigate to when opened from a push notification.
    @Published var pendingSessionId: String?

    private var cancellables = Set<AnyCancellable>()

    init() {
        setupNotificationObservers()
    }

    func navigate(to destination: Destination) {
        switch destination {
        case .hostDetail, .terminal, .qrScanner, .agentTerminal:
            selectedTab = .hosts
            hostPath.append(destination)
        case .agentDetail:
            selectedTab = .agents
            agentPath.append(destination)
        case .vaultItem:
            selectedTab = .vault
        }
    }

    func popToRoot() {
        hostPath = NavigationPath()
        agentPath = NavigationPath()
    }

    // MARK: - Notification Deep Linking

    /// Navigate to a session from a push notification.
    func openSession(_ sessionId: String) {
        pendingSessionId = sessionId
        selectedTab = .agents
        agentPath = NavigationPath()
    }

    private func setupNotificationObservers() {
        NotificationCenter.default.publisher(for: .openSession)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] notification in
                guard let sessionId = notification.userInfo?["sessionId"] as? String else { return }
                self?.openSession(sessionId)
            }
            .store(in: &cancellables)
    }
}
