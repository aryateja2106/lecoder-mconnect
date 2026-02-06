import SwiftUI

@main
struct MConnectApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var router = Router()
    @StateObject private var authService = AuthService()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(router)
                .environmentObject(authService)
                .onOpenURL { url in
                    handleIncomingURL(url)
                }
        }
    }

    /// Route incoming `mconnect://` URLs to the appropriate handler.
    private func handleIncomingURL(_ url: URL) {
        guard url.scheme == "mconnect" else { return }

        switch url.host {
        case "callback":
            Task {
                do {
                    try await authService.handleCallback(url)
                } catch {
                    print("OAuth callback error: \(error.localizedDescription)")
                }
            }
        default:
            break
        }
    }
}

struct ContentView: View {
    @EnvironmentObject var router: Router

    var body: some View {
        TabView(selection: $router.selectedTab) {
            HostListView()
                .tabItem {
                    Label("Hosts", systemImage: "server.rack")
                }
                .tag(Router.Tab.hosts)

            AgentDashboard()
                .tabItem {
                    Label("Agents", systemImage: "cpu")
                }
                .tag(Router.Tab.agents)

            VaultView()
                .tabItem {
                    Label("Vault", systemImage: "lock.shield")
                }
                .tag(Router.Tab.vault)
        }
    }
}
