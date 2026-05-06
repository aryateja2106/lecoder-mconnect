import SwiftUI
import os

struct VaultItemView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel: VaultItemViewModel

    init(item: VaultItem?) {
        _viewModel = StateObject(wrappedValue: VaultItemViewModel(item: item))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Details") {
                    TextField("Label", text: $viewModel.label)
                    Picker("Type", selection: $viewModel.category) {
                        ForEach(VaultItem.Category.allCases, id: \.self) { category in
                            Label(category.displayName, systemImage: category.iconName)
                                .tag(category)
                        }
                    }
                }

                Section {
                    if viewModel.showValue {
                        TextField("Secret Value", text: $viewModel.value)
                            .font(.system(.body, design: .monospaced))
                    } else {
                        SecureField("Secret Value", text: $viewModel.value)
                            .font(.system(.body, design: .monospaced))
                    }

                    Button {
                        viewModel.showValue.toggle()
                    } label: {
                        Label(
                            viewModel.showValue ? "Hide Value" : "Show Value",
                            systemImage: viewModel.showValue ? "eye.slash" : "eye"
                        )
                        .font(.caption)
                        .foregroundStyle(.tint)
                    }
                    .buttonStyle(.plain)
                } header: {
                    Text("Secret Value")
                } footer: {
                    Text("Stored encrypted in iOS Keychain. Not synced to iCloud.")
                        .font(.caption2)
                }

                if viewModel.isEditing {
                    Section {
                        Button("Delete Item", role: .destructive) {
                            viewModel.delete()
                            dismiss()
                        }
                    }
                }
            }
            .navigationTitle(viewModel.isEditing ? "Edit Credential" : "Add Credential")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        if viewModel.save() {
                            dismiss()
                        }
                    }
                    .disabled(!viewModel.isValid)
                }
            }
            .alert("Save Failed", isPresented: $viewModel.showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.errorMessage)
            }
        }
    }
}

// MARK: - ViewModel

@MainActor
final class VaultItemViewModel: ObservableObject {

    @Published var label = ""
    @Published var category: VaultItem.Category = .apiKey
    @Published var value = ""
    @Published var showValue = false
    @Published var showError = false

    var errorMessage = ""
    let isEditing: Bool

    private var existingItem: VaultItem?
    private let store = VaultStore.shared
    private let logger = Logger(subsystem: "com.lecoder.mconnect", category: "Vault")

    init(item: VaultItem?) {
        self.existingItem = item
        self.isEditing = item != nil
        if let item {
            self.label = item.label
            self.category = item.category
        }
    }

    var isValid: Bool {
        !label.trimmingCharacters(in: .whitespaces).isEmpty && !value.isEmpty
    }

    /// Persist to Keychain via VaultStore. Returns true on success.
    @discardableResult
    func save() -> Bool {
        do {
            if let existing = existingItem {
                // Update metadata
                var updated = existing
                updated.label = label
                updated.category = category
                updated.updatedAt = Date()
                try store.update(updated)
                // Update secret only if user typed something new
                if !value.isEmpty {
                    try store.updateSecret(value, forItemId: existing.id)
                }
                logger.info("Vault: updated item '\(self.label)'")
            } else {
                try store.add(label: label, category: category, secret: value)
                logger.info("Vault: saved new item '\(self.label)'")
            }
            return true
        } catch {
            errorMessage = error.localizedDescription
            showError = true
            logger.error("Vault: save failed: \(error)")
            return false
        }
    }

    func delete() {
        guard let item = existingItem else { return }
        do {
            try store.delete(item)
            logger.info("Vault: deleted item '\(item.label)'")
        } catch {
            logger.error("Vault: delete failed: \(error)")
        }
    }
}
