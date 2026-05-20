import SwiftUI
import UIKit

struct HostDetailView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel: HostDetailViewModel

    init(host: Host?, onSave: ((Host) -> Void)?, onDelete: ((Host) -> Void)?, onConnect: ((Host) -> Void)?) {
        _viewModel = StateObject(wrappedValue: HostDetailViewModel(
            host: host,
            onSave: onSave,
            onDelete: onDelete,
            onConnect: onConnect
        ))
    }

    var body: some View {
        Form {
            Section("Connection") {
                Picker("Role", selection: $viewModel.role) {
                    ForEach(HostRole.allCases) { role in
                        Label(role.displayName, systemImage: role.iconName)
                            .tag(role)
                    }
                }
                TextField("Name", text: $viewModel.name)
                TextField("Hostname or IP", text: $viewModel.hostname)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                TextField("Port", text: $viewModel.port)
                    .keyboardType(.numberPad)
            }

            if viewModel.role != .mconnectDaemon {
                Section("SSH") {
                    TextField("Username", text: $viewModel.sshUsername)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    TextField("SSH Port", text: $viewModel.sshPort)
                        .keyboardType(.numberPad)
                }
            }

            if viewModel.role == .gpuWorker {
                Section("Compute") {
                    TextField("Provider", text: $viewModel.gpuProvider)
                        .textInputAutocapitalization(.words)
                    TextField("Budget Hours", text: $viewModel.computeBudgetHours)
                        .keyboardType(.decimalPad)
                    Picker("Loop", selection: $viewModel.agentLoopPreset) {
                        ForEach(AgentLoopPreset.allCases) { preset in
                            Text(preset.displayName).tag(preset)
                        }
                    }
                }
            } else if viewModel.role == .macTerminal {
                Section("Agent Loop") {
                    Picker("Default", selection: $viewModel.agentLoopPreset) {
                        ForEach(AgentLoopPreset.allCases) { preset in
                            Text(preset.displayName).tag(preset)
                        }
                    }
                }
            }

            if viewModel.role != .mconnectDaemon {
                Section("Bootstrap") {
                    CommandBlock(title: "Key", command: viewModel.sshKeySetupCommand) {
                        viewModel.copy(viewModel.sshKeySetupCommand)
                    }
                    CommandBlock(title: "Daemon", command: viewModel.mconnectStartCommand) {
                        viewModel.copy(viewModel.mconnectStartCommand)
                    }
                    CommandBlock(title: "Loop", command: viewModel.agentLoopCommand) {
                        viewModel.copy(viewModel.agentLoopCommand)
                    }
                }
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

            if viewModel.isEditing {
                Section {
                    Button("Connect", systemImage: "terminal") {
                        viewModel.connect()
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

private struct CommandBlock: View {
    let title: String
    let command: String
    let onCopy: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
                Spacer()
                Button("Copy", systemImage: "doc.on.doc", action: onCopy)
                    .buttonStyle(.borderless)
                    .controlSize(.small)
            }

            Text(command)
                .font(.system(.caption2, design: .monospaced))
                .foregroundStyle(.primary)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 4)
    }
}

@MainActor
class HostDetailViewModel: ObservableObject {
    @Published var name = ""
    @Published var hostname = ""
    @Published var port = "8080"
    @Published var useTLS = true
    @Published var requireBiometric = false
    @Published var showDeleteConfirmation = false
    @Published var role: HostRole = .mconnectDaemon
    @Published var sshUsername = "ubuntu"
    @Published var sshPort = "22"
    @Published var gpuProvider = ""
    @Published var computeBudgetHours = ""
    @Published var agentLoopPreset: AgentLoopPreset = .codexAuto

    let isEditing: Bool
    private var existingHost: Host?
    private var onSave: ((Host) -> Void)?
    private var onDelete: ((Host) -> Void)?
    private var onConnect: ((Host) -> Void)?

    init(host: Host?, onSave: ((Host) -> Void)?, onDelete: ((Host) -> Void)?, onConnect: ((Host) -> Void)?) {
        self.existingHost = host
        self.isEditing = host != nil
        self.onSave = onSave
        self.onDelete = onDelete
        self.onConnect = onConnect
        if let host {
            self.name = host.name
            self.hostname = host.hostname
            self.port = String(host.port)
            self.useTLS = host.useTLS
            self.requireBiometric = host.requireBiometric
            self.role = host.effectiveRole
            self.sshUsername = host.effectiveSSHUsername
            self.sshPort = String(host.effectiveSSHPort)
            self.gpuProvider = host.gpuProvider ?? ""
            self.computeBudgetHours = host.computeBudgetHours.map { String(format: "%.1f", $0) } ?? ""
            self.agentLoopPreset = host.effectiveAgentLoopPreset
        }
    }

    var isValid: Bool {
        let validBase = !name.trimmingCharacters(in: .whitespaces).isEmpty
            && !hostname.trimmingCharacters(in: .whitespaces).isEmpty
            && Int(port) != nil
            && (Int(port) ?? 0) > 0
            && (Int(port) ?? 0) <= 65535
        let validSSH = role == .mconnectDaemon || (
            !sshUsername.trimmingCharacters(in: .whitespaces).isEmpty
                && Int(sshPort) != nil
                && (Int(sshPort) ?? 0) > 0
                && (Int(sshPort) ?? 0) <= 65535
        )
        let trimmedBudget = computeBudgetHours.trimmingCharacters(in: .whitespaces)
        let validBudget = role != .gpuWorker || trimmedBudget.isEmpty || Double(trimmedBudget) != nil
        return validBase && validSSH && validBudget
    }

    var previewHost: Host {
        buildHost() ?? Host(name: name.isEmpty ? "Host" : name, hostname: hostname.isEmpty ? "example.com" : hostname)
    }

    var sshKeySetupCommand: String {
        previewHost.sshKeySetupCommand
    }

    var mconnectStartCommand: String {
        previewHost.mconnectStartCommand
    }

    var agentLoopCommand: String {
        previewHost.agentLoopCommand
    }

    func save() {
        guard let host = buildHost() else { return }
        onSave?(host)
    }

    func connect() {
        guard let host = buildHost() else { return }
        onSave?(host)
        onConnect?(host)
    }

    func copy(_ text: String) {
        UIPasteboard.general.string = text
    }

    private func buildHost() -> Host? {
        guard isValid else { return nil }
        let budgetText = computeBudgetHours.trimmingCharacters(in: .whitespaces)
        let budget = budgetText.isEmpty ? nil : Double(budgetText)
        let host = Host(
            id: existingHost?.id ?? UUID().uuidString,
            name: name.trimmingCharacters(in: .whitespaces),
            hostname: hostname.trimmingCharacters(in: .whitespaces),
            port: Int(port) ?? 8080,
            useTLS: useTLS,
            requireBiometric: requireBiometric,
            isConnected: existingHost?.isConnected ?? false,
            role: role,
            sshUsername: role == .mconnectDaemon ? nil : sshUsername.trimmingCharacters(in: .whitespaces),
            sshPort: role == .mconnectDaemon ? nil : Int(sshPort),
            gpuProvider: role == .gpuWorker ? gpuProvider.trimmingCharacters(in: .whitespaces) : nil,
            computeBudgetHours: role == .gpuWorker ? budget : nil,
            agentLoopPreset: role == .mconnectDaemon ? nil : agentLoopPreset
        )
        return host
    }

    func delete() {
        guard let host = existingHost else { return }
        onDelete?(host)
    }
}
