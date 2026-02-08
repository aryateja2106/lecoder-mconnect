import SwiftUI

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
                    Picker("Category", selection: $viewModel.category) {
                        ForEach(VaultItem.Category.allCases, id: \.self) { category in
                            Text(category.displayName).tag(category)
                        }
                    }
                }

                Section("Value") {
                    SecureField("Secret Value", text: $viewModel.value)
                }

                if viewModel.isEditing {
                    Section {
                        Button("Delete", role: .destructive) {
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
class VaultItemViewModel: ObservableObject {
    @Published var label = ""
    @Published var category: VaultItem.Category = .apiKey
    @Published var value = ""

    let isEditing: Bool
    private var existingItem: VaultItem?

    init(item: VaultItem?) {
        self.existingItem = item
        self.isEditing = item != nil
        if let item {
            self.label = item.label
            self.category = item.category
        }
    }

    var isValid: Bool {
        !label.isEmpty && !value.isEmpty
    }

    func save() {
        // Will persist to Keychain
    }

    func delete() {
        // Will remove from Keychain
    }
}
