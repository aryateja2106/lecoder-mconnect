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

    enum AuthError: LocalizedError, Equatable {
        case biometryNotAvailable
        case biometryNotEnrolled
        case biometryLockout
        case userCancel
        case userFallback
        case systemCancel
        case passcodeNotSet
        case failed(String)

        var errorDescription: String? {
            switch self {
            case .biometryNotAvailable:
                return "Biometric authentication is not available on this device"
            case .biometryNotEnrolled:
                return "No biometric data is enrolled on this device"
            case .biometryLockout:
                return "Biometric authentication is locked out due to too many attempts"
            case .userCancel:
                return "Authentication was cancelled by the user"
            case .userFallback:
                return "User chose to use passcode instead"
            case .systemCancel:
                return "Authentication was cancelled by the system"
            case .passcodeNotSet:
                return "A device passcode is required but not set"
            case .failed(let message):
                return "Authentication failed: \(message)"
            }
        }
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

    /// Whether the device has a passcode set (enables deviceOwnerAuthentication fallback).
    var isPasscodeSet: Bool {
        let context = LAContext()
        var error: NSError?
        return context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)
    }

    /// Authenticate using biometrics only.
    func authenticate(reason: String = "Authenticate to access MConnect") async -> Bool {
        let context = LAContext()
        context.localizedCancelTitle = "Cancel"

        do {
            return try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason
            )
        } catch {
            return false
        }
    }

    /// Authenticate using biometrics with passcode fallback.
    ///
    /// Uses `.deviceOwnerAuthentication` which allows the user to fall
    /// back to their device passcode if biometrics fail or are unavailable.
    func authenticateWithPasscodeFallback(
        reason: String = "Authenticate to access MConnect"
    ) async -> Result<Bool, AuthError> {
        let context = LAContext()
        context.localizedCancelTitle = "Cancel"
        context.localizedFallbackTitle = "Use Passcode"

        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            return .failure(mapLAError(error))
        }

        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthentication,
                localizedReason: reason
            )
            return .success(success)
        } catch let authError as LAError {
            return .failure(mapLAError(authError))
        } catch {
            return .failure(.failed(error.localizedDescription))
        }
    }

    // MARK: - Private

    private func mapLAError(_ error: NSError?) -> AuthError {
        guard let error else { return .failed("Unknown error") }
        return mapLAError(LAError(_nsError: error))
    }

    private func mapLAError(_ error: LAError) -> AuthError {
        switch error.code {
        case .biometryNotAvailable:
            return .biometryNotAvailable
        case .biometryNotEnrolled:
            return .biometryNotEnrolled
        case .biometryLockout:
            return .biometryLockout
        case .userCancel:
            return .userCancel
        case .userFallback:
            return .userFallback
        case .systemCancel:
            return .systemCancel
        case .passcodeNotSet:
            return .passcodeNotSet
        case .authenticationFailed:
            return .failed("Biometric did not match")
        default:
            return .failed(error.localizedDescription)
        }
    }
}
