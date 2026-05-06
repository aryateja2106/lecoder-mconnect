import SwiftUI
import LocalAuthentication
import Combine
import os


// MARK: - VaultView

struct VaultView: View {
    @StateObject private var viewModel = VaultViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.items.isEmpty {
                    vaultEmptyState
                } else {
                    itemList
                }
            }
            .navigationTitle("Vault")
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
            .alert("Error", isPresented: $viewModel.showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.errorMessage)
            }
        }
    }

    // MARK: - Empty State

    private var vaultEmptyState: some View {
        VStack(spacing: 20) {
            Image(systemName: "lock.shield")
                .font(.system(size: 56))
                .foregroundStyle(.secondary)

            VStack(spacing: 8) {
                Text("Your Vault is Empty")
                    .font(.title2.weight(.semibold))

                Text("Vault stores SSH keys, passwords, and API tokens used to authenticate when agents run commands. Add an item to make it available across hosts.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            Button {
                viewModel.showAdd = true
            } label: {
                Label("Add First Item", systemImage: "plus")
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(.tint, in: Capsule())
                    .foregroundStyle(.white)
            }
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Item List

    private var itemList: some View {
        List {
            if !viewModel.hasSeenHelp {
                helpBanner
            }

            ForEach(viewModel.items) { item in
                VaultRow(
                    item: item,
                    onReveal: { viewModel.revealSecret(for: item) }
                )
            }
            .onDelete { offsets in
                viewModel.deleteItems(at: offsets)
            }
        }
        .alert("Secret Value", isPresented: $viewModel.showReveal) {
            Button("Copy") { UIPasteboard.general.string = viewModel.revealedSecret }
            Button("OK", role: .cancel) { viewModel.revealedSecret = "" }
        } message: {
            Text(viewModel.revealedSecret)
                .font(.system(.body, design: .monospaced))
        }
    }

    // MARK: - Help Banner

    private var helpBanner: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "info.circle.fill")
                .foregroundStyle(.tint)
                .padding(.top, 2)

            VStack(alignment: .leading, spacing: 4) {
                Text("How Vault works")
                    .font(.subheadline.weight(.semibold))
                Text("Secrets are encrypted in iOS Keychain. Long-press any item to reveal its value after Face ID / Touch ID confirmation.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Button {
                viewModel.dismissHelp()
            } label: {
                Image(systemName: "xmark")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 8)
        .listRowBackground(Color(.systemBlue).opacity(0.08))
    }
}

// MARK: - VaultRow

struct VaultRow: View {
    let item: VaultItem
    let onReveal: () -> Void

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

            Spacer()

            Image(systemName: "ellipsis.circle")
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .contextMenu {
            Button {
                onReveal()
            } label: {
                Label("Reveal Value", systemImage: "eye")
            }
        }
    }
}

// MARK: - VaultViewModel

@MainActor
final class VaultViewModel: ObservableObject {

    @Published var showAdd = false
    @Published var showError = false
    @Published var showReveal = false
    @Published var revealedSecret = ""
    @Published var hasSeenHelp: Bool
    @Published private(set) var items: [VaultItem] = []

    var errorMessage = ""

    private let store = VaultStore.shared
    private let logger = Logger(subsystem: "com.lecoder.mconnect", category: "Vault")
    private let helpSeenKey = "com.mconnect.vault.helpSeen"
    private var cancellables = Set<AnyCancellable>()

    init() {
        self.hasSeenHelp = UserDefaults.standard.bool(forKey: "com.mconnect.vault.helpSeen")
        // Forward store's published items so SwiftUI re-renders when items change.
        store.$items
            .receive(on: DispatchQueue.main)
            .assign(to: &$items)
    }

    func deleteItems(at offsets: IndexSet) {
        do {
            try store.delete(at: offsets)
        } catch {
            errorMessage = error.localizedDescription
            showError = true
            logger.error("Vault: delete failed: \(error)")
        }
    }

    func revealSecret(for item: VaultItem) {
        let context = LAContext()
        var authError: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &authError) else {
            // Fallback: try device passcode
            revealWithPasscode(item: item)
            return
        }

        context.evaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            localizedReason: "Reveal the secret value for \"\(item.label)\""
        ) { [weak self] success, _ in
            guard let self else { return }
            Task { @MainActor in
                guard success else { return }
                self.loadAndShowSecret(item: item)
            }
        }
    }

    func dismissHelp() {
        hasSeenHelp = true
        UserDefaults.standard.set(true, forKey: helpSeenKey)
    }

    // MARK: - Private

    private func revealWithPasscode(item: VaultItem) {
        let context = LAContext()
        context.evaluatePolicy(
            .deviceOwnerAuthentication,
            localizedReason: "Reveal the secret value for \"\(item.label)\""
        ) { [weak self] success, _ in
            guard let self else { return }
            Task { @MainActor in
                guard success else { return }
                self.loadAndShowSecret(item: item)
            }
        }
    }

    private func loadAndShowSecret(item: VaultItem) {
        do {
            revealedSecret = try store.loadSecret(forItemId: item.id)
            showReveal = true
        } catch {
            errorMessage = "Could not load secret: \(error.localizedDescription)"
            showError = true
            logger.error("Vault: reveal failed for \(item.id): \(error)")
        }
    }
}
