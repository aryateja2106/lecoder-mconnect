import Foundation
import Security

/// Wrapper for iOS Keychain Services.
class KeychainService {
    static let shared = KeychainService()

    private let serviceName = "com.lecoder.mconnect"

    private init() {}

    func save(_ data: Data, forKey key: String, requireBiometric: Bool = false) throws {
        // Delete existing item first
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

    // Convenience methods for String values
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
}

enum KeychainError: LocalizedError {
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
