import XCTest

final class ScreenshotTests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = true
    }

    @MainActor
    func testCaptureScreenshots() throws {
        let app = XCUIApplication()
        app.launch()

        // Wait for the app to settle
        sleep(2)

        // Screenshot 1: Connect Screen (Home) — already captured via simctl

        // Screenshot 2: Tap "Connect to URL" to open Manual Connect sheet
        let connectToURL = app.staticTexts["Connect to URL"]
        if connectToURL.waitForExistence(timeout: 5) {
            connectToURL.tap()
            sleep(1)
            let screenshot2 = XCUIScreen.main.screenshot()
            let attach2 = XCTAttachment(screenshot: screenshot2)
            attach2.name = "02-manual-connect"
            attach2.lifetime = .keepAlways
            add(attach2)

            // Try to type a URL to show the field populated
            let textFields = app.textFields
            if textFields.count > 0 {
                textFields.firstMatch.tap()
                textFields.firstMatch.typeText("https://my-session.trycloudflare.com")
                sleep(1)
                let screenshot2b = XCUIScreen.main.screenshot()
                let attach2b = XCTAttachment(screenshot: screenshot2b)
                attach2b.name = "02b-manual-connect-filled"
                attach2b.lifetime = .keepAlways
                add(attach2b)
            }

            // Dismiss the sheet
            let cancelButton = app.buttons["Cancel"]
            if cancelButton.exists {
                cancelButton.tap()
                sleep(1)
            }
        }

        // Screenshot 3: Tap "Enter Pairing Code" to show pairing entry
        let pairingCode = app.staticTexts["Enter Pairing Code"]
        if pairingCode.waitForExistence(timeout: 5) {
            pairingCode.tap()
            sleep(1)
            let screenshot3 = XCUIScreen.main.screenshot()
            let attach3 = XCTAttachment(screenshot: screenshot3)
            attach3.name = "03-pairing-code"
            attach3.lifetime = .keepAlways
            add(attach3)

            // Dismiss
            let cancelButton = app.buttons["Cancel"]
            if cancelButton.exists {
                cancelButton.tap()
                sleep(1)
            }
        }
    }
}
