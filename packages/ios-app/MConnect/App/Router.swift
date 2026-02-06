import SwiftUI

@MainActor
class Router: ObservableObject {
    enum Tab: Hashable {
        case hosts
        case agents
        case vault
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
}
