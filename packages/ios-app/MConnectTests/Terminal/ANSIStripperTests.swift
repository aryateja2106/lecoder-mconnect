import XCTest
@testable import MConnect

final class ANSIStripperTests: XCTestCase {

    // MARK: - SGR / CSI

    func testStripsColorCodes() {
        let input = "\u{1B}[32mGreen text\u{1B}[0m"
        XCTAssertEqual(ANSIStripper.strip(input), "Green text")
    }

    func testStripsResetCode() {
        let input = "Normal\u{1B}[0mText"
        XCTAssertEqual(ANSIStripper.strip(input), "NormalText")
    }

    func testStripsBoldAndColor() {
        let input = "\u{1B}[1;34mBold Blue\u{1B}[0m"
        XCTAssertEqual(ANSIStripper.strip(input), "Bold Blue")
    }

    func testStripsCursorMovement() {
        // ESC[2J (clear screen) and ESC[H (cursor home)
        let input = "\u{1B}[2J\u{1B}[HHello"
        XCTAssertEqual(ANSIStripper.strip(input), "Hello")
    }

    func testStripsParameterizedCursor() {
        // ESC[5;10H — cursor position
        let input = "\u{1B}[5;10HText"
        XCTAssertEqual(ANSIStripper.strip(input), "Text")
    }

    func testStripsPrivateModeSequences() {
        // ESC[?25l (hide cursor), ESC[?25h (show cursor)
        let input = "\u{1B}[?25lHidden\u{1B}[?25h"
        XCTAssertEqual(ANSIStripper.strip(input), "Hidden")
    }

    // MARK: - OSC

    func testStripsOSCTitleWithBEL() {
        // ESC ] 0 ; title BEL
        let input = "\u{1B}]0;Window Title\u{07}Content"
        XCTAssertEqual(ANSIStripper.strip(input), "Content")
    }

    func testStripsOSCWithStringTerminator() {
        // ESC ] 0 ; title ESC \
        let input = "\u{1B}]0;Title\u{1B}\\Content"
        XCTAssertEqual(ANSIStripper.strip(input), "Content")
    }

    func testStripsHyperlinkOSC() {
        // ESC ] 8 ; ; url BEL text ESC ] 8 ; ; BEL
        let input = "\u{1B}]8;;https://example.com\u{07}Click here\u{1B}]8;;\u{07}"
        XCTAssertEqual(ANSIStripper.strip(input), "Click here")
    }

    // MARK: - BEL and control characters

    func testRemovesBEL() {
        let input = "Hello\u{07}World"
        XCTAssertEqual(ANSIStripper.strip(input), "HelloWorld")
    }

    func testPreservesNewlines() {
        let input = "Line 1\nLine 2\nLine 3"
        XCTAssertEqual(ANSIStripper.strip(input), "Line 1\nLine 2\nLine 3")
    }

    func testPreservesCR() {
        let input = "Line\r\n"
        XCTAssertEqual(ANSIStripper.strip(input), "Line\r\n")
    }

    // MARK: - Tab expansion

    func testExpandsTabToFourSpaces() {
        let input = "col1\tcol2"
        XCTAssertEqual(ANSIStripper.strip(input), "col1    col2")
    }

    func testExpandsMultipleTabs() {
        let input = "a\tb\tc"
        XCTAssertEqual(ANSIStripper.strip(input), "a    b    c")
    }

    // MARK: - Pass-through

    func testPlainTextUnchanged() {
        let input = "Hello, world! 123 abc."
        XCTAssertEqual(ANSIStripper.strip(input), input)
    }

    func testEmptyString() {
        XCTAssertEqual(ANSIStripper.strip(""), "")
    }

    // MARK: - Combined / realistic

    func testClaudeCodeTUIPrompt() {
        // Simulated Claude Code prompt line with colors and cursor sequences
        let input = "\u{1B}[2K\u{1B}[1G\u{1B}[32m>\u{1B}[0m \u{1B}[1mHelp me debug this\u{1B}[0m"
        let result = ANSIStripper.strip(input)
        XCTAssertFalse(result.contains("\u{1B}"))
        XCTAssertTrue(result.contains("Help me debug this"))
    }

    func testMixedOutputLine() {
        let input = "\u{1B}[33mwarning:\u{1B}[0m unused variable 'x'"
        XCTAssertEqual(ANSIStripper.strip(input), "warning: unused variable 'x'")
    }

    func testTruncatedEscapeAtEnd() {
        // Escape with nothing after — should not crash
        let input = "text\u{1B}"
        let result = ANSIStripper.strip(input)
        XCTAssertEqual(result, "text")
    }

    func testEscapeWithoutBracket() {
        // ESC followed by non-[ char (simple C1 code) — consume both, produce nothing
        let input = "a\u{1B}=b"
        XCTAssertEqual(ANSIStripper.strip(input), "ab")
    }
}
