import SwiftUI

struct HostDetailView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var router: Router
    @StateObject private var viewModel: HostDetailViewModel

    init(host: Host?, onSave: ((Host) -> Void)?, onDelete: ((Host) -> Void)?) {
        _viewModel = StateObject(wrappedValue: HostDetailViewModel(
            host: host,
            onSave: onSave,
            onDelete: onDelete
        ))
    }

    var body: some View {
        Form {
            Section("Connection") {
                TextField("Name", text: $viewModel.name)
                TextField("Hostname or IP", text: $viewModel.hostname)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                TextField("Port", text: $viewModel.port)
                    .keyboardType(.numberPad)
            }

            Section("Security") {
                Toggle("Use TLS", isOn: $viewModel.useTLS)
                Toggle("Require Biometric", isOn: $viewModel.requireBiometric)
                if viewModel.requireBiometric {
                    Text("Face ID or Touch ID will be required each time you connect to this host.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Section("Access Token") {
                TextField("Pairing token (CLI session)", text: $viewModel.accessToken)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .font(.system(.caption, design: .monospaced))
                Text("Paste the token from `mconnect info --json`. Leave empty for body-auth servers.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if viewModel.isEditing {
                Section {
                    Button("Connect", systemImage: "play.fill") {
                        if let saved = viewModel.save() {
                            router.hostPath.append(Router.Destination.terminal(saved))
                        }
                    }
                    .disabled(!viewModel.isValid)
                }

                Section {
                    Button("Delete Host", role: .destructive) {
                        viewModel.showDeleteConfirmation = true
                    }
                }
            }
        }
        .navigationTitle(viewModel.isEditing ? viewModel.name : "Add Host")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                if !viewModel.isEditing {
                    Button("Cancel") { dismiss() }
                }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button(viewModel.isEditing ? "Save" : "Add") {
                    viewModel.save()
                    dismiss()
                }
                .disabled(!viewModel.isValid)
            }
        }
        .confirmationDialog(
            "Delete Host",
            isPresented: $viewModel.showDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                viewModel.delete()
                dismiss()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Are you sure you want to delete \"\(viewModel.name)\"? This cannot be undone.")
        }
    }
}

@MainActor
class HostDetailViewModel: ObservableObject {
    @Published var name = ""
    @Published var hostname = ""
    @Published var port = "8080"
    @Published var useTLS = false
    @Published var requireBiometric = false
    @Published var accessToken = ""
    @Published var showDeleteConfirmation = false

    let isEditing: Bool
    private var existingHost: Host?
    private var onSave: ((Host) -> Void)?
    private var onDelete: ((Host) -> Void)?

    init(host: Host?, onSave: ((Host) -> Void)?, onDelete: ((Host) -> Void)?) {
        self.existingHost = host
        self.isEditing = host != nil
        self.onSave = onSave
        self.onDelete = onDelete
        if let host {
            self.name = host.name
            self.hostname = host.hostname
            self.port = String(host.port)
            self.useTLS = host.useTLS
            self.requireBiometric = host.requireBiometric
            self.accessToken = host.accessToken ?? ""
        }
    }

    var isValid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
            && !hostname.trimmingCharacters(in: .whitespaces).isEmpty
            && Int(port) != nil
            && (Int(port) ?? 0) > 0
            && (Int(port) ?? 0) <= 65535
    }

    @discardableResult
    func save() -> Host? {
        guard isValid else { return nil }
        let trimmedToken = accessToken.trimmingCharacters(in: .whitespacesAndNewlines)
        let host = Host(
            id: existingHost?.id ?? UUID().uuidString,
            name: name.trimmingCharacters(in: .whitespaces),
            hostname: hostname.trimmingCharacters(in: .whitespaces),
            port: Int(port) ?? 8080,
            useTLS: useTLS,
            requireBiometric: requireBiometric,
            isConnected: existingHost?.isConnected ?? false,
            accessToken: trimmedToken.isEmpty ? nil : trimmedToken
        )
        onSave?(host)
        return host
    }

    func delete() {
        guard let host = existingHost else { return }
        onDelete?(host)
    }
}
