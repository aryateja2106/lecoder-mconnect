import SwiftUI

@main
struct MConnectApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var router = Router()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(router)
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
