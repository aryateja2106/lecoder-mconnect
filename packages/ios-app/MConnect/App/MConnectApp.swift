import SwiftUI
import os

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

    /// Tracks the app process start time for launch profiling.
    private static let processStartTime = ProcessInfo.processInfo.systemUptime

    var body: some View {
        TabView(selection: $router.selectedTab) {
            HostListView()
                .tabItem {
                    Label("Hosts", systemImage: "server.rack")
                }
                .tag(Router.Tab.hosts)

            LazyView { AgentDashboard() }
                .tabItem {
                    Label("Agents", systemImage: "cpu")
                }
                .tag(Router.Tab.agents)

            LazyView { VaultView() }
                .tabItem {
                    Label("Vault", systemImage: "lock.shield")
                }
                .tag(Router.Tab.vault)

            LazyView { ScreenView() }
                .tabItem {
                    Label("Screen", systemImage: "rectangle.fill.on.rectangle.fill")
                }
                .tag(Router.Tab.screen)
        }
        .tint(.primary)
        .onAppear {
            let launchDuration = ProcessInfo.processInfo.systemUptime - Self.processStartTime
            Logger(subsystem: "com.lecoder.mconnect", category: "LaunchTime")
                .info("App launch to first frame: \(launchDuration, format: .fixed(precision: 3))s")
        }
    }
}

/// A view that defers building its content until it first appears.
struct LazyView<Content: View>: View {
    let build: () -> Content
    @State private var hasAppeared = false

    init(@ViewBuilder _ build: @escaping () -> Content) {
        self.build = build
    }

    var body: some View {
        if hasAppeared {
            build()
        } else {
            Color.clear
                .onAppear { hasAppeared = true }
        }
    }
}
