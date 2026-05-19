import XCTest
@testable import MConnect

@MainActor
final class ScreenViewModelTests: XCTestCase {
    func testConnectWithValidHostMovesToConnecting() {
        let viewModel = ScreenViewModel()
        viewModel.host = "127.0.0.1"
        viewModel.port = "5900"

        viewModel.connect()

        XCTAssertEqual(viewModel.connectionState, .connecting)
        XCTAssertEqual(viewModel.portInt, 5900)
        XCTAssertTrue(viewModel.isFormValid)
    }

    func testConnectWithoutHostFails() {
        let viewModel = ScreenViewModel()
        viewModel.host = ""

        viewModel.connect()

        XCTAssertEqual(viewModel.connectionState, .failed("Host is required."))
        XCTAssertFalse(viewModel.isFormValid)
    }

    func testConnectWithInvalidPortFails() {
        let viewModel = ScreenViewModel()
        viewModel.host = "127.0.0.1"
        viewModel.port = "70000"

        viewModel.connect()

        XCTAssertEqual(viewModel.connectionState, .failed("Port must be 1-65535."))
    }
}
