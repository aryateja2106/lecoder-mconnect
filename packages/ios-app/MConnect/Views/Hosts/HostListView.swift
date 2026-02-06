import SwiftUI

struct HostListView: View {
    @StateObject private var viewModel = HostListViewModel()

    var body: some View {
        NavigationStack {
            List {
                if viewModel.hosts.isEmpty {
                    ContentUnavailableView(
                        "No Hosts",
                        systemImage: "server.rack",
                        description: Text("Add a host to get started.")
                    )
                } else {
                    ForEach(viewModel.hosts) { host in
                        NavigationLink(value: host) {
                            HostRow(host: host)
                        }
                    }
                    .onDelete(perform: viewModel.deleteHosts)
                }
            }
            .navigationTitle("Hosts")
            .navigationDestination(for: Host.self) { host in
                HostDetailView(host: host)
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
                }
            }
            .sheet(isPresented: $viewModel.showAddHost) {
                HostDetailView(host: nil)
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
                Text(host.hostname)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Circle()
                .fill(host.isConnected ? Color.green : Color.gray)
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

    func deleteHosts(at offsets: IndexSet) {
        hosts.remove(atOffsets: offsets)
    }

    func handleQRCode(_ url: String) {
        showScanner = false
        // Parse QR code URL and create host
    }
}
