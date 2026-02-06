import XCTest
@testable import MConnect

// MARK: - Protocol Message Parsing Tests

final class ProtocolTests: XCTestCase {

    // MARK: - Auth Success

    func testParseAuthSuccessMessage() {
        let json = """
        {
            "type": "auth_success",
            "clientId": "client-abc",
            "protocolVersion": "3.0",
            "clientType": "mobile",
            "userId": "user-123",
            "timestamp": 1700000000000
        }
        """.data(using: .utf8)!

        let message = ServerMessage.parse(from: json)
        guard case .authSuccess(let response) = message else {
            XCTFail("Expected auth_success, got \(String(describing: message))")
            return
        }

        XCTAssertEqual(response.clientId, "client-abc")
        XCTAssertEqual(response.protocolVersion, "3.0")
        XCTAssertEqual(response.clientType, .mobile)
        XCTAssertEqual(response.userId, "user-123")
        XCTAssertEqual(response.timestamp, 1700000000000)
    }

    // MARK: - Auth Failed

    func testParseAuthFailedMessage() {
        let json = """
        {
            "type": "auth_failed",
            "reason": "expired_token",
            "retryable": true,
            "timestamp": 1700000000000
        }
        """.data(using: .utf8)!

        let message = ServerMessage.parse(from: json)
        guard case .authFailed(let response) = message else {
            XCTFail("Expected auth_failed")
            return
        }

        XCTAssertEqual(response.reason, .expiredToken)
        XCTAssertTrue(response.retryable)
    }

    func testParseAuthFailedInvalidToken() {
        let json = """
        {
            "type": "auth_failed",
            "reason": "invalid_token",
            "retryable": false,
            "timestamp": 1700000000000
        }
        """.data(using: .utf8)!

        let message = ServerMessage.parse(from: json)
        guard case .authFailed(let response) = message else {
            XCTFail("Expected auth_failed")
            return
        }

        XCTAssertEqual(response.reason, .invalidToken)
        XCTAssertFalse(response.retryable)
    }

    // MARK: - Session List

    func testParseSessionListMessage() {
        let json = """
        {
            "type": "session_list",
            "sessions": [
                {
                    "id": "sess-1",
                    "name": "Dev Session",
                    "state": "active",
                    "agentCount": 2,
                    "createdAt": 1700000000000,
                    "lastActivity": 1700000050000
                },
                {
                    "id": "sess-2",
                    "name": null,
                    "state": "idle",
                    "agentCount": 0,
                    "createdAt": 1699999000000,
                    "lastActivity": 1699999900000
                }
            ],
            "timestamp": 1700000060000
        }
        """.data(using: .utf8)!

        let message = ServerMessage.parse(from: json)
        guard case .sessionList(let response) = message else {
            XCTFail("Expected session_list")
            return
        }

        XCTAssertEqual(response.sessions.count, 2)
        XCTAssertEqual(response.sessions[0].id, "sess-1")
        XCTAssertEqual(response.sessions[0].name, "Dev Session")
        XCTAssertEqual(response.sessions[0].state, .active)
        XCTAssertEqual(response.sessions[0].agentCount, 2)
        XCTAssertNil(response.sessions[1].name)
        XCTAssertEqual(response.sessions[1].state, .idle)
    }

    // MARK: - Session State

    func testParseSessionStateMessage() {
        let json = """
        {
            "type": "session_state",
            "sessionId": "sess-1",
            "state": "active",
            "lastActivity": 1700000050000,
            "timestamp": 1700000060000
        }
        """.data(using: .utf8)!

        let message = ServerMessage.parse(from: json)
        guard case .sessionState(let response) = message else {
            XCTFail("Expected session_state")
            return
        }

        XCTAssertEqual(response.sessionId, "sess-1")
        XCTAssertEqual(response.state, .active)
    }

    // MARK: - Terminal Output

    func testParseTerminalOutputMessage() {
        let json = """
        {
            "type": "terminal_output",
            "agentId": "agent-1",
            "data": "Hello, world!\\n",
            "timestamp": 1700000060000
        }
        """.data(using: .utf8)!

        let message = ServerMessage.parse(from: json)
        guard case .terminalOutput(let response) = message else {
            XCTFail("Expected terminal_output")
            return
        }

        XCTAssertEqual(response.agentId, "agent-1")
        XCTAssertEqual(response.data, "Hello, world!\n")
    }

    // MARK: - Agent Status

    func testParseAgentStatusMessage() {
        let json = """
        {
            "type": "agent_status",
            "agentId": "agent-1",
            "status": "running",
            "timestamp": 1700000060000
        }
        """.data(using: .utf8)!

        let message = ServerMessage.parse(from: json)
        guard case .agentStatus(let response) = message else {
            XCTFail("Expected agent_status")
            return
        }

        XCTAssertEqual(response.agentId, "agent-1")
        XCTAssertEqual(response.status, .running)
    }

    // MARK: - Agent List

    func testParseAgentListMessage() {
        let json = """
        {
            "type": "agent_list",
            "agents": [
                {
                    "id": "agent-1",
                    "name": "Claude Code",
                    "preset": "claude",
                    "status": "running"
                },
                {
                    "id": "agent-2",
                    "name": "Shell",
                    "preset": "shell",
                    "status": "idle"
                }
            ],
            "timestamp": 1700000060000
        }
        """.data(using: .utf8)!

        let message = ServerMessage.parse(from: json)
        guard case .agentList(let response) = message else {
            XCTFail("Expected agent_list")
            return
        }

        XCTAssertEqual(response.agents.count, 2)
        XCTAssertEqual(response.agents[0].name, "Claude Code")
        XCTAssertEqual(response.agents[0].status, .running)
        XCTAssertEqual(response.agents[1].preset, "shell")
        XCTAssertEqual(response.agents[1].status, .idle)
    }

    // MARK: - Control Status

    func testParseControlStatusMessage() {
        let json = """
        {
            "type": "control_status",
            "sessionId": "sess-1",
            "state": "pc_active",
            "activeClient": "client-pc",
            "lastPcActivity": 1700000050000,
            "timestamp": 1700000060000
        }
        """.data(using: .utf8)!

        let message = ServerMessage.parse(from: json)
        guard case .controlStatus(let response) = message else {
            XCTFail("Expected control_status")
            return
        }

        XCTAssertEqual(response.state, .pcActive)
        XCTAssertEqual(response.activeClient, "client-pc")
        XCTAssertNil(response.exclusiveExpires)
    }

    func testParseControlStatusMobileExclusive() {
        let json = """
        {
            "type": "control_status",
            "sessionId": "sess-1",
            "state": "mobile_exclusive",
            "activeClient": "client-mobile",
            "exclusiveExpires": 1700000360000,
            "timestamp": 1700000060000
        }
        """.data(using: .utf8)!

        let message = ServerMessage.parse(from: json)
        guard case .controlStatus(let response) = message else {
            XCTFail("Expected control_status")
            return
        }

        XCTAssertEqual(response.state, .mobileExclusive)
        XCTAssertEqual(response.exclusiveExpires, 1700000360000)
    }

    // MARK: - Control Response

    func testParseControlResponseGranted() {
        let json = """
        {
            "type": "control_response",
            "granted": true,
            "expiresAt": 1700000360000,
            "timestamp": 1700000060000
        }
        """.data(using: .utf8)!

        let message = ServerMessage.parse(from: json)
        guard case .controlResponse(let response) = message else {
            XCTFail("Expected control_response")
            return
        }

        XCTAssertTrue(response.granted)
        XCTAssertEqual(response.expiresAt, 1700000360000)
        XCTAssertNil(response.reason)
    }

    func testParseControlResponseDenied() {
        let json = """
        {
            "type": "control_response",
            "granted": false,
            "reason": "PC is currently active",
            "timestamp": 1700000060000
        }
        """.data(using: .utf8)!

        let message = ServerMessage.parse(from: json)
        guard case .controlResponse(let response) = message else {
            XCTFail("Expected control_response")
            return
        }

        XCTAssertFalse(response.granted)
        XCTAssertEqual(response.reason, "PC is currently active")
    }

    // MARK: - Input Rejected

    func testParseInputRejectedMessage() {
        let json = """
        {
            "type": "input_rejected",
            "reason": "pc_typing",
            "timestamp": 1700000060000
        }
        """.data(using: .utf8)!

        let message = ServerMessage.parse(from: json)
        guard case .inputRejected(let response) = message else {
            XCTFail("Expected input_rejected")
            return
        }

        XCTAssertEqual(response.reason, .pcTyping)
        XCTAssertNil(response.command)
    }

    func testParseInputRejectedGuardrail() {
        let json = """
        {
            "type": "input_rejected",
            "reason": "guardrail_blocked",
            "command": "rm -rf /",
            "timestamp": 1700000060000
        }
        """.data(using: .utf8)!

        let message = ServerMessage.parse(from: json)
        guard case .inputRejected(let response) = message else {
            XCTFail("Expected input_rejected")
            return
        }

        XCTAssertEqual(response.reason, .guardrailBlocked)
        XCTAssertEqual(response.command, "rm -rf /")
    }

    // MARK: - Scrollback Response

    func testParseScrollbackResponse() {
        let json = """
        {
            "type": "scrollback_response",
            "sessionId": "sess-1",
            "lines": ["$ ls", "file1.txt", "file2.txt"],
            "fromLine": 0,
            "totalLines": 100,
            "timestamp": 1700000060000
        }
        """.data(using: .utf8)!

        let message = ServerMessage.parse(from: json)
        guard case .scrollbackResponse(let response) = message else {
            XCTFail("Expected scrollback_response")
            return
        }

        XCTAssertEqual(response.lines.count, 3)
        XCTAssertEqual(response.fromLine, 0)
        XCTAssertEqual(response.totalLines, 100)
    }

    // MARK: - Client Presence

    func testParseClientJoinedMessage() {
        let json = """
        {
            "type": "client_joined",
            "client": {
                "clientId": "client-new",
                "clientType": "desktop",
                "userId": "user-123"
            },
            "timestamp": 1700000060000
        }
        """.data(using: .utf8)!

        let message = ServerMessage.parse(from: json)
        guard case .clientJoined(let response) = message else {
            XCTFail("Expected client_joined")
            return
        }

        XCTAssertEqual(response.client.clientId, "client-new")
        XCTAssertEqual(response.client.clientType, .desktop)
    }

    func testParseClientLeftMessage() {
        let json = """
        {
            "type": "client_left",
            "clientId": "client-old",
            "timestamp": 1700000060000
        }
        """.data(using: .utf8)!

        let message = ServerMessage.parse(from: json)
        guard case .clientLeft(let response) = message else {
            XCTFail("Expected client_left")
            return
        }

        XCTAssertEqual(response.clientId, "client-old")
    }

    // MARK: - Heartbeat

    func testParseHeartbeatMessage() {
        let json = """
        {
            "type": "heartbeat",
            "timestamp": 1700000060000,
            "serverTime": 1700000060000
        }
        """.data(using: .utf8)!

        let message = ServerMessage.parse(from: json)
        guard case .heartbeat(let response) = message else {
            XCTFail("Expected heartbeat")
            return
        }

        XCTAssertEqual(response.timestamp, 1700000060000)
        XCTAssertEqual(response.serverTime, 1700000060000)
    }

    // MARK: - Pong

    func testParsePongMessage() {
        let json = """
        {
            "type": "pong",
            "timestamp": 1700000060000
        }
        """.data(using: .utf8)!

        let message = ServerMessage.parse(from: json)
        guard case .pong(let response) = message else {
            XCTFail("Expected pong")
            return
        }

        XCTAssertEqual(response.timestamp, 1700000060000)
    }

    // MARK: - Error

    func testParseErrorMessage() {
        let json = """
        {
            "type": "error",
            "message": "Session not found",
            "code": "SESSION_NOT_FOUND",
            "retryable": false,
            "timestamp": 1700000060000
        }
        """.data(using: .utf8)!

        let message = ServerMessage.parse(from: json)
        guard case .error(let response) = message else {
            XCTFail("Expected error")
            return
        }

        XCTAssertEqual(response.code, .sessionNotFound)
        XCTAssertEqual(response.message, "Session not found")
        XCTAssertFalse(response.retryable)
        XCTAssertNil(response.retryAfterMs)
    }

    func testParseErrorWithRetry() {
        let json = """
        {
            "type": "error",
            "message": "Rate limited",
            "code": "RATE_LIMITED",
            "retryable": true,
            "retryAfterMs": 5000,
            "timestamp": 1700000060000
        }
        """.data(using: .utf8)!

        let message = ServerMessage.parse(from: json)
        guard case .error(let response) = message else {
            XCTFail("Expected error")
            return
        }

        XCTAssertEqual(response.code, .rateLimited)
        XCTAssertTrue(response.retryable)
        XCTAssertEqual(response.retryAfterMs, 5000)
    }

    // MARK: - Edge Cases

    func testParseReturnsNilForInvalidJSON() {
        let data = "not json".data(using: .utf8)!
        XCTAssertNil(ServerMessage.parse(from: data))
    }

    func testParseReturnsNilForUnknownType() {
        let json = """
        {"type": "unknown_message", "timestamp": 1700000060000}
        """.data(using: .utf8)!
        XCTAssertNil(ServerMessage.parse(from: json))
    }

    func testParseReturnsNilForMissingType() {
        let json = """
        {"data": "hello", "timestamp": 1700000060000}
        """.data(using: .utf8)!
        XCTAssertNil(ServerMessage.parse(from: json))
    }

    func testParseReturnsNilForMalformedMessage() {
        // Correct type but missing required fields
        let json = """
        {"type": "auth_success"}
        """.data(using: .utf8)!
        XCTAssertNil(ServerMessage.parse(from: json))
    }
}

// MARK: - Client Message Encoding Tests

final class ClientMessageEncodingTests: XCTestCase {

    private let encoder = JSONEncoder()

    func testAuthMessageEncoding() throws {
        let message = AuthMessage(token: "jwt-token-here")
        let data = try encoder.encode(message)
        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]

        XCTAssertEqual(json["type"] as? String, "auth")
        XCTAssertEqual(json["token"] as? String, "jwt-token-here")
        XCTAssertEqual(json["protocolVersion"] as? String, "3.0")
        XCTAssertEqual(json["clientType"] as? String, "mobile")
    }

    func testSessionAttachMessageEncoding() throws {
        let message = SessionAttachMessage(sessionId: "sess-1")
        let data = try encoder.encode(message)
        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]

        XCTAssertEqual(json["type"] as? String, "session_attach")
        XCTAssertEqual(json["sessionId"] as? String, "sess-1")
    }

    func testSessionDetachMessageEncoding() throws {
        let message = SessionDetachMessage()
        let data = try encoder.encode(message)
        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]

        XCTAssertEqual(json["type"] as? String, "session_detach")
    }

    func testTerminalInputMessageEncoding() throws {
        let message = TerminalInputMessage(agentId: "agent-1", data: "ls -la\n")
        let data = try encoder.encode(message)
        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]

        XCTAssertEqual(json["type"] as? String, "terminal_input")
        XCTAssertEqual(json["agentId"] as? String, "agent-1")
        XCTAssertEqual(json["data"] as? String, "ls -la\n")
    }

    func testResizeMessageEncoding() throws {
        let message = ResizeMessage(agentId: "agent-1", cols: 120, rows: 40)
        let data = try encoder.encode(message)
        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]

        XCTAssertEqual(json["type"] as? String, "resize")
        XCTAssertEqual(json["agentId"] as? String, "agent-1")
        XCTAssertEqual(json["cols"] as? Int, 120)
        XCTAssertEqual(json["rows"] as? Int, 40)
    }

    func testControlRequestExclusiveEncoding() throws {
        let message = ControlRequestMessage(action: .exclusive)
        let data = try encoder.encode(message)
        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]

        XCTAssertEqual(json["type"] as? String, "control_request")
        XCTAssertEqual(json["action"] as? String, "exclusive")
    }

    func testControlRequestReleaseEncoding() throws {
        let message = ControlRequestMessage(action: .release)
        let data = try encoder.encode(message)
        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]

        XCTAssertEqual(json["type"] as? String, "control_request")
        XCTAssertEqual(json["action"] as? String, "release")
    }

    func testScrollbackRequestEncoding() throws {
        let message = ScrollbackRequestMessage(sessionId: "sess-1", fromLine: 50, count: 100)
        let data = try encoder.encode(message)
        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]

        XCTAssertEqual(json["type"] as? String, "scrollback_request")
        XCTAssertEqual(json["sessionId"] as? String, "sess-1")
        XCTAssertEqual(json["fromLine"] as? Int, 50)
        XCTAssertEqual(json["count"] as? Int, 100)
    }

    func testHeartbeatAckEncoding() throws {
        let message = HeartbeatAckMessage(timestamp: 1700000060000)
        let data = try encoder.encode(message)
        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]

        XCTAssertEqual(json["type"] as? String, "heartbeat_ack")
        XCTAssertEqual(json["timestamp"] as? Double, 1700000060000)
    }

    func testPingMessageEncoding() throws {
        let message = PingMessage()
        let data = try encoder.encode(message)
        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]

        XCTAssertEqual(json["type"] as? String, "ping")
    }
}

// MARK: - WSClient State Tests

@MainActor
final class WSClientStateTests: XCTestCase {

    func testInitialStateIsDisconnected() {
        let client = WSClient(tokenManager: TokenManager())
        XCTAssertEqual(client.connectionState, .disconnected)
        XCTAssertNil(client.clientId)
        XCTAssertNil(client.attachedSessionId)
        XCTAssertTrue(client.agents.isEmpty)
        XCTAssertTrue(client.sessions.isEmpty)
        XCTAssertNil(client.controlState)
    }

    func testDisconnectSetsStateToDisconnected() {
        let client = WSClient(tokenManager: TokenManager())
        client.disconnect()
        XCTAssertEqual(client.connectionState, .disconnected)
    }

    func testAutoReconnectDefaultsToTrue() {
        let client = WSClient(tokenManager: TokenManager())
        XCTAssertTrue(client.autoReconnect)
    }

    func testMaxReconnectAttemptsIsFive() {
        let client = WSClient(tokenManager: TokenManager())
        XCTAssertEqual(client.maxReconnectAttempts, 5)
    }
}

// MARK: - WSClient Reconnection Delay Tests

@MainActor
final class WSClientReconnectDelayTests: XCTestCase {

    func testReconnectDelayExponentialBackoff() {
        let client = WSClient(tokenManager: TokenManager())

        // Attempt 1: base delay (1.0) + jitter (0..0.5)
        let delay1 = client.reconnectDelay(attempt: 1)
        XCTAssertGreaterThanOrEqual(delay1, 1.0)
        XCTAssertLessThanOrEqual(delay1, 1.5)

        // Attempt 2: 2.0 + jitter
        let delay2 = client.reconnectDelay(attempt: 2)
        XCTAssertGreaterThanOrEqual(delay2, 2.0)
        XCTAssertLessThanOrEqual(delay2, 2.5)

        // Attempt 3: 4.0 + jitter
        let delay3 = client.reconnectDelay(attempt: 3)
        XCTAssertGreaterThanOrEqual(delay3, 4.0)
        XCTAssertLessThanOrEqual(delay3, 4.5)

        // Attempt 4: 8.0 + jitter
        let delay4 = client.reconnectDelay(attempt: 4)
        XCTAssertGreaterThanOrEqual(delay4, 8.0)
        XCTAssertLessThanOrEqual(delay4, 8.5)

        // Attempt 5: 16.0 + jitter
        let delay5 = client.reconnectDelay(attempt: 5)
        XCTAssertGreaterThanOrEqual(delay5, 16.0)
        XCTAssertLessThanOrEqual(delay5, 16.5)
    }

    func testReconnectDelayClampsToMax() {
        let client = WSClient(tokenManager: TokenManager())

        // Attempt 10: 2^9 = 512 would exceed max (30), so clamped to 30 + jitter
        let delay = client.reconnectDelay(attempt: 10)
        XCTAssertGreaterThanOrEqual(delay, 30.0)
        XCTAssertLessThanOrEqual(delay, 30.5)
    }
}

// MARK: - InputArbiter Tests

@MainActor
final class InputArbiterTests: XCTestCase {

    func testInitialStateIsIdle() {
        let client = WSClient(tokenManager: TokenManager())
        let arbiter = InputArbiter(wsClient: client)
        XCTAssertEqual(arbiter.state, .idle)
    }

    func testSendInputReturnsFalseWhenDisconnected() {
        let client = WSClient(tokenManager: TokenManager())
        let arbiter = InputArbiter(wsClient: client)
        XCTAssertFalse(arbiter.sendInput("ls", agentId: "agent-1"))
    }

    func testSendInputReturnsFalseWhenAgentWorking() {
        let client = WSClient(tokenManager: TokenManager())
        let arbiter = InputArbiter(wsClient: client)
        arbiter.handleAgentStatus("agent-1", status: .running)
        XCTAssertEqual(arbiter.state, .agentWorking)
        // Can't test sendInput returning false here because the client isn't connected,
        // but we can verify the state prevents it
    }

    func testHandleControlStatus() {
        let client = WSClient(tokenManager: TokenManager())
        let arbiter = InputArbiter(wsClient: client)

        let response = ControlStatusResponse(
            type: "control_status",
            sessionId: "sess-1",
            state: .pcActive,
            activeClient: "client-pc",
            exclusiveExpires: nil,
            lastPcActivity: 1700000000000,
            timestamp: 1700000000000
        )

        arbiter.handleControlStatus(response)
        XCTAssertEqual(arbiter.controlState, .pcActive)
    }

    func testHandleInputRejectedSetsState() {
        let client = WSClient(tokenManager: TokenManager())
        let arbiter = InputArbiter(wsClient: client)

        let response = InputRejectedResponse(
            type: "input_rejected",
            reason: .pcTyping,
            command: nil,
            timestamp: 1700000000000
        )

        arbiter.handleInputRejected(response)
        XCTAssertEqual(arbiter.state, .rejected(.pcTyping))
        XCTAssertEqual(arbiter.lastRejectionReason, .pcTyping)
    }

    func testHandleAgentStatusRunning() {
        let client = WSClient(tokenManager: TokenManager())
        let arbiter = InputArbiter(wsClient: client)

        arbiter.handleAgentStatus("agent-1", status: .running)
        XCTAssertEqual(arbiter.state, .agentWorking)
    }

    func testHandleAgentStatusIdleResetsFromWorking() {
        let client = WSClient(tokenManager: TokenManager())
        let arbiter = InputArbiter(wsClient: client)

        arbiter.handleAgentStatus("agent-1", status: .running)
        XCTAssertEqual(arbiter.state, .agentWorking)

        arbiter.handleAgentStatus("agent-1", status: .idle)
        XCTAssertEqual(arbiter.state, .idle)
    }

    func testHandleAgentStatusIdleDoesNotResetFromOtherStates() {
        let client = WSClient(tokenManager: TokenManager())
        let arbiter = InputArbiter(wsClient: client)

        arbiter.handleApprovalRequired(command: "dangerous-cmd")
        XCTAssertEqual(arbiter.state, .pendingApproval(command: "dangerous-cmd"))

        // Agent going idle shouldn't clear a pending approval
        arbiter.handleAgentStatus("agent-1", status: .idle)
        XCTAssertEqual(arbiter.state, .pendingApproval(command: "dangerous-cmd"))
    }

    func testApprovalFlow() {
        let client = WSClient(tokenManager: TokenManager())
        let arbiter = InputArbiter(wsClient: client)

        arbiter.handleApprovalRequired(command: "git push --force")
        XCTAssertEqual(arbiter.state, .pendingApproval(command: "git push --force"))

        arbiter.approveCommand()
        XCTAssertEqual(arbiter.state, .idle)
    }

    func testRejectCommandFlow() {
        let client = WSClient(tokenManager: TokenManager())
        let arbiter = InputArbiter(wsClient: client)

        arbiter.handleApprovalRequired(command: "rm -rf ./temp")
        arbiter.rejectCommand()
        XCTAssertEqual(arbiter.state, .idle)
    }

    func testApproveCommandDoesNothingWhenNotPending() {
        let client = WSClient(tokenManager: TokenManager())
        let arbiter = InputArbiter(wsClient: client)

        arbiter.approveCommand()
        XCTAssertEqual(arbiter.state, .idle) // Unchanged
    }

    func testRejectCommandDoesNothingWhenNotPending() {
        let client = WSClient(tokenManager: TokenManager())
        let arbiter = InputArbiter(wsClient: client)

        arbiter.handleAgentStatus("agent-1", status: .running)
        arbiter.rejectCommand()
        XCTAssertEqual(arbiter.state, .agentWorking) // Unchanged
    }

    func testSendInputReturnsFalseWhenPendingApproval() {
        let client = WSClient(tokenManager: TokenManager())
        let arbiter = InputArbiter(wsClient: client)

        arbiter.handleApprovalRequired(command: "dangerous")
        XCTAssertFalse(arbiter.sendInput("ls", agentId: "agent-1"))
    }
}

// MARK: - ServerMessage Equatable Tests

final class ServerMessageEquatableTests: XCTestCase {

    func testAuthSuccessEquality() {
        let a = AuthSuccessResponse(type: "auth_success", clientId: "c1", protocolVersion: "3.0", clientType: .mobile, userId: "u1", timestamp: 100)
        let b = AuthSuccessResponse(type: "auth_success", clientId: "c1", protocolVersion: "3.0", clientType: .mobile, userId: "u1", timestamp: 100)
        XCTAssertEqual(ServerMessage.authSuccess(a), ServerMessage.authSuccess(b))
    }

    func testDifferentMessageTypesNotEqual() {
        let auth = AuthSuccessResponse(type: "auth_success", clientId: "c1", protocolVersion: "3.0", clientType: .mobile, userId: "u1", timestamp: 100)
        let pong = PongResponse(type: "pong", timestamp: 100)
        XCTAssertNotEqual(ServerMessage.authSuccess(auth), ServerMessage.pong(pong))
    }

    func testAgentInfoEquality() {
        let a = AgentInfo(id: "a1", name: "Claude", preset: "claude", status: .running)
        let b = AgentInfo(id: "a1", name: "Claude", preset: "claude", status: .running)
        XCTAssertEqual(a, b)
    }

    func testSessionInfoEquality() {
        let a = SessionInfo(id: "s1", name: "Dev", state: .active, agentCount: 1, createdAt: 100, lastActivity: 200)
        let b = SessionInfo(id: "s1", name: "Dev", state: .active, agentCount: 1, createdAt: 100, lastActivity: 200)
        XCTAssertEqual(a, b)
    }
}
