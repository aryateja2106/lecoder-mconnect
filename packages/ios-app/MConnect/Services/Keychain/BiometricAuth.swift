import Foundation
import LocalAuthentication

/// Face ID / Touch ID authentication service.
class BiometricAuth {
    static let shared = BiometricAuth()

    private init() {}

    enum BiometricType {
        case none
        case touchID
        case faceID
        case opticID
    }

    var availableBiometricType: BiometricType {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            return .none
        }
        switch context.biometryType {
        case .touchID: return .touchID
        case .faceID: return .faceID
        case .opticID: return .opticID
        case .none: return .none
        @unknown default: return .none
        }
    }

    var isBiometricAvailable: Bool {
        availableBiometricType != .none
    }

    func authenticate(reason: String = "Authenticate to access MConnect") async -> Bool {
        let context = LAContext()
        context.localizedCancelTitle = "Cancel"

        do {
            return try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason
            )
        } catch {
            print("Biometric auth failed: \(error)")
            return false
        }
    }
}
