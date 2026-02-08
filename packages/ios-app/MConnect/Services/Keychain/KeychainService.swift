import Foundation
import Security

/// Well-known Keychain item keys matching spec section 6.3.
struct KeychainItems {
    // OAuth tokens (encrypted by Keychain)
    static let accessToken = "com.mconnect.accessToken"
    static let refreshToken = "com.mconnect.refreshToken"

    // User info (for offline display)
    static let userProfile = "com.mconnect.userProfile"

    // Host profiles (connection settings)
    static let hostProfiles = "com.mconnect.hostProfiles"

    // SSH keys (future)
    static let sshKeys = "com.mconnect.sshKeys"
}

/// Wrapper for iOS Keychain Services.
///
/// All items are stored as `kSecClassGenericPassword` scoped to the
/// `com.lecoder.mconnect` service identifier. Items are device-only
/// (no iCloud sync) and optionally require biometric authentication.
class KeychainService {
    static let shared = KeychainService()

    private let serviceName = "com.lecoder.mconnect"

    private init() {}

    // MARK: - Core Data Operations

    func save(_ data: Data, forKey key: String, requireBiometric: Bool = false) throws {
        // Delete existing item first to avoid duplicate errors
        try? delete(forKey: key)

        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
        ]

        if requireBiometric {
            let access = SecAccessControlCreateWithFlags(
                nil,
                kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
                .biometryCurrentSet,
                nil
            )
            if let access {
                query[kSecAttrAccessControl as String] = access
            }
        } else {
            query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        }

        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainError.saveFailed(status: status)
        }
    }

    func load(forKey key: String) throws -> Data {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess, let data = result as? Data else {
            throw KeychainError.loadFailed(status: status)
        }

        return data
    }

    func delete(forKey key: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
        ]

        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.deleteFailed(status: status)
        }
    }

    /// Check whether an item exists for the given key without loading its data.
    func exists(forKey key: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecReturnData as String: false,
        ]

        let status = SecItemCopyMatching(query as CFDictionary, nil)
        return status == errSecSuccess
    }

    /// Delete all items belonging to this service.
    func deleteAll() throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
        ]

        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.deleteFailed(status: status)
        }
    }

    // MARK: - String Convenience

    func saveString(_ value: String, forKey key: String, requireBiometric: Bool = false) throws {
        guard let data = value.data(using: .utf8) else {
            throw KeychainError.encodingFailed
        }
        try save(data, forKey: key, requireBiometric: requireBiometric)
    }

    func loadString(forKey key: String) throws -> String {
        let data = try load(forKey: key)
        guard let string = String(data: data, encoding: .utf8) else {
            throw KeychainError.decodingFailed
        }
        return string
    }

    // MARK: - Codable Convenience

    /// Encode a `Codable` value as JSON and store it in the Keychain.
    func saveCodable<T: Encodable>(_ value: T, forKey key: String, requireBiometric: Bool = false) throws {
        let data = try JSONEncoder().encode(value)
        try save(data, forKey: key, requireBiometric: requireBiometric)
    }

    /// Load and decode a `Codable` value from the Keychain.
    func loadCodable<T: Decodable>(_ type: T.Type, forKey key: String) throws -> T {
        let data = try load(forKey: key)
        do {
            return try JSONDecoder().decode(type, from: data)
        } catch {
            throw KeychainError.decodingFailed
        }
    }
}

// MARK: - Error Types

enum KeychainError: LocalizedError, Equatable {
    case saveFailed(status: OSStatus)
    case loadFailed(status: OSStatus)
    case deleteFailed(status: OSStatus)
    case encodingFailed
    case decodingFailed

    var errorDescription: String? {
        switch self {
        case .saveFailed(let status):
            return "Keychain save failed with status: \(status)"
        case .loadFailed(let status):
            return "Keychain load failed with status: \(status)"
        case .deleteFailed(let status):
            return "Keychain delete failed with status: \(status)"
        case .encodingFailed:
            return "Failed to encode value for Keychain storage"
        case .decodingFailed:
            return "Failed to decode value from Keychain"
        }
    }
}
