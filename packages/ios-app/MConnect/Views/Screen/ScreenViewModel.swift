import Combine
import Foundation

enum VNCConnectionState: Equatable {
    case disconnected
    case connecting
    case authenticating
    case connected
    case failed(String)

    var isActive: Bool {
        switch self {
        case .connecting, .authenticating, .connected:
            return true
        case .disconnected, .failed:
            return false
        }
    }

    var displayText: String {
        switch self {
        case .disconnected:
            return "Disconnected"
        case .connecting:
            return "Connecting..."
        case .authenticating:
            return "Authenticating..."
        case .connected:
            return "Connected"
        case .failed(let message):
            return "Error: \(message)"
        }
    }
}

@MainActor
final class ScreenViewModel: ObservableObject {
    @Published var host: String = ""
    @Published var port: String = "5900"
    @Published var username: String = ""
    @Published var password: String = ""
    @Published var connectionState: VNCConnectionState = .disconnected

    private let keychain: KeychainService

    init(keychain: KeychainService = .shared) {
        self.keychain = keychain
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

    func connect() {
        guard !host.isEmpty else {
            connectionState = .failed("Host is required.")
            return
        }

        guard let portInt = Int(port), (1...65535).contains(portInt) else {
            connectionState = .failed("Port must be 1-65535.")
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
    }

    var portInt: Int {
        Int(port) ?? 5900
    }

    var isFormValid: Bool {
        !host.isEmpty && !port.isEmpty && Int(port) != nil
    }

    private func keychainKey(for host: String) -> String {
        "vnc.\(host).password"
    }
}
