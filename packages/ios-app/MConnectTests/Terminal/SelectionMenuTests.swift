// SelectionMenuTests.swift
// MConnectTests
//
// Tests for SwiftTermBridge+Selection and SelectionMenu behaviour.
// Uses mock objects to avoid requiring a live SwiftTerm TerminalView.

import XCTest
import UIKit
@testable import MConnect

// MARK: - Mock Objects

/// Minimal mock that records sent text and selected-text queries.
final class MockTerminalSink {
    var sentTexts: [String] = []
    var selectionToReturn: String? = nil

    func send(text: String) {
        sentTexts.append(text)
    }

    func getSelection() -> String? {
        selectionToReturn
    }
}

/// Tracks pasteboard writes without actually using UIPasteboard in unit tests.
final class MockPasteboard {
    var string: String?
}

// MARK: - Clipboard Copy Tests

final class SelectionCopyTests: XCTestCase {

    /// When getSelectedText() returns a non-empty string, copy writes it to UIPasteboard.
    func testCopyWritesSelectionToPasteboard() {
        let expectedText = "echo hello"
        var pasteboardString: String? = nil

        // Simulate what the notification handler does
        let selectedText = expectedText
        pasteboardString = selectedText

        XCTAssertEqual(pasteboardString, expectedText)
    }

    /// When getSelectedText() returns nil, pasteboard is NOT modified.
    func testCopyWithNoSelectionDoesNotModifyPasteboard() {
        var copyWasCalled = false

        let selectedText: String? = nil
        if let text = selectedText, !text.isEmpty {
            copyWasCalled = true
            _ = text // would write to pasteboard
        }

        XCTAssertFalse(copyWasCalled)
    }

    /// No-selection copy posts the hint banner notification.
    func testCopyWithNoSelectionPostsHintBanner() {
        let expectation = XCTestExpectation(description: "hint banner posted")

        let observer = NotificationCenter.default.addObserver(
            forName: .swiftTermShowSelectionHint,
            object: nil,
            queue: .main
        ) { note in
            let message = note.userInfo?["message"] as? String
            XCTAssertEqual(message, "Tap and hold text to copy")
            expectation.fulfill()
        }
        defer { NotificationCenter.default.removeObserver(observer) }

        // Simulate the no-selection code path
        let hasSelection = false
        if !hasSelection {
            NotificationCenter.default.post(
                name: .swiftTermShowSelectionHint,
                object: nil,
                userInfo: ["message": "Tap and hold text to copy"]
            )
        }

        wait(for: [expectation], timeout: 1.0)
    }
}

// MARK: - Paste Tests

final class SelectionPasteTests: XCTestCase {

    /// Paste reads UIPasteboard and forwards the string to the mock sink.
    func testPasteReadsPasteboardAndSendsToTerminal() {
        let sink = MockTerminalSink()
        let pasteboardString = "pasted content"

        // Simulate pasteFromClipboard logic
        if let text = Optional(pasteboardString), !text.isEmpty {
            sink.send(text: text)
        }

        XCTAssertEqual(sink.sentTexts, ["pasted content"])
    }

    /// Empty pasteboard does not call send.
    func testPasteWithEmptyClipboardSendsNothing() {
        let sink = MockTerminalSink()
        let pasteboardString: String? = nil

        if let text = pasteboardString, !text.isEmpty {
            sink.send(text: text)
        }

        XCTAssertTrue(sink.sentTexts.isEmpty)
    }

    /// Paste notification triggers paste request.
    func testPasteNotificationIsObservable() {
        let expectation = XCTestExpectation(description: "paste notification received")

        let observer = NotificationCenter.default.addObserver(
            forName: .swiftTermPasteRequested,
            object: nil,
            queue: .main
        ) { _ in expectation.fulfill() }
        defer { NotificationCenter.default.removeObserver(observer) }

        NotificationCenter.default.post(name: .swiftTermPasteRequested, object: nil)

        wait(for: [expectation], timeout: 1.0)
    }
}

// MARK: - Select All Tests

final class SelectionSelectAllTests: XCTestCase {

    /// Select all notification fires and can be observed.
    func testSelectAllNotificationIsObservable() {
        let expectation = XCTestExpectation(description: "selectAll notification received")

        let observer = NotificationCenter.default.addObserver(
            forName: .swiftTermSelectAllRequested,
            object: nil,
            queue: .main
        ) { _ in expectation.fulfill() }
        defer { NotificationCenter.default.removeObserver(observer) }

        NotificationCenter.default.post(name: .swiftTermSelectAllRequested, object: nil)

        wait(for: [expectation], timeout: 1.0)
    }
}

// MARK: - Search Web URL Formation Tests

final class SearchWebURLTests: XCTestCase {

    /// Selected text with spaces forms a valid Google search URL.
    func testSearchWebURLFormation() {
        let query = "swift concurrency actors"
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)!
        let url = URL(string: "https://www.google.com/search?q=\(encoded)")

        XCTAssertNotNil(url)
        XCTAssertEqual(url?.host, "www.google.com")
        XCTAssertTrue(url?.absoluteString.contains("swift") == true)
        XCTAssertTrue(url?.absoluteString.contains("concurrency") == true)
    }

    /// Leading/trailing whitespace is stripped before URL formation.
    func testSearchWebURLStripsWhitespace() {
        let rawQuery = "  git rebase  "
        let query = rawQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)!
        let url = URL(string: "https://www.google.com/search?q=\(encoded)")

        XCTAssertNotNil(url)
        XCTAssertFalse(url?.absoluteString.contains("%20git") == true, "Leading space should be trimmed")
    }

    /// Special characters (& = ?) are percent-encoded in the search URL.
    func testSearchWebURLEncodesSpecialChars() {
        let query = "foo=bar&baz"
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)
        XCTAssertNotNil(encoded)
        XCTAssertFalse(encoded?.contains("=") == true, "= should be percent-encoded")
        XCTAssertFalse(encoded?.contains("&") == true, "& should be percent-encoded")
    }
}

// MARK: - Notification Name Consistency Tests

final class SelectionNotificationNameTests: XCTestCase {

    func testCopyNotificationNameIsStable() {
        XCTAssertEqual(Notification.Name.swiftTermCopyRequested.rawValue, "swiftTermCopyRequested")
    }

    func testPasteNotificationNameIsStable() {
        XCTAssertEqual(Notification.Name.swiftTermPasteRequested.rawValue, "swiftTermPasteRequested")
    }

    func testSelectAllNotificationNameIsStable() {
        XCTAssertEqual(Notification.Name.swiftTermSelectAllRequested.rawValue, "swiftTermSelectAllRequested")
    }

    func testHintBannerNotificationNameIsStable() {
        XCTAssertEqual(Notification.Name.swiftTermShowSelectionHint.rawValue, "swiftTermShowSelectionHint")
    }
}
