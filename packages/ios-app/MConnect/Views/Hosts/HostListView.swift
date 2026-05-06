import SwiftUI

struct HostListView: View {
    @EnvironmentObject private var router: Router
    @StateObject private var viewModel = HostListViewModel()
    @StateObject private var wsClient = WSClient()

    var body: some View {
        NavigationStack(path: $router.hostPath) {
            Group {
                if viewModel.hosts.isEmpty {
                    ContentUnavailableView(
                        "No Hosts",
                        systemImage: "server.rack",
                        description: Text("Add a host to get started. Scan a QR code or add one manually.")
                    )
                } else {
                    List {
                        ForEach(viewModel.hosts) { host in
                            NavigationLink(value: Router.Destination.hostDetail(host)) {
                                HostRow(host: host)
                            }
                        }
                        .onDelete(perform: viewModel.deleteHosts)
                    }
                }
            }
            .navigationTitle("Hosts")
            .navigationDestination(for: Router.Destination.self) { destination in
                switch destination {
                case .hostDetail(let host):
                    HostDetailView(host: host, onSave: viewModel.updateHost, onDelete: viewModel.removeHost)
                case .terminal(let host):
                    TerminalView(host: host, wsClient: wsClient, fab: {
                        AnyView(
                            FloatingActionBar(items: [
                                FloatingActionItem(kind: .pin, action: {}),
                                FloatingActionItem(kind: .keyboard, action: {}),
                                FloatingActionItem(kind: .info, action: {}),
                                FloatingActionItem(kind: .help, action: {}),
                                FloatingActionItem(kind: .disconnect, action: { wsClient.disconnect() })
                            ])
                        )
                    })
                case .qrScanner:
                    QRScannerView { url in
                        viewModel.handleQRCode(url)
                    }
                default:
                    EmptyView()
                }
            }
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button("Scan QR Code", systemImage: "qrcode.viewfinder") {
                            viewModel.showScanner = true
                        }
                        Button("Add Manually", systemImage: "plus") {
                            viewModel.showAddHost = true
                        }
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $viewModel.showScanner) {
                QRScannerView { url in
                    viewModel.handleQRCode(url)
                    viewModel.showScanner = false
                }
            }
            .sheet(isPresented: $viewModel.showAddHost) {
                NavigationStack {
                    HostDetailView(host: nil, onSave: viewModel.addHost, onDelete: nil)
                }
            }
            .alert("QR Code Error", isPresented: $viewModel.showQRError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.qrErrorMessage)
            }
        }
    }
}

struct HostRow: View {
    let host: Host

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(host.name)
                    .font(.headline)
                HStack(spacing: 4) {
                    Text(host.hostname)
                    Text(":\(host.port)")
                        .foregroundStyle(.tertiary)
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            Spacer()

            if host.requireBiometric {
                Image(systemName: "faceid")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if host.useTLS {
                Image(systemName: "lock.fill")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Circle()
                .fill(host.isConnected ? Color.green : Color.gray.opacity(0.4))
                .frame(width: 8, height: 8)
        }
        .padding(.vertical, 4)
    }
}

@MainActor
class HostListViewModel: ObservableObject {
    @Published var hosts: [Host] = []
    @Published var showScanner = false
    @Published var showAddHost = false
    @Published var showQRError = false
    var qrErrorMessage = ""

    private let keychain = KeychainService.shared

    init() {
        loadHosts()
    }

    // MARK: - Persistence

    func loadHosts() {
        do {
            hosts = try keychain.loadCodable([Host].self, forKey: KeychainItems.hostProfiles)
        } catch {
            hosts = []
        }
    }

    private func saveHosts() {
        do {
            try keychain.saveCodable(hosts, forKey: KeychainItems.hostProfiles)
        } catch {
            // Keychain save failed — hosts remain in memory for this session
        }
    }

    // MARK: - CRUD

    func addHost(_ host: Host) {
        hosts.append(host)
        saveHosts()
    }

    func updateHost(_ host: Host) {
        if let index = hosts.firstIndex(where: { $0.id == host.id }) {
            hosts[index] = host
            saveHosts()
        } else {
            addHost(host)
        }
    }

    func removeHost(_ host: Host) {
        hosts.removeAll { $0.id == host.id }
        saveHosts()
    }

    func deleteHosts(at offsets: IndexSet) {
        hosts.remove(atOffsets: offsets)
        saveHosts()
    }

    // MARK: - QR Code

    /// Parses a QR code URL and creates a host from it.
    ///
    /// Expected URL format: `mconnect://<hostname>:<port>?name=<name>&tls=<true|false>`
    /// Fallback format: `<hostname>:<port>` (plain text)
    func handleQRCode(_ urlString: String) {
        if let url = URL(string: urlString), url.scheme == "mconnect" {
            parseMConnectURL(url)
        } else {
            parsePlainHostPort(urlString)
        }
    }

    private func parseMConnectURL(_ url: URL) {
        guard let host = url.host, !host.isEmpty else {
            showError("Invalid QR code: missing hostname")
            return
        }

        let port = url.port ?? 8080
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let queryItems = components?.queryItems ?? []
        let name = queryItems.first(where: { $0.name == "name" })?.value ?? host
        let tls = queryItems.first(where: { $0.name == "tls" })?.value != "false"

        let newHost = Host(name: name, hostname: host, port: port, useTLS: tls)
        addHost(newHost)
    }

    private func parsePlainHostPort(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let parts = trimmed.split(separator: ":", maxSplits: 1)

        guard let hostname = parts.first, !hostname.isEmpty else {
            showError("Invalid QR code: could not parse host address")
            return
        }

        let port: Int
        if parts.count > 1, let p = Int(parts[1]) {
            port = p
        } else {
            port = 8080
        }

        let newHost = Host(name: String(hostname), hostname: String(hostname), port: port)
        addHost(newHost)
    }

    private func showError(_ message: String) {
        qrErrorMessage = message
        showQRError = true
    }
}
