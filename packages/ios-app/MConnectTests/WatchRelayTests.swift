import XCTest
@testable import MConnect

final class WatchRelayTests: XCTestCase {

    func testUsageCommandParserAcceptsJsonSnapshot() {
        let stdout = """
        {
            "promptTokens": 1200,
            "completionTokens": 340,
            "totalTokens": 1540,
            "costUsd": 0.42,
            "window": "today",
            "model": "gpt-5.5",
            "updatedAt": "2026-05-19T18:30:00Z"
        }
        """

        let snapshot = UsageCommandParser.snapshot(from: stdout)

        XCTAssertEqual(snapshot.promptTokens, 1200)
        XCTAssertEqual(snapshot.completionTokens, 340)
        XCTAssertEqual(snapshot.totalTokens, 1540)
        XCTAssertEqual(snapshot.costUsd, 0.42)
        XCTAssertEqual(snapshot.window, "today")
        XCTAssertEqual(snapshot.model, "gpt-5.5")
        XCTAssertNil(snapshot.errorMessage)
    }

    func testUsageCommandParserReturnsUnavailableForBadOutput() {
        let snapshot = UsageCommandParser.snapshot(from: "not json")

        XCTAssertNil(snapshot.totalTokens)
        XCTAssertNotNil(snapshot.errorMessage)
    }

    func testServerMessageParsesUsageSnapshot() throws {
        let json = """
        {
            "type": "usage_snapshot",
            "usage": {
                "promptTokens": 20,
                "completionTokens": 5,
                "totalTokens": 25,
                "updatedAt": "2026-05-19T18:30:00Z"
            },
            "timestamp": 1779215400000
        }
        """

        let message = ServerMessage.parse(from: Data(json.utf8))

        guard case .usageSnapshot(let response) = message else {
            return XCTFail("Expected usage snapshot response")
        }
        XCTAssertEqual(response.usage.totalTokens, 25)
        XCTAssertNotNil(response.usage.updatedAt)
    }

    func testWatchCommandQueueWrapsDictatedPromptWithMobileContext() {
        let draft = WatchCommandDraft(
            id: UUID(uuidString: "00000000-0000-0000-0000-000000000001")!,
            kind: .dictation,
            text: "check the tests and summarize what failed",
            createdAt: Date(timeIntervalSince1970: 1_800_000_000)
        )
        let context = WatchCommandContext(
            deviceClass: .watch,
            hostName: "Arya MacBook",
            sessionId: "session-1",
            agentName: "Codex",
            requiresConciseResponse: true
        )

        let input = WatchCommandQueue.terminalInput(for: draft, context: context)

        XCTAssertTrue(input.contains("User is speaking from Apple Watch"))
        XCTAssertTrue(input.contains("respond concisely"))
        XCTAssertTrue(input.contains("check the tests and summarize what failed"))
        XCTAssertTrue(input.hasSuffix("\n"))
    }

    func testWatchSessionSummaryPicksActiveAgent() {
        let agents = [
            AgentInfo(id: "a1", name: "Codex", preset: "codex", status: .running),
            AgentInfo(id: "a2", name: "Shell", preset: "shell", status: .idle),
        ]

        let summary = WatchSessionSummary(
            hostName: "Arya MacBook",
            sessionId: "session-1",
            connectionState: .connected,
            agents: agents,
            activeAgentId: "a1",
            usage: .unavailable("not refreshed"),
            lastActivity: Date(timeIntervalSince1970: 1_800_000_000)
        )

        XCTAssertEqual(summary.activeAgent?.name, "Codex")
        XCTAssertEqual(summary.usage.errorMessage, "not refreshed")
    }
}
