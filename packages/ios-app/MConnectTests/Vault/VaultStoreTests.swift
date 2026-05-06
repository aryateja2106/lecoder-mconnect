import XCTest
@testable import MConnect

/// Tests for VaultStore CRUD operations and Keychain persistence.
/// Biometric gate is not tested here (requires device/simulator with enrolled biometrics).
@MainActor
final class VaultStoreTests: XCTestCase {

    // Each test creates its own isolated store to avoid shared-singleton state pollution.
    // We clean up Keychain keys used by the store after each test.

    private var store: VaultStore!
    private let keychain = KeychainService.shared

    override func setUp() async throws {
        try await super.setUp()
        // Clean slate: remove any vault metadata left by previous test runs.
        try? keychain.delete(forKey: "com.mconnect.vault.metadata")
        store = VaultStore.shared
    }

    override func tearDown() async throws {
        // Remove all items created during the test.
        for item in store.items {
            try? keychain.delete(forKey: "com.mconnect.vault.secret.\(item.id)")
        }
        try? keychain.delete(forKey: "com.mconnect.vault.metadata")
        try await super.tearDown()
    }

    // MARK: - Add

    func testAddItemAppearsInItems() throws {
        try store.add(label: "GitHub Token", category: .apiKey, secret: "ghp_secret123")
        XCTAssertEqual(store.items.count, 1)
        XCTAssertEqual(store.items[0].label, "GitHub Token")
        XCTAssertEqual(store.items[0].category, .apiKey)
    }

    func testAddItemPersistsSecretToKeychain() throws {
        try store.add(label: "My SSH Key", category: .sshKey, secret: "BEGIN RSA PRIVATE KEY...")
        let item = try XCTUnwrap(store.items.first)
        let loaded = try store.loadSecret(forItemId: item.id)
        XCTAssertEqual(loaded, "BEGIN RSA PRIVATE KEY...")
    }

    func testAddMultipleItems() throws {
        try store.add(label: "Token A", category: .apiKey, secret: "secret-a")
        try store.add(label: "Password B", category: .password, secret: "secret-b")
        XCTAssertEqual(store.items.count, 2)
    }

    // MARK: - Update

    func testUpdateChangesMetadata() throws {
        try store.add(label: "Old Label", category: .apiKey, secret: "value")
        var item = try XCTUnwrap(store.items.first)
        item.label = "New Label"
        item.category = .oauthToken
        try store.update(item)

        XCTAssertEqual(store.items[0].label, "New Label")
        XCTAssertEqual(store.items[0].category, .oauthToken)
    }

    func testUpdateSecretReplacesKeychainValue() throws {
        try store.add(label: "API Key", category: .apiKey, secret: "original")
        let id = try XCTUnwrap(store.items.first?.id)

        try store.updateSecret("updated-secret", forItemId: id)

        let loaded = try store.loadSecret(forItemId: id)
        XCTAssertEqual(loaded, "updated-secret")
    }

    // MARK: - Delete (single item)

    func testDeleteRemovesFromItems() throws {
        try store.add(label: "Token", category: .apiKey, secret: "value")
        let item = try XCTUnwrap(store.items.first)
        try store.delete(item)
        XCTAssertTrue(store.items.isEmpty)
    }

    func testDeleteRemovesSecretFromKeychain() throws {
        try store.add(label: "Token", category: .apiKey, secret: "value")
        let item = try XCTUnwrap(store.items.first)
        let secretKey = "com.mconnect.vault.secret.\(item.id)"
        try store.delete(item)
        XCTAssertFalse(keychain.exists(forKey: secretKey))
    }

    // MARK: - Delete (at offsets)

    func testDeleteAtOffsetsRemovesCorrectItem() throws {
        try store.add(label: "A", category: .apiKey, secret: "a")
        try store.add(label: "B", category: .password, secret: "b")
        try store.delete(at: IndexSet(integer: 0))
        XCTAssertEqual(store.items.count, 1)
        XCTAssertEqual(store.items[0].label, "B")
    }

    // MARK: - Load Secret

    func testLoadSecretReturnsCorrectValue() throws {
        try store.add(label: "My Token", category: .apiKey, secret: "super-secret")
        let id = try XCTUnwrap(store.items.first?.id)
        let loaded = try store.loadSecret(forItemId: id)
        XCTAssertEqual(loaded, "super-secret")
    }

    func testLoadSecretForUnknownIdThrows() {
        XCTAssertThrowsError(try store.loadSecret(forItemId: UUID().uuidString))
    }

    // MARK: - Metadata Persistence

    func testMetadataPersistedToKeychain() throws {
        try store.add(label: "Persisted", category: .sshKey, secret: "ssh-key")
        // Verify the metadata key exists in Keychain
        XCTAssertTrue(keychain.exists(forKey: "com.mconnect.vault.metadata"))
    }

    // MARK: - VaultItem Model

    func testVaultItemCategoryDisplayNames() {
        XCTAssertEqual(VaultItem.Category.apiKey.displayName, "API Key")
        XCTAssertEqual(VaultItem.Category.sshKey.displayName, "SSH Key")
        XCTAssertEqual(VaultItem.Category.password.displayName, "Password")
        XCTAssertEqual(VaultItem.Category.oauthToken.displayName, "OAuth Token")
        XCTAssertEqual(VaultItem.Category.certificate.displayName, "Certificate")
        XCTAssertEqual(VaultItem.Category.other.displayName, "Other")
    }

    func testVaultItemCategoryIcons() {
        for category in VaultItem.Category.allCases {
            XCTAssertFalse(category.iconName.isEmpty, "Missing icon for \(category)")
        }
    }
}
