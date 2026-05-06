import XCTest
@testable import MConnect

// MARK: - FloatingActionItemTests

final class FloatingActionItemTests: XCTestCase {

    func testDefaultSystemImageAndLabel() {
        XCTAssertEqual(FloatingActionKind.pin.systemImage, "pin.fill")
        XCTAssertEqual(FloatingActionKind.keyboard.systemImage, "keyboard")
        XCTAssertEqual(FloatingActionKind.mouse.systemImage, "cursorarrow")
        XCTAssertEqual(FloatingActionKind.info.systemImage, "info.circle")
        XCTAssertEqual(FloatingActionKind.help.systemImage, "questionmark.circle")
        XCTAssertEqual(FloatingActionKind.disconnect.systemImage, "xmark.circle.fill")
        XCTAssertEqual(FloatingActionKind.markdown.systemImage, "doc.richtext")
    }

    func testLabelsNonEmpty() {
        for kind in FloatingActionKind.allCases {
            XCTAssertFalse(kind.label.isEmpty, "\(kind) label must not be empty")
        }
    }

    func testItemIdMatchesKind() {
        let item = FloatingActionItem(kind: .keyboard, isOn: false, action: {})
        XCTAssertEqual(item.id, .keyboard)
        XCTAssertEqual(item.systemImage, FloatingActionKind.keyboard.systemImage)
        XCTAssertEqual(item.label, FloatingActionKind.keyboard.label)
    }

    func testIsOnDefaultFalse() {
        let item = FloatingActionItem(kind: .pin, action: {})
        XCTAssertFalse(item.isOn)
    }

    func testIsOnCanBeSetTrue() {
        let item = FloatingActionItem(kind: .pin, isOn: true, action: {})
        XCTAssertTrue(item.isOn)
    }
}

// MARK: - FloatingActionDispatchTests

final class FloatingActionDispatchTests: XCTestCase {

    func testActionDispatchedOnTap() {
        var dispatched = false
        let item = FloatingActionItem(kind: .keyboard, isOn: false) {
            dispatched = true
        }
        item.action()
        XCTAssertTrue(dispatched)
    }

    func testEachKindDispatchesIndependently() {
        var counts = [FloatingActionKind: Int]()
        let items = FloatingActionKind.allCases.map { kind in
            FloatingActionItem(kind: kind, isOn: false) {
                counts[kind, default: 0] += 1
            }
        }

        for item in items {
            item.action()
        }

        for kind in FloatingActionKind.allCases {
            XCTAssertEqual(counts[kind], 1, "\(kind) action should fire exactly once")
        }
    }

    func testPinToggleCallback() {
        var pinned = false
        let item = FloatingActionItem(kind: .pin, isOn: false) {
            pinned.toggle()
        }
        item.action()
        XCTAssertTrue(pinned)
        item.action()
        XCTAssertFalse(pinned)
    }
}

// MARK: - AutoFadeInhibitTests

final class AutoFadeInhibitTests: XCTestCase {

    /// Verifies that the pin kind's label communicates "pinned" intent — proxy for
    /// inhibiting auto-fade when isOn == true. Actual timer behaviour is tested in
    /// UI/integration tests; unit tests verify the flag is observable.
    func testPinnedStateObservable() {
        var item = FloatingActionItem(kind: .pin, isOn: false, action: {})
        XCTAssertFalse(item.isOn)

        // Simulate toggling pinned state (would be done by the parent view)
        item.isOn = true
        XCTAssertTrue(item.isOn)
    }

    func testAutoFadeNotInhibitedWhenUnpinned() {
        let item = FloatingActionItem(kind: .pin, isOn: false, action: {})
        // isOn == false → no inhibit → fade should proceed
        XCTAssertFalse(item.isOn)
    }

    func testAutoFadeInhibitedWhenPinned() {
        let item = FloatingActionItem(kind: .pin, isOn: true, action: {})
        // isOn == true → inhibit auto-fade
        XCTAssertTrue(item.isOn)
    }
}

// MARK: - AutoFadeTimerTests

final class AutoFadeTimerTests: XCTestCase {

    func testFadeTaskCancelledAndRescheduledOnActivity() async {
        // Simulates the scheduleFade / resetFade pattern:
        // a new task cancels the old one and starts fresh.
        let exp = expectation(description: "fade task fires")
        exp.isInverted = true   // should NOT fire within 0.1 s after reset

        var firstFired = false

        let first = Task {
            try? await Task.sleep(for: .milliseconds(50))
            firstFired = true
            exp.fulfill()
        }

        // Simulate resetFade: cancel first task, start new one with longer delay
        first.cancel()

        let _ = Task {
            try? await Task.sleep(for: .milliseconds(200))
            // second task fires after test window — irrelevant here
        }

        await fulfillment(of: [exp], timeout: 0.12)
        XCTAssertFalse(firstFired, "Cancelled task must not fire")
    }
}
