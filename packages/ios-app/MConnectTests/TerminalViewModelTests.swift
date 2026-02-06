import XCTest
@testable import MConnect

@MainActor
final class TerminalBufferTests: XCTestCase {

    func testAppendAndRetrieve() {
        let buffer = TerminalBuffer(maxScrollbackLines: 100)
        buffer.append("Hello\n", forAgent: "agent-1")
        buffer.append("World\n", forAgent: "agent-1")

        let text = buffer.displayText(forAgent: "agent-1")
        XCTAssertTrue(text.contains("Hello"))
        XCTAssertTrue(text.contains("World"))
    }

    func testPerAgentIsolation() {
        let buffer = TerminalBuffer(maxScrollbackLines: 100)
        buffer.append("Agent1 output\n", forAgent: "agent-1")
        buffer.append("Agent2 output\n", forAgent: "agent-2")

        let text1 = buffer.displayText(forAgent: "agent-1")
        let text2 = buffer.displayText(forAgent: "agent-2")

        XCTAssertTrue(text1.contains("Agent1"))
        XCTAssertFalse(text1.contains("Agent2"))
        XCTAssertTrue(text2.contains("Agent2"))
        XCTAssertFalse(text2.contains("Agent1"))
    }

    func testScrollbackLimit() {
        let buffer = TerminalBuffer(maxScrollbackLines: 5)
        for i in 0..<10 {
            buffer.append("Line \(i)\n", forAgent: "agent-1")
        }

        let count = buffer.lineCount(forAgent: "agent-1")
        XCTAssertLessThanOrEqual(count, 5)
    }

    func testClearAgent() {
        let buffer = TerminalBuffer(maxScrollbackLines: 100)
        buffer.append("Some output\n", forAgent: "agent-1")
        buffer.clear(forAgent: "agent-1")

        let text = buffer.displayText(forAgent: "agent-1")
        XCTAssertTrue(text.isEmpty)
    }

    func testClearAll() {
        let buffer = TerminalBuffer(maxScrollbackLines: 100)
        buffer.append("Output 1\n", forAgent: "agent-1")
        buffer.append("Output 2\n", forAgent: "agent-2")
        buffer.clearAll()

        XCTAssertTrue(buffer.displayText(forAgent: "agent-1").isEmpty)
        XCTAssertTrue(buffer.displayText(forAgent: "agent-2").isEmpty)
    }

    func testStripANSICodes() {
        let buffer = TerminalBuffer(maxScrollbackLines: 100)
        // Typical ANSI: ESC[32m Green text ESC[0m
        buffer.append("\u{1B}[32mGreen text\u{1B}[0m\n", forAgent: "agent-1")

        let text = buffer.displayText(forAgent: "agent-1")
        XCTAssertTrue(text.contains("Green text"))
        XCTAssertFalse(text.contains("\u{1B}"))
    }

    func testRawOutputPreservesANSI() {
        let buffer = TerminalBuffer(maxScrollbackLines: 100)
        let ansiText = "\u{1B}[32mGreen\u{1B}[0m\n"
        buffer.append(ansiText, forAgent: "agent-1")

        let raw = buffer.rawOutput(forAgent: "agent-1")
        XCTAssertTrue(raw.contains("\u{1B}"))
    }

    func testPrependScrollback() {
        let buffer = TerminalBuffer(maxScrollbackLines: 100)
        buffer.append("Current line\n", forAgent: "agent-1")
        buffer.prependScrollback(["Old line 1", "Old line 2"], forAgent: "agent-1")

        let text = buffer.displayText(forAgent: "agent-1")
        // Old lines should appear before current
        let oldRange = text.range(of: "Old line 1")
        let currentRange = text.range(of: "Current line")
        XCTAssertNotNil(oldRange)
        XCTAssertNotNil(currentRange)
        if let o = oldRange, let c = currentRange {
            XCTAssertTrue(o.lowerBound < c.lowerBound)
        }
    }

    func testEmptyAgentReturnsEmpty() {
        let buffer = TerminalBuffer(maxScrollbackLines: 100)
        XCTAssertTrue(buffer.displayText(forAgent: "nonexistent").isEmpty)
        XCTAssertEqual(buffer.lineCount(forAgent: "nonexistent"), 0)
    }

    func testMultipleAppends() {
        let buffer = TerminalBuffer(maxScrollbackLines: 100)
        buffer.append("Line 1\n", forAgent: "agent-1")
        buffer.append("Line 2\n", forAgent: "agent-1")
        buffer.append("Line 3\n", forAgent: "agent-1")

        let text = buffer.displayText(forAgent: "agent-1")
        XCTAssertTrue(text.contains("Line 1"))
        XCTAssertTrue(text.contains("Line 2"))
        XCTAssertTrue(text.contains("Line 3"))

        let lineCount = buffer.lineCount(forAgent: "agent-1")
        XCTAssertGreaterThanOrEqual(lineCount, 3)
    }

    func testPartialLines() {
        let buffer = TerminalBuffer(maxScrollbackLines: 100)
        // Simulate streaming output without newlines
        buffer.append("Hello ", forAgent: "agent-1")
        buffer.append("World", forAgent: "agent-1")

        let text = buffer.displayText(forAgent: "agent-1")
        XCTAssertTrue(text.contains("Hello World"))
    }
}

@MainActor
final class TerminalViewModelTests: XCTestCase {

    private func makeViewModel() -> (TerminalViewModel, WSClient) {
        let client = WSClient(tokenManager: TokenManager())
        let host = Host(
            id: "host-1",
            name: "Test",
            hostname: "localhost",
            port: 8080,
            useTLS: false,
            requireBiometric: false,
            isConnected: false
        )
        let vm = TerminalViewModel(host: host, wsClient: client)
        return (vm, client)
    }

    func testInitialState() {
        let (vm, _) = makeViewModel()
        XCTAssertTrue(vm.agents.isEmpty)
        XCTAssertNil(vm.activeAgent)
        XCTAssertTrue(vm.displayText.isEmpty)
        XCTAssertEqual(vm.connectionState, .disconnected)
    }

    func testDidReceiveOutputUpdatesDisplayText() {
        let (vm, client) = makeViewModel()
        let agent = AgentInfo(id: "a1", name: "Claude", preset: "claude", status: .running)

        // Simulate receiving agent list and output
        vm.wsClient(client, didReceiveAgentList: [agent])
        XCTAssertEqual(vm.activeAgent?.id, "a1")

        vm.wsClient(client, didReceiveOutput: "Hello from agent\n", fromAgent: "a1")
        XCTAssertTrue(vm.displayText.contains("Hello from agent"))
    }

    func testOutputFromNonActiveAgentDoesNotUpdateDisplay() {
        let (vm, client) = makeViewModel()
        let agent1 = AgentInfo(id: "a1", name: "Claude", preset: "claude", status: .running)
        let agent2 = AgentInfo(id: "a2", name: "Shell", preset: "shell", status: .idle)

        vm.wsClient(client, didReceiveAgentList: [agent1, agent2])
        // a1 is active (first agent)

        vm.wsClient(client, didReceiveOutput: "From agent 2\n", fromAgent: "a2")
        XCTAssertFalse(vm.displayText.contains("From agent 2"))
    }

    func testAgentSwitchingUpdatesDisplay() {
        let (vm, client) = makeViewModel()
        let agent1 = AgentInfo(id: "a1", name: "Claude", preset: "claude", status: .running)
        let agent2 = AgentInfo(id: "a2", name: "Shell", preset: "shell", status: .idle)

        vm.wsClient(client, didReceiveAgentList: [agent1, agent2])
        vm.wsClient(client, didReceiveOutput: "Agent1 output\n", fromAgent: "a1")
        vm.wsClient(client, didReceiveOutput: "Agent2 output\n", fromAgent: "a2")

        XCTAssertTrue(vm.displayText.contains("Agent1 output"))

        // Switch to agent 2 - didSet should trigger updateDisplayText
        vm.activeAgent = agent2

        // After switching, display should show agent2's output
        XCTAssertTrue(vm.displayText.contains("Agent2 output"))
        XCTAssertFalse(vm.displayText.contains("Agent1 output"))
    }

    func testConnectionStateUpdates() {
        let (vm, client) = makeViewModel()
        vm.wsClient(client, didChangeState: .connecting)
        XCTAssertEqual(vm.connectionState, .connecting)

        vm.wsClient(client, didChangeState: .connected)
        XCTAssertEqual(vm.connectionState, .connected)
    }

    func testAgentStatusUpdates() {
        let (vm, client) = makeViewModel()
        let agent = AgentInfo(id: "a1", name: "Claude", preset: "claude", status: .running)
        vm.wsClient(client, didReceiveAgentList: [agent])

        vm.wsClient(client, didReceiveAgentStatus: "a1", status: .idle)
        XCTAssertEqual(vm.agents.first?.status, .idle)
        XCTAssertEqual(vm.activeAgent?.status, .idle)
    }

    func testInputRejectionShowsMessage() {
        let (vm, client) = makeViewModel()

        let response = InputRejectedResponse(
            type: "input_rejected",
            reason: .pcTyping,
            command: nil,
            timestamp: 1700000000000
        )

        vm.wsClient(client, didReceiveInputRejection: response)
        XCTAssertNotNil(vm.inputRejectionMessage)
        XCTAssertTrue(vm.inputRejectionMessage?.contains("PC") == true)
    }

    func testGuardrailRejectionShowsCommand() {
        let (vm, client) = makeViewModel()

        let response = InputRejectedResponse(
            type: "input_rejected",
            reason: .guardrailBlocked,
            command: "rm -rf /",
            timestamp: 1700000000000
        )

        vm.wsClient(client, didReceiveInputRejection: response)
        XCTAssertTrue(vm.inputRejectionMessage?.contains("rm -rf /") == true)
    }

    func testSelectsFirstAgentAutomatically() {
        let (vm, client) = makeViewModel()
        let agents = [
            AgentInfo(id: "a1", name: "Claude", preset: "claude", status: .running),
            AgentInfo(id: "a2", name: "Shell", preset: "shell", status: .idle),
        ]

        vm.wsClient(client, didReceiveAgentList: agents)
        XCTAssertEqual(vm.activeAgent?.id, "a1")
    }

    func testDoesNotReplaceActiveAgentOnSubsequentList() {
        let (vm, client) = makeViewModel()
        let agents = [
            AgentInfo(id: "a1", name: "Claude", preset: "claude", status: .running),
            AgentInfo(id: "a2", name: "Shell", preset: "shell", status: .idle),
        ]

        vm.wsClient(client, didReceiveAgentList: agents)
        vm.activeAgent = agents[1] // User selects Shell

        // Receiving updated agent list shouldn't change selection
        vm.wsClient(client, didReceiveAgentList: agents)
        XCTAssertEqual(vm.activeAgent?.id, "a2")
    }

    func testScrollbackPrependsToBuffer() {
        let (vm, client) = makeViewModel()
        let agent = AgentInfo(id: "a1", name: "Claude", preset: "claude", status: .running)
        vm.wsClient(client, didReceiveAgentList: [agent])

        // Add current output
        vm.wsClient(client, didReceiveOutput: "Current line\n", fromAgent: "a1")

        // Receive scrollback
        let scrollbackResponse = ScrollbackResponse(
            type: "scrollback_response",
            sessionId: "session-1",
            lines: ["Old line 1", "Old line 2"],
            fromLine: 0,
            totalLines: 100,
            timestamp: 1700000000000
        )

        vm.wsClient(client, didReceiveScrollback: scrollbackResponse)

        // Display should now contain both old and current
        XCTAssertTrue(vm.displayText.contains("Old line 1"))
        XCTAssertTrue(vm.displayText.contains("Old line 2"))
        XCTAssertTrue(vm.displayText.contains("Current line"))
    }

    func testInputStateTracking() {
        let (vm, client) = makeViewModel()
        let agent = AgentInfo(id: "a1", name: "Claude", preset: "claude", status: .running)
        vm.wsClient(client, didReceiveAgentList: [agent])

        // Initial state
        XCTAssertEqual(vm.inputState, .idle)

        // Agent status update to running
        vm.wsClient(client, didReceiveAgentStatus: "a1", status: .running)
        XCTAssertEqual(vm.inputState, .agentWorking)

        // Agent status update to idle
        vm.wsClient(client, didReceiveAgentStatus: "a1", status: .idle)
        XCTAssertEqual(vm.inputState, .idle)
    }

    func testMultipleAgentsManagement() {
        let (vm, client) = makeViewModel()
        let agents = [
            AgentInfo(id: "a1", name: "Claude", preset: "claude", status: .running),
            AgentInfo(id: "a2", name: "Shell", preset: "shell", status: .idle),
            AgentInfo(id: "a3", name: "Python", preset: "python", status: .running),
        ]

        vm.wsClient(client, didReceiveAgentList: agents)

        // Should have all 3 agents
        XCTAssertEqual(vm.agents.count, 3)

        // First agent should be active
        XCTAssertEqual(vm.activeAgent?.id, "a1")

        // Send output to different agents
        vm.wsClient(client, didReceiveOutput: "Output from a1\n", fromAgent: "a1")
        vm.wsClient(client, didReceiveOutput: "Output from a2\n", fromAgent: "a2")
        vm.wsClient(client, didReceiveOutput: "Output from a3\n", fromAgent: "a3")

        // Display should only show active agent (a1)
        XCTAssertTrue(vm.displayText.contains("Output from a1"))
        XCTAssertFalse(vm.displayText.contains("Output from a2"))

        // Switch to a3
        vm.activeAgent = agents[2]
        XCTAssertTrue(vm.displayText.contains("Output from a3"))
        XCTAssertFalse(vm.displayText.contains("Output from a1"))
    }

    func testErrorHandling() {
        let (vm, client) = makeViewModel()

        let errorResponse = ErrorResponse(
            type: "error",
            message: "Test error message",
            code: .internalError,
            retryable: false,
            retryAfterMs: nil,
            timestamp: 1700000000000
        )

        // Should not crash
        vm.wsClient(client, didReceiveError: errorResponse)

        // Error is logged but doesn't change state
        XCTAssertEqual(vm.connectionState, .disconnected)
    }

    func testControlStatusHandling() {
        let (vm, client) = makeViewModel()
        let agent = AgentInfo(id: "a1", name: "Claude", preset: "claude", status: .running)
        vm.wsClient(client, didReceiveAgentList: [agent])

        let controlStatusResponse = ControlStatusResponse(
            type: "control_status",
            sessionId: "session-1",
            state: .pcActive,
            activeClient: nil,
            exclusiveExpires: nil,
            lastPcActivity: 1700000000000,
            timestamp: 1700000000000
        )

        vm.wsClient(client, didReceiveControlStatus: controlStatusResponse)

        // InputArbiter should track the control state
        XCTAssertNotNil(vm.inputState)
    }

    func testEmptyAgentListHandling() {
        let (vm, client) = makeViewModel()

        // Receive empty agent list
        vm.wsClient(client, didReceiveAgentList: [])

        XCTAssertTrue(vm.agents.isEmpty)
        XCTAssertNil(vm.activeAgent)
        XCTAssertTrue(vm.displayText.isEmpty)
    }

    func testRejectionMessageDismissal() async {
        let (vm, client) = makeViewModel()

        let response = InputRejectedResponse(
            type: "input_rejected",
            reason: .rateLimited,
            command: nil,
            timestamp: 1700000000000
        )

        vm.wsClient(client, didReceiveInputRejection: response)
        XCTAssertNotNil(vm.inputRejectionMessage)

        // Wait for auto-dismissal (3 seconds in implementation)
        try? await Task.sleep(for: .seconds(3.5))

        XCTAssertNil(vm.inputRejectionMessage)
    }

    func testAgentStatusUpdatePreservesAgentInfo() {
        let (vm, client) = makeViewModel()
        let agent = AgentInfo(id: "a1", name: "Claude", preset: "claude-3.5", status: .running)
        vm.wsClient(client, didReceiveAgentList: [agent])

        // Update status
        vm.wsClient(client, didReceiveAgentStatus: "a1", status: .idle)

        // Agent should still have same name and preset
        XCTAssertEqual(vm.agents.first?.name, "Claude")
        XCTAssertEqual(vm.agents.first?.preset, "claude-3.5")
        XCTAssertEqual(vm.agents.first?.status, .idle)
    }
}
