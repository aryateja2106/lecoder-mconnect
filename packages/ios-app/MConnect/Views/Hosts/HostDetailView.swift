import SwiftUI

struct HostDetailView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel: HostDetailViewModel

    init(host: Host?) {
        _viewModel = StateObject(wrappedValue: HostDetailViewModel(host: host))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Connection") {
                    TextField("Name", text: $viewModel.name)
                    TextField("Hostname", text: $viewModel.hostname)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
                    TextField("Port", text: $viewModel.port)
                        .keyboardType(.numberPad)
                }

                Section("Security") {
                    Toggle("Use TLS", isOn: $viewModel.useTLS)
                    Toggle("Require Biometric", isOn: $viewModel.requireBiometric)
                }

                if viewModel.isEditing {
                    Section {
                        Button("Connect", systemImage: "play.fill") {
                            viewModel.connect()
                        }
                    }

                    Section {
                        Button("Delete Host", role: .destructive) {
                            viewModel.delete()
                            dismiss()
                        }
                    }
                }
            }
            .navigationTitle(viewModel.isEditing ? "Edit Host" : "Add Host")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        viewModel.save()
                        dismiss()
                    }
                    .disabled(!viewModel.isValid)
                }
            }
        }
    }
}

@MainActor
class HostDetailViewModel: ObservableObject {
    @Published var name = ""
    @Published var hostname = ""
    @Published var port = "8080"
    @Published var useTLS = true
    @Published var requireBiometric = false

    let isEditing: Bool
    private var existingHost: Host?

    init(host: Host?) {
        self.existingHost = host
        self.isEditing = host != nil
        if let host {
            self.name = host.name
            self.hostname = host.hostname
            self.port = String(host.port)
            self.useTLS = host.useTLS
        }
    }

    var isValid: Bool {
        !name.isEmpty && !hostname.isEmpty && Int(port) != nil
    }

    func save() {
        // Will persist to Keychain
    }

    func connect() {
        // Will initiate WebSocket connection
    }

    func delete() {
        // Will remove from Keychain
    }
}
