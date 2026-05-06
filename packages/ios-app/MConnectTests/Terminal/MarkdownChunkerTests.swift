import XCTest
@testable import MConnect

final class MarkdownChunkerTests: XCTestCase {

    // MARK: - Pure command

    func testSingleCommandLine() {
        let input = "$ git status"
        let result = MarkdownChunker.chunks(from: input)
        XCTAssertEqual(result, [.command("git status")])
    }

    func testArrowCommandPrefix() {
        let input = "➜ npm install"
        let result = MarkdownChunker.chunks(from: input)
        XCTAssertEqual(result, [.command("npm install")])
    }

    func testMultipleCommandLinesGrouped() {
        let input = """
        $ cd /tmp
        $ ls -la
        $ pwd
        """
        let result = MarkdownChunker.chunks(from: input)
        XCTAssertEqual(result.count, 1)
        if case .command(let body) = result[0] {
            XCTAssertTrue(body.contains("cd /tmp"))
            XCTAssertTrue(body.contains("ls -la"))
            XCTAssertTrue(body.contains("pwd"))
        } else {
            XCTFail("Expected .command chunk")
        }
    }

    // MARK: - Assistant messages

    func testAngleBracketAssistantPrefix() {
        let input = "> Here is the answer to your question."
        let result = MarkdownChunker.chunks(from: input)
        XCTAssertEqual(result, [.assistantMessage("Here is the answer to your question.")])
    }

    func testChevronAssistantPrefix() {
        let input = "❯ Running analysis..."
        let result = MarkdownChunker.chunks(from: input)
        XCTAssertEqual(result, [.assistantMessage("Running analysis...")])
    }

    func testMultilineAssistantGrouped() {
        let input = """
        > First line of response.
        > Second line of response.
        """
        let result = MarkdownChunker.chunks(from: input)
        XCTAssertEqual(result.count, 1)
        if case .assistantMessage(let body) = result[0] {
            XCTAssertTrue(body.contains("First line"))
            XCTAssertTrue(body.contains("Second line"))
        } else {
            XCTFail("Expected .assistantMessage chunk")
        }
    }

    // MARK: - Code block extraction

    func testFencedCodeBlockNoLanguage() {
        let input = """
        ```
        let x = 42
        print(x)
        ```
        """
        let result = MarkdownChunker.chunks(from: input)
        XCTAssertEqual(result.count, 1)
        if case .codeBlock(let lang, let body) = result[0] {
            XCTAssertNil(lang)
            XCTAssertTrue(body.contains("let x = 42"))
            XCTAssertTrue(body.contains("print(x)"))
        } else {
            XCTFail("Expected .codeBlock chunk")
        }
    }

    func testFencedCodeBlockWithLanguage() {
        let input = """
        ```swift
        struct Foo { }
        ```
        """
        let result = MarkdownChunker.chunks(from: input)
        XCTAssertEqual(result.count, 1)
        if case .codeBlock(let lang, let body) = result[0] {
            XCTAssertEqual(lang, "swift")
            XCTAssertTrue(body.contains("struct Foo"))
        } else {
            XCTFail("Expected .codeBlock chunk")
        }
    }

    func testCodeBlockDoesNotAbsorbSurroundingChunks() {
        let input = """
        > Before block
        ```python
        x = 1
        ```
        > After block
        """
        let result = MarkdownChunker.chunks(from: input)
        XCTAssertEqual(result.count, 3)
        XCTAssertEqual(result[0], .assistantMessage("Before block"))
        if case .codeBlock(let lang, _) = result[1] {
            XCTAssertEqual(lang, "python")
        } else {
            XCTFail("Expected .codeBlock at index 1")
        }
        XCTAssertEqual(result[2], .assistantMessage("After block"))
    }

    // MARK: - Prompt prefix detection (mixed Claude Code TUI scrub)

    func testMixedClaudeCodeOutput() {
        let input = """
        $ claude --chat
        > Analyzing your repository...
        > Found 3 issues:
        1. Missing tests
        2. Unused imports
        ```bash
        grep -r "TODO" src/
        ```
        > Done.
        """
        let result = MarkdownChunker.chunks(from: input)

        // Should have: command, assistantMessage (2 lines), output (2 lines), codeBlock, assistantMessage
        XCTAssertGreaterThanOrEqual(result.count, 4)

        // First chunk is the command
        XCTAssertEqual(result[0], .command("claude --chat"))

        // Verify code block is present
        let hasCodeBlock = result.contains(where: {
            if case .codeBlock = $0 { return true }
            return false
        })
        XCTAssertTrue(hasCodeBlock)
    }

    func testOutputFallthrough() {
        let input = """
        Some random terminal output
        More output here
        """
        let result = MarkdownChunker.chunks(from: input)
        XCTAssertEqual(result.count, 1)
        if case .output(let body) = result[0] {
            XCTAssertTrue(body.contains("Some random terminal output"))
            XCTAssertTrue(body.contains("More output here"))
        } else {
            XCTFail("Expected .output chunk")
        }
    }

    func testEmptyInputReturnsEmpty() {
        XCTAssertTrue(MarkdownChunker.chunks(from: "").isEmpty)
    }

    // MARK: - Adjacent grouping

    func testAdjacentSameKindMerged() {
        let input = "output line 1\noutput line 2\noutput line 3"
        let result = MarkdownChunker.chunks(from: input)
        XCTAssertEqual(result.count, 1)
    }

    func testKindTransitionSplits() {
        let input = "output line\n$ command\nmore output"
        let result = MarkdownChunker.chunks(from: input)
        XCTAssertEqual(result.count, 3)
        if case .output = result[0] {} else { XCTFail("Expected output at 0") }
        if case .command = result[1] {} else { XCTFail("Expected command at 1") }
        if case .output = result[2] {} else { XCTFail("Expected output at 2") }
    }

    // MARK: - Prefix stripping

    func testCommandPrefixStripped() {
        let result = MarkdownChunker.chunks(from: "$ echo hello")
        if case .command(let body) = result.first {
            XCTAssertFalse(body.hasPrefix("$ "))
            XCTAssertEqual(body, "echo hello")
        } else {
            XCTFail("Expected command")
        }
    }

    func testAssistantPrefixStripped() {
        let result = MarkdownChunker.chunks(from: "> Hello world")
        if case .assistantMessage(let body) = result.first {
            XCTAssertFalse(body.hasPrefix("> "))
            XCTAssertEqual(body, "Hello world")
        } else {
            XCTFail("Expected assistantMessage")
        }
    }

    // MARK: - Unclosed code fence

    func testUnclosedCodeFenceConsumesRemainder() {
        let input = """
        ```
        line without closing fence
        """
        let result = MarkdownChunker.chunks(from: input)
        XCTAssertEqual(result.count, 1)
        if case .codeBlock(_, let body) = result[0] {
            XCTAssertTrue(body.contains("line without closing fence"))
        } else {
            XCTFail("Expected codeBlock")
        }
    }
}
