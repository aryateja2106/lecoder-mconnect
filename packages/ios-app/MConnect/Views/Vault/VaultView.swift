import SwiftUI

struct VaultView: View {
    @StateObject private var viewModel = VaultViewModel()

    var body: some View {
        NavigationStack {
            List {
                if viewModel.items.isEmpty {
                    ContentUnavailableView(
                        "Vault Empty",
                        systemImage: "lock.shield",
                        description: Text("Stored credentials will appear here.")
                    )
                } else {
                    ForEach(viewModel.items) { item in
                        NavigationLink(value: item) {
                            VaultRow(item: item)
                        }
                    }
                    .onDelete(perform: viewModel.deleteItems)
                }
            }
            .navigationTitle("Vault")
            .navigationDestination(for: VaultItem.self) { item in
                VaultItemView(item: item)
            }
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button("Add", systemImage: "plus") {
                        viewModel.showAdd = true
                    }
                }
            }
            .sheet(isPresented: $viewModel.showAdd) {
                VaultItemView(item: nil)
            }
        }
    }
}

struct VaultRow: View {
    let item: VaultItem

    var body: some View {
        HStack {
            Image(systemName: item.category.iconName)
                .foregroundColor(.accentColor)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 4) {
                Text(item.label)
                    .font(.headline)
                Text(item.category.displayName)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

@MainActor
class VaultViewModel: ObservableObject {
    @Published var items: [VaultItem] = []
    @Published var showAdd = false

    func deleteItems(at offsets: IndexSet) {
        items.remove(atOffsets: offsets)
        // Will also delete from Keychain
    }
}
