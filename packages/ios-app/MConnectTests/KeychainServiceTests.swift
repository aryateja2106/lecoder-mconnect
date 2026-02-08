import XCTest
@testable import MConnect

final class KeychainServiceTests: XCTestCase {

    private let keychain = KeychainService.shared
    private let testKey = "test.keychainService.\(UUID().uuidString)"

    override func tearDown() {
        try? keychain.delete(forKey: testKey)
        super.tearDown()
    }

    // MARK: - Save / Load / Delete (Data)

    func testSaveAndLoadData() throws {
        let data = Data("hello keychain".utf8)
        try keychain.save(data, forKey: testKey)

        let loaded = try keychain.load(forKey: testKey)
        XCTAssertEqual(loaded, data)
    }

    func testSaveOverwritesExistingItem() throws {
        let first = Data("first".utf8)
        let second = Data("second".utf8)

        try keychain.save(first, forKey: testKey)
        try keychain.save(second, forKey: testKey)

        let loaded = try keychain.load(forKey: testKey)
        XCTAssertEqual(loaded, second)
    }

    func testLoadMissingKeyThrows() {
        XCTAssertThrowsError(try keychain.load(forKey: "nonexistent.\(UUID().uuidString)")) { error in
            guard let keychainError = error as? KeychainError else {
                return XCTFail("Expected KeychainError, got \(error)")
            }
            if case .loadFailed(let status) = keychainError {
                XCTAssertEqual(status, errSecItemNotFound)
            } else {
                XCTFail("Expected loadFailed, got \(keychainError)")
            }
        }
    }

    func testDeleteRemovesItem() throws {
        let data = Data("to delete".utf8)
        try keychain.save(data, forKey: testKey)

        try keychain.delete(forKey: testKey)
        XCTAssertFalse(keychain.exists(forKey: testKey))
    }

    func testDeleteNonexistentKeyDoesNotThrow() throws {
        // Should not throw for missing key
        try keychain.delete(forKey: "nonexistent.\(UUID().uuidString)")
    }

    // MARK: - Exists

    func testExistsReturnsTrueForStoredItem() throws {
        try keychain.save(Data("exists".utf8), forKey: testKey)
        XCTAssertTrue(keychain.exists(forKey: testKey))
    }

    func testExistsReturnsFalseForMissingItem() {
        XCTAssertFalse(keychain.exists(forKey: "missing.\(UUID().uuidString)"))
    }

    // MARK: - String Convenience

    func testSaveAndLoadString() throws {
        try keychain.saveString("secret", forKey: testKey)
        let loaded = try keychain.loadString(forKey: testKey)
        XCTAssertEqual(loaded, "secret")
    }

    func testSaveAndLoadEmptyString() throws {
        try keychain.saveString("", forKey: testKey)
        let loaded = try keychain.loadString(forKey: testKey)
        XCTAssertEqual(loaded, "")
    }

    func testSaveAndLoadUnicodeString() throws {
        let unicode = "MConnect credentials"
        try keychain.saveString(unicode, forKey: testKey)
        let loaded = try keychain.loadString(forKey: testKey)
        XCTAssertEqual(loaded, unicode)
    }

    // MARK: - Codable Convenience

    func testSaveAndLoadCodable() throws {
        let host = Host(name: "Test Server", hostname: "192.168.1.100", port: 8080)
        try keychain.saveCodable(host, forKey: testKey)

        let loaded = try keychain.loadCodable(Host.self, forKey: testKey)
        XCTAssertEqual(loaded.name, "Test Server")
        XCTAssertEqual(loaded.hostname, "192.168.1.100")
        XCTAssertEqual(loaded.port, 8080)
    }

    func testSaveAndLoadCodableArray() throws {
        let hosts = [
            Host(name: "Server A", hostname: "10.0.0.1"),
            Host(name: "Server B", hostname: "10.0.0.2"),
        ]
        try keychain.saveCodable(hosts, forKey: testKey)

        let loaded = try keychain.loadCodable([Host].self, forKey: testKey)
        XCTAssertEqual(loaded.count, 2)
        XCTAssertEqual(loaded[0].name, "Server A")
        XCTAssertEqual(loaded[1].hostname, "10.0.0.2")
    }

    func testLoadCodableWithWrongTypeThrows() throws {
        try keychain.saveString("not json", forKey: testKey)
        XCTAssertThrowsError(try keychain.loadCodable(Host.self, forKey: testKey)) { error in
            guard let keychainError = error as? KeychainError else {
                return XCTFail("Expected KeychainError, got \(error)")
            }
            XCTAssertEqual(keychainError, .decodingFailed)
        }
    }

    // MARK: - DeleteAll

    func testDeleteAllRemovesAllServiceItems() throws {
        let key1 = "test.deleteAll.1.\(UUID().uuidString)"
        let key2 = "test.deleteAll.2.\(UUID().uuidString)"
        defer {
            try? keychain.delete(forKey: key1)
            try? keychain.delete(forKey: key2)
        }

        try keychain.save(Data("one".utf8), forKey: key1)
        try keychain.save(Data("two".utf8), forKey: key2)

        try keychain.deleteAll()

        XCTAssertFalse(keychain.exists(forKey: key1))
        XCTAssertFalse(keychain.exists(forKey: key2))
    }

    // MARK: - KeychainItems Constants

    func testKeychainItemsConstants() {
        XCTAssertEqual(KeychainItems.accessToken, "com.mconnect.accessToken")
        XCTAssertEqual(KeychainItems.refreshToken, "com.mconnect.refreshToken")
        XCTAssertEqual(KeychainItems.userProfile, "com.mconnect.userProfile")
        XCTAssertEqual(KeychainItems.hostProfiles, "com.mconnect.hostProfiles")
        XCTAssertEqual(KeychainItems.sshKeys, "com.mconnect.sshKeys")
    }

    // MARK: - KeychainError

    func testKeychainErrorDescriptions() {
        XCTAssertNotNil(KeychainError.saveFailed(status: -25299).errorDescription)
        XCTAssertNotNil(KeychainError.loadFailed(status: -25300).errorDescription)
        XCTAssertNotNil(KeychainError.deleteFailed(status: -25300).errorDescription)
        XCTAssertNotNil(KeychainError.encodingFailed.errorDescription)
        XCTAssertNotNil(KeychainError.decodingFailed.errorDescription)
    }

    func testKeychainErrorEquality() {
        XCTAssertEqual(KeychainError.encodingFailed, KeychainError.encodingFailed)
        XCTAssertEqual(KeychainError.saveFailed(status: -25299), KeychainError.saveFailed(status: -25299))
        XCTAssertNotEqual(KeychainError.encodingFailed, KeychainError.decodingFailed)
    }
}
