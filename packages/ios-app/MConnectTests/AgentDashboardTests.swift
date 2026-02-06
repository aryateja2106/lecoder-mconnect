import XCTest
@testable import MConnect

// MARK: - Agent Model Tests

final class AgentModelTests: XCTestCase {

    // MARK: - Initialization

    func testDefaultValues() {
        let agent = Agent(name: "Claude", preset: "claude")
        XCTAssertFalse(agent.id.isEmpty)
        XCTAssertEqual(agent.name, "Claude")
        XCTAssertEqual(agent.preset, "claude")
        XCTAssertEqual(agent.status, .creating)
        XCTAssertNil(agent.sessionId)
    }

    func testCustomValues() {
        let agent = Agent(
            id: "agent-1",
            name: "Shell",
            preset: "shell",
            status: .running,
            sessionId: "session-1",
            createdAt: Date(timeIntervalSince1970: 1700000000)
        )
        XCTAssertEqual(agent.id, "agent-1")
        XCTAssertEqual(agent.status, .running)
        XCTAssertEqual(agent.sessionId, "session-1")
    }

    func testInitFromAgentInfo() {
        let info = AgentInfo(id: "a1", name: "Claude", preset: "claude", status: .running)
        let agent = Agent(from: info, sessionId: "s1")
        XCTAssertEqual(agent.id, "a1")
        XCTAssertEqual(agent.name, "Claude")
        XCTAssertEqual(agent.preset, "claude")
        XCTAssertEqual(agent.status, .running)
        XCTAssertEqual(agent.sessionId, "s1")
    }

    func testInitFromAgentInfoNoSession() {
        let info = AgentInfo(id: "a1", name: "Shell", preset: "shell", status: .idle)
        let agent = Agent(from: info)
        XCTAssertNil(agent.sessionId)
    }

    // MARK: - Codable

    func testEncodeDecode() throws {
        let agent = Agent(id: "encode-1", name: "Test", preset: "test", status: .idle, sessionId: "s1")
        let data = try JSONEncoder().encode(agent)
        let decoded = try JSONDecoder().decode(Agent.self, from: data)

        XCTAssertEqual(decoded.id, agent.id)
        XCTAssertEqual(decoded.name, agent.name)
        XCTAssertEqual(decoded.preset, agent.preset)
        XCTAssertEqual(decoded.status, agent.status)
        XCTAssertEqual(decoded.sessionId, agent.sessionId)
    }

    // MARK: - Hashable

    func testHashableConformance() {
        let agent = Agent(id: "hash-1", name: "A", preset: "claude")
        var set = Set<Agent>()
        set.insert(agent)
        XCTAssertTrue(set.contains(agent))
    }

    // MARK: - AgentStatus Extensions

    func testStatusDisplayName() {
        XCTAssertEqual(AgentStatus.creating.displayName, "Creating")
        XCTAssertEqual(AgentStatus.running.displayName, "Running")
        XCTAssertEqual(AgentStatus.idle.displayName, "Idle")
        XCTAssertEqual(AgentStatus.stopped.displayName, "Stopped")
        XCTAssertEqual(AgentStatus.error.displayName, "Error")
    }

    func testStatusIconName() {
        XCTAssertEqual(AgentStatus.creating.iconName, "circle.dashed")
        XCTAssertEqual(AgentStatus.running.iconName, "circle.fill")
        XCTAssertEqual(AgentStatus.idle.iconName, "circle")
        XCTAssertEqual(AgentStatus.stopped.iconName, "stop.circle")
        XCTAssertEqual(AgentStatus.error.iconName, "exclamationmark.circle")
    }

    func testStatusCanStart() {
        XCTAssertFalse(AgentStatus.creating.canStart)
        XCTAssertFalse(AgentStatus.running.canStart)
        XCTAssertFalse(AgentStatus.idle.canStart)
        XCTAssertTrue(AgentStatus.stopped.canStart)
        XCTAssertTrue(AgentStatus.error.canStart)
    }

    func testStatusCanStop() {
        XCTAssertTrue(AgentStatus.creating.canStop)
        XCTAssertTrue(AgentStatus.running.canStop)
        XCTAssertTrue(AgentStatus.idle.canStop)
        XCTAssertFalse(AgentStatus.stopped.canStop)
        XCTAssertFalse(AgentStatus.error.canStop)
    }
}

// MARK: - Session Model Tests

final class SessionModelTests: XCTestCase {

    func testDefaultValues() {
        let session = Session(hostId: "h1", userId: "u1")
        XCTAssertFalse(session.id.isEmpty)
        XCTAssertEqual(session.hostId, "h1")
        XCTAssertEqual(session.userId, "u1")
        XCTAssertEqual(session.status, .active)
        XCTAssertEqual(session.agentCount, 0)
    }

    func testInitFromSessionInfo() {
        let info = SessionInfo(
            id: "s1",
            name: "Test Session",
            state: .active,
            agentCount: 3,
            createdAt: 1700000000,
            lastActivity: 1700001000
        )
        let session = Session(from: info, hostId: "h1", userId: "u1")
        XCTAssertEqual(session.id, "s1")
        XCTAssertEqual(session.hostId, "h1")
        XCTAssertEqual(session.status, .active)
        XCTAssertEqual(session.agentCount, 3)
    }

    func testEncodeDecode() throws {
        let session = Session(id: "s1", hostId: "h1", userId: "u1", status: .idle, agentCount: 2)
        let data = try JSONEncoder().encode(session)
        let decoded = try JSONDecoder().decode(Session.self, from: data)

        XCTAssertEqual(decoded.id, session.id)
        XCTAssertEqual(decoded.hostId, session.hostId)
        XCTAssertEqual(decoded.status, session.status)
        XCTAssertEqual(decoded.agentCount, session.agentCount)
    }

    // MARK: - SessionState Extensions

    func testSessionStateDisplayName() {
        XCTAssertEqual(SessionState.active.displayName, "Active")
        XCTAssertEqual(SessionState.idle.displayName, "Idle")
        XCTAssertEqual(SessionState.terminated.displayName, "Terminated")
    }

    func testSessionStateIconName() {
        XCTAssertEqual(SessionState.active.iconName, "circle.fill")
        XCTAssertEqual(SessionState.idle.iconName, "circle")
        XCTAssertEqual(SessionState.terminated.iconName, "xmark.circle")
    }
}

// MARK: - AgentDashboardViewModel Tests

@MainActor
final class AgentDashboardViewModelTests: XCTestCase {

    private func makeViewModel() -> AgentDashboardViewModel {
        let client = WSClient(tokenManager: TokenManager())
        return AgentDashboardViewModel(wsClient: client)
    }

    // MARK: - Initial State

    func testInitialState() {
        let vm = makeViewModel()
        XCTAssertTrue(vm.agents.isEmpty)
        XCTAssertTrue(vm.sessions.isEmpty)
        XCTAssertFalse(vm.isLoading)
        XCTAssertFalse(vm.isConnected)
    }

    // MARK: - Agent List Updates

    func testDidReceiveAgentList() {
        let vm = makeViewModel()
        let agents = [
            AgentInfo(id: "a1", name: "Claude", preset: "claude", status: .running),
            AgentInfo(id: "a2", name: "Shell", preset: "shell", status: .idle),
        ]

        vm.wsClient(vm.wsClient, didReceiveAgentList: agents)

        XCTAssertEqual(vm.agents.count, 2)
        XCTAssertEqual(vm.agents[0].id, "a1")
        XCTAssertEqual(vm.agents[1].id, "a2")
    }

    func testDidReceiveEmptyAgentList() {
        let vm = makeViewModel()
        vm.wsClient(vm.wsClient, didReceiveAgentList: [])
        XCTAssertTrue(vm.agents.isEmpty)
    }

    func testAgentListClearsLoadingState() {
        let vm = makeViewModel()
        vm.isLoading = true

        vm.wsClient(vm.wsClient, didReceiveAgentList: [
            AgentInfo(id: "a1", name: "Claude", preset: "claude", status: .running),
        ])

        XCTAssertFalse(vm.isLoading)
    }

    // MARK: - Agent Status Updates

    func testDidReceiveAgentStatusUpdate() {
        let vm = makeViewModel()
        let agents = [
            AgentInfo(id: "a1", name: "Claude", preset: "claude", status: .running),
        ]
        vm.wsClient(vm.wsClient, didReceiveAgentList: agents)

        vm.wsClient(vm.wsClient, didReceiveAgentStatus: "a1", status: .idle)

        XCTAssertEqual(vm.agents[0].status, .idle)
        XCTAssertEqual(vm.agents[0].name, "Claude") // Name preserved
        XCTAssertEqual(vm.agents[0].preset, "claude") // Preset preserved
    }

    func testStatusUpdateForUnknownAgentIgnored() {
        let vm = makeViewModel()
        let agents = [
            AgentInfo(id: "a1", name: "Claude", preset: "claude", status: .running),
        ]
        vm.wsClient(vm.wsClient, didReceiveAgentList: agents)

        vm.wsClient(vm.wsClient, didReceiveAgentStatus: "unknown", status: .error)

        XCTAssertEqual(vm.agents.count, 1)
        XCTAssertEqual(vm.agents[0].status, .running)
    }

    // MARK: - Session Updates

    func testDidReceiveSessionList() {
        let vm = makeViewModel()
        let sessions = [
            SessionInfo(id: "s1", name: "Dev", state: .active, agentCount: 2, createdAt: 1700000000, lastActivity: 1700001000),
        ]

        vm.wsClient(vm.wsClient, didReceiveSessionList: sessions)

        XCTAssertEqual(vm.sessions.count, 1)
        XCTAssertEqual(vm.sessions[0].id, "s1")
    }

    // MARK: - Connection State

    func testConnectionStateTracking() {
        let vm = makeViewModel()

        vm.wsClient(vm.wsClient, didChangeState: .connected)
        XCTAssertTrue(vm.isConnected)

        vm.wsClient(vm.wsClient, didChangeState: .disconnected)
        XCTAssertFalse(vm.isConnected)
    }

    func testReconnectingIsNotConnected() {
        let vm = makeViewModel()
        vm.wsClient(vm.wsClient, didChangeState: .reconnecting(attempt: 1))
        XCTAssertFalse(vm.isConnected)
    }

    // MARK: - Error Handling

    func testErrorClearsLoadingState() {
        let vm = makeViewModel()
        vm.isLoading = true

        let error = ErrorResponse(
            type: "error",
            message: "Internal error",
            code: .internalError,
            retryable: false,
            retryAfterMs: nil,
            timestamp: 1700000000
        )

        vm.wsClient(vm.wsClient, didReceiveError: error)
        XCTAssertFalse(vm.isLoading)
    }

    // MARK: - Session Grouping

    func testSessionGroupsEmptyWithSingleSession() {
        let vm = makeViewModel()
        vm.wsClient(vm.wsClient, didReceiveSessionList: [
            SessionInfo(id: "s1", name: "Dev", state: .active, agentCount: 2, createdAt: 1700000000, lastActivity: 1700001000),
        ])
        vm.wsClient(vm.wsClient, didReceiveAgentList: [
            AgentInfo(id: "a1", name: "Claude", preset: "claude", status: .running),
        ])

        // With only one session, grouping should be empty (flat list used)
        XCTAssertTrue(vm.sessionAgents.isEmpty)
    }

    func testMultipleAgentStatusUpdates() {
        let vm = makeViewModel()
        vm.wsClient(vm.wsClient, didReceiveAgentList: [
            AgentInfo(id: "a1", name: "Claude", preset: "claude", status: .running),
            AgentInfo(id: "a2", name: "Shell", preset: "shell", status: .idle),
            AgentInfo(id: "a3", name: "Python", preset: "python", status: .creating),
        ])

        // Update multiple statuses
        vm.wsClient(vm.wsClient, didReceiveAgentStatus: "a1", status: .idle)
        vm.wsClient(vm.wsClient, didReceiveAgentStatus: "a3", status: .running)

        XCTAssertEqual(vm.agents[0].status, .idle)
        XCTAssertEqual(vm.agents[1].status, .idle) // Unchanged
        XCTAssertEqual(vm.agents[2].status, .running)
    }
}

// MARK: - AgentDetailViewModel Tests

@MainActor
final class AgentDetailViewModelTests: XCTestCase {

    private func makeAgent(status: AgentStatus = .running) -> Agent {
        Agent(id: "a1", name: "Claude", preset: "claude", status: status, sessionId: "s1")
    }

    // MARK: - Initial State

    func testInitialState() {
        let vm = AgentDetailViewModel(agent: makeAgent())
        XCTAssertEqual(vm.currentStatus, .running)
        XCTAssertTrue(vm.recentOutput.isEmpty)
        XCTAssertFalse(vm.isStartLoading)
        XCTAssertFalse(vm.isStopLoading)
        XCTAssertFalse(vm.showError)
    }

    func testInitialStatusMatchesAgent() {
        let stoppedAgent = makeAgent(status: .stopped)
        let vm = AgentDetailViewModel(agent: stoppedAgent)
        XCTAssertEqual(vm.currentStatus, .stopped)
    }

    // MARK: - Output Handling

    func testHandleOutputAppendsText() {
        let vm = AgentDetailViewModel(agent: makeAgent())
        vm.handleOutput("Hello\n", fromAgent: "a1")
        XCTAssertEqual(vm.recentOutput, "Hello\n")
    }

    func testHandleOutputIgnoresDifferentAgent() {
        let vm = AgentDetailViewModel(agent: makeAgent())
        vm.handleOutput("From other agent\n", fromAgent: "a2")
        XCTAssertTrue(vm.recentOutput.isEmpty)
    }

    func testHandleOutputMultipleAppends() {
        let vm = AgentDetailViewModel(agent: makeAgent())
        vm.handleOutput("Line 1\n", fromAgent: "a1")
        vm.handleOutput("Line 2\n", fromAgent: "a1")
        XCTAssertTrue(vm.recentOutput.contains("Line 1"))
        XCTAssertTrue(vm.recentOutput.contains("Line 2"))
    }

    func testHandleOutputTruncatesLongOutput() {
        let vm = AgentDetailViewModel(agent: makeAgent())
        // Append more than 4096 characters
        let longLine = String(repeating: "X", count: 5000) + "\n"
        vm.handleOutput(longLine, fromAgent: "a1")
        XCTAssertLessThanOrEqual(vm.recentOutput.count, 4096)
    }

    // MARK: - Status Updates

    func testHandleAgentStatus() {
        let vm = AgentDetailViewModel(agent: makeAgent())
        vm.handleAgentStatus("a1", status: .idle)
        XCTAssertEqual(vm.currentStatus, .idle)
    }

    func testHandleAgentStatusIgnoresDifferentAgent() {
        let vm = AgentDetailViewModel(agent: makeAgent())
        vm.handleAgentStatus("other", status: .error)
        XCTAssertEqual(vm.currentStatus, .running) // Unchanged
    }

    func testHandleAgentStatusResetsLoadingFlags() {
        let vm = AgentDetailViewModel(agent: makeAgent())
        vm.isStartLoading = true
        vm.isStopLoading = true

        vm.handleAgentStatus("a1", status: .running)

        XCTAssertFalse(vm.isStartLoading)
        XCTAssertFalse(vm.isStopLoading)
    }

    // MARK: - Error Handling

    func testHandleErrorShowsAlert() {
        let vm = AgentDetailViewModel(agent: makeAgent())
        let error = ErrorResponse(
            type: "error",
            message: "Something went wrong",
            code: .internalError,
            retryable: false,
            retryAfterMs: nil,
            timestamp: 1700000000
        )

        vm.handleError(error)

        XCTAssertTrue(vm.showError)
        XCTAssertEqual(vm.errorMessage, "Something went wrong")
    }

    func testHandleErrorResetsLoadingFlags() {
        let vm = AgentDetailViewModel(agent: makeAgent())
        vm.isStartLoading = true
        vm.isStopLoading = true

        let error = ErrorResponse(
            type: "error",
            message: "Fail",
            code: .internalError,
            retryable: false,
            retryAfterMs: nil,
            timestamp: 1700000000
        )

        vm.handleError(error)

        XCTAssertFalse(vm.isStartLoading)
        XCTAssertFalse(vm.isStopLoading)
    }

    // MARK: - Start/Stop with WSClient

    func testStopAgentSetsLoadingFlag() {
        let client = WSClient(tokenManager: TokenManager())
        let vm = AgentDetailViewModel(agent: makeAgent(), wsClient: client)
        vm.stopAgent()
        XCTAssertTrue(vm.isStopLoading)
    }

    func testStartAgentSetsLoadingFlag() {
        let client = WSClient(tokenManager: TokenManager())
        let stoppedAgent = makeAgent(status: .stopped)
        let vm = AgentDetailViewModel(agent: stoppedAgent, wsClient: client)
        vm.startAgent()
        XCTAssertTrue(vm.isStartLoading)
    }

    func testStartAgentWithoutClientDoesNothing() {
        let vm = AgentDetailViewModel(agent: makeAgent(status: .stopped), wsClient: nil)
        vm.startAgent()
        XCTAssertFalse(vm.isStartLoading)
    }

    func testStopAgentWithoutClientDoesNothing() {
        let vm = AgentDetailViewModel(agent: makeAgent(), wsClient: nil)
        vm.stopAgent()
        XCTAssertFalse(vm.isStopLoading)
    }

    // MARK: - Navigation

    func testOpenTerminalSwitchesTab() {
        let router = Router()
        router.selectedTab = .agents

        let vm = AgentDetailViewModel(agent: makeAgent())
        vm.openTerminal(router: router)

        XCTAssertEqual(router.selectedTab, .hosts)
    }
}
