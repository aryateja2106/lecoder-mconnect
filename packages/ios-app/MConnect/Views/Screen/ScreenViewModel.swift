import Foundation
import Combine

// MARK: - Connection State

enum VNCConnectionState: Equatable {
    case disconnected
    case connecting
    case authenticating
    case connected
    case failed(String)

    var isActive: Bool {
        switch self {
        case .connecting, .authenticating, .connected: return true
        default: return false
        }
    }

    var displayText: String {
        switch self {
        case .disconnected:      return "Disconnected"
        case .connecting:        return "Connecting..."
        case .authenticating:    return "Authenticating..."
        case .connected:         return "Connected"
        case .failed(let msg):   return "Error: \(msg)"
        }
    }
}

// MARK: - ScreenViewModel

@MainActor
class ScreenViewModel: ObservableObject {
    // MARK: Form fields
    @Published var host: String = ""
    @Published var port: String = "5900"
    @Published var username: String = ""
    @Published var password: String = ""

    // MARK: State
    @Published var connectionState: VNCConnectionState = .disconnected
    @Published var errorMessage: String? = nil

    private let keychain: KeychainService

    init(keychain: KeychainService = .shared) {
        self.keychain = keychain
    }

    // MARK: - Keychain helpers

    private func keychainKey(for host: String) -> String {
        "vnc.\(host).password"
    }

    func loadSavedPassword(for host: String) {
        guard !host.isEmpty else { return }
        if let saved = try? keychain.loadString(forKey: keychainKey(for: host)) {
            password = saved
        }
    }

    func savePassword() {
        guard !host.isEmpty, !password.isEmpty else { return }
        try? keychain.saveString(password, forKey: keychainKey(for: host))
    }

    // MARK: - Connection actions

    /// Validates inputs and signals VNCBridge to connect.
    func connect() {
        errorMessage = nil
        guard !host.isEmpty else {
            errorMessage = "Host is required."
            return
        }
        guard let portInt = Int(port), (1...65535).contains(portInt) else {
            errorMessage = "Port must be 1–65535."
            return
        }
        savePassword()
        connectionState = .connecting
    }

    func disconnect() {
        connectionState = .disconnected
    }

    func onConnectionEstablished() {
        connectionState = .connected
    }

    func onAuthenticationRequired() {
        connectionState = .authenticating
    }

    func onConnectionFailed(_ reason: String) {
        connectionState = .failed(reason)
        errorMessage = reason
    }

    // MARK: - Computed

    var portInt: Int {
        Int(port) ?? 5900
    }

    var isFormValid: Bool {
        !host.isEmpty && !port.isEmpty && Int(port) != nil
    }
}
