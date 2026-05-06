import Foundation
import os

/// Shared store for Vault items — persists metadata list to Keychain and stores
/// each item's secret value under a per-item Keychain key.
///
/// **Root cause of the "add doesn't take effect" bug (fixed here):**
/// The previous `VaultItemViewModel.save()` was a no-op stub. `VaultViewModel`
/// had no shared store — items lived only in its ephemeral `@Published var items`
/// array and were never written to Keychain. This store is the single source of
/// truth; ViewModels observe it via `@Published var items`.
@MainActor
final class VaultStore: ObservableObject {

    static let shared = VaultStore()

    // MARK: - Published State

    @Published private(set) var items: [VaultItem] = []

    // MARK: - Private

    private let keychain = KeychainService.shared
    private let metadataKey = "com.mconnect.vault.metadata"
    private let logger = Logger(subsystem: "com.lecoder.mconnect", category: "Vault")

    private init() {
        load()
    }

    // MARK: - Public API

    /// Add a new item and persist its secret value to Keychain.
    func add(label: String, category: VaultItem.Category, secret: String) throws {
        let signposter = OSSignposter(logger: logger)
        let state = signposter.beginInterval("vault.add")
        defer { signposter.endInterval("vault.add", state) }

        let item = VaultItem(label: label, category: category)
        try keychain.saveString(secret, forKey: secretKey(for: item.id))
        items.append(item)
        try saveMetadata()
        logger.info("Vault: added item '\(item.label)' [\(item.category.rawValue)]")
    }

    /// Update an existing item's label/category. Secret update is separate via `updateSecret`.
    func update(_ item: VaultItem) throws {
        guard let index = items.firstIndex(where: { $0.id == item.id }) else { return }
        items[index] = item
        try saveMetadata()
        logger.info("Vault: updated item '\(item.label)'")
    }

    /// Replace the secret value for an existing item.
    func updateSecret(_ secret: String, forItemId id: String) throws {
        try keychain.saveString(secret, forKey: secretKey(for: id))
        logger.info("Vault: updated secret for item \(id)")
    }

    /// Delete an item and its secret from Keychain.
    func delete(_ item: VaultItem) throws {
        let signposter = OSSignposter(logger: logger)
        let state = signposter.beginInterval("vault.delete")
        defer { signposter.endInterval("vault.delete", state) }

        try? keychain.delete(forKey: secretKey(for: item.id))
        items.removeAll { $0.id == item.id }
        try saveMetadata()
        logger.info("Vault: deleted item '\(item.label)'")
    }

    func delete(at offsets: IndexSet) throws {
        for index in offsets {
            let item = items[index]
            try? keychain.delete(forKey: secretKey(for: item.id))
        }
        items.remove(atOffsets: offsets)
        try saveMetadata()
    }

    /// Load the secret value for an item (biometric gate enforced by caller).
    func loadSecret(forItemId id: String) throws -> String {
        let signposter = OSSignposter(logger: logger)
        let state = signposter.beginInterval("vault.read")
        defer { signposter.endInterval("vault.read", state) }

        return try keychain.loadString(forKey: secretKey(for: id))
    }

    // MARK: - Private Helpers

    private func secretKey(for id: String) -> String {
        "com.mconnect.vault.secret.\(id)"
    }

    private func saveMetadata() throws {
        try keychain.saveCodable(items, forKey: metadataKey)
    }

    private func load() {
        guard let loaded = try? keychain.loadCodable([VaultItem].self, forKey: metadataKey) else {
            logger.debug("Vault: no existing metadata found, starting empty")
            return
        }
        items = loaded
        logger.info("Vault: loaded \(loaded.count) items from Keychain")
    }
}
