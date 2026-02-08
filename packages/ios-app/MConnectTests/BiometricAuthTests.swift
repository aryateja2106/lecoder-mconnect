import XCTest
@testable import MConnect

final class BiometricAuthTests: XCTestCase {

    private let biometricAuth = BiometricAuth.shared

    // MARK: - BiometricType

    func testBiometricTypeDetection() {
        // On simulator, biometric is typically unavailable.
        // We just verify the API returns a valid enum value.
        let type = biometricAuth.availableBiometricType
        switch type {
        case .none, .touchID, .faceID, .opticID:
            break // All valid
        }
    }

    func testIsBiometricAvailableMatchesType() {
        let available = biometricAuth.isBiometricAvailable
        let type = biometricAuth.availableBiometricType
        XCTAssertEqual(available, type != .none)
    }

    func testIsPasscodeSetDoesNotCrash() {
        // Simply verify the property can be read without crashing
        _ = biometricAuth.isPasscodeSet
    }

    // MARK: - AuthError

    func testAuthErrorDescriptions() {
        let errors: [BiometricAuth.AuthError] = [
            .biometryNotAvailable,
            .biometryNotEnrolled,
            .biometryLockout,
            .userCancel,
            .userFallback,
            .systemCancel,
            .passcodeNotSet,
            .failed("test reason"),
        ]

        for error in errors {
            XCTAssertNotNil(error.errorDescription, "Missing description for \(error)")
        }
    }

    func testAuthErrorEquality() {
        XCTAssertEqual(BiometricAuth.AuthError.userCancel, BiometricAuth.AuthError.userCancel)
        XCTAssertEqual(
            BiometricAuth.AuthError.failed("a"),
            BiometricAuth.AuthError.failed("a")
        )
        XCTAssertNotEqual(
            BiometricAuth.AuthError.failed("a"),
            BiometricAuth.AuthError.failed("b")
        )
        XCTAssertNotEqual(
            BiometricAuth.AuthError.userCancel,
            BiometricAuth.AuthError.systemCancel
        )
    }
}
