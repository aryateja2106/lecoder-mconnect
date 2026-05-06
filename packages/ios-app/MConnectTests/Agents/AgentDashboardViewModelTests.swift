import XCTest
@testable import MConnect

@MainActor
final class AgentDashboardViewModelTests: XCTestCase {

    // MARK: - Empty State

    func testInitialStateIsEmptyAndDisconnected() {
        let vm = AgentDashboardViewModel()
        XCTAssertTrue(vm.agents.isEmpty)
        XCTAssertTrue(vm.sessions.isEmpty)
        XCTAssertFalse(vm.isConnected)
        XCTAssertFalse(vm.isLoading)
    }

    // MARK: - Agent List

    func testReceivingAgentListPopulatesAgents() {
        let vm = AgentDashboardViewModel()
        let agents = [
            AgentInfo(id: "a1", name: "Shell Agent", preset: "shell", status: .running),
            AgentInfo(id: "a2", name: "Claude Agent", preset: "claude", status: .idle),
        ]
        vm.wsClient(vm.wsClient, didReceiveAgentList: agents)
        XCTAssertEqual(vm.agents.count, 2)
        XCTAssertEqual(vm.agents[0].name, "Shell Agent")
        XCTAssertEqual(vm.agents[1].preset, "claude")
    }

    func testReceivingAgentListSetsLoadingFalse() {
        let vm = AgentDashboardViewModel()
        vm.isLoading = true
        vm.wsClient(vm.wsClient, didReceiveAgentList: [])
        XCTAssertFalse(vm.isLoading)
    }

    // MARK: - Agent Status Update

    func testAgentStatusUpdateChangesStatus() {
        let vm = AgentDashboardViewModel()
        let agent = AgentInfo(id: "a1", name: "Agent", preset: "shell", status: .running)
        vm.wsClient(vm.wsClient, didReceiveAgentList: [agent])

        vm.wsClient(vm.wsClient, didReceiveAgentStatus: "a1", status: .stopped)

        XCTAssertEqual(vm.agents[0].status, .stopped)
    }

    func testAgentStatusUpdateForUnknownIdIsNoop() {
        let vm = AgentDashboardViewModel()
        let agent = AgentInfo(id: "a1", name: "Agent", preset: "shell", status: .running)
        vm.wsClient(vm.wsClient, didReceiveAgentList: [agent])

        vm.wsClient(vm.wsClient, didReceiveAgentStatus: "unknown", status: .stopped)

        XCTAssertEqual(vm.agents[0].status, .running)
    }

    // MARK: - Connection State

    func testConnectionStateChangesToConnected() {
        let vm = AgentDashboardViewModel()
        vm.wsClient(vm.wsClient, didChangeState: .connected)
        XCTAssertTrue(vm.isConnected)
    }

    func testConnectionStateChangesToDisconnected() {
        let vm = AgentDashboardViewModel()
        vm.isConnected = true
        vm.wsClient(vm.wsClient, didChangeState: .disconnected)
        XCTAssertFalse(vm.isConnected)
    }

    // MARK: - Session Grouping

    func testSingleSessionReturnsEmptySessionAgentsMap() {
        let vm = AgentDashboardViewModel()
        let sessions = [SessionInfo(id: "s1", name: "Main", state: .active, agentCount: 1, createdAt: 0, lastActivity: 0)]
        vm.wsClient(vm.wsClient, didReceiveSessionList: sessions)
        vm.wsClient(vm.wsClient, didReceiveAgentList: [
            AgentInfo(id: "a1", name: "Agent", preset: "shell", status: .running)
        ])
        // Single session → flat list (no grouping)
        XCTAssertTrue(vm.sessionAgents.isEmpty)
    }

    func testMultipleSessionsProducesGroupedAgents() {
        let vm = AgentDashboardViewModel()
        let sessions = [
            SessionInfo(id: "s1", name: "Session A", state: .active, agentCount: 1, createdAt: 0, lastActivity: 0),
            SessionInfo(id: "s2", name: "Session B", state: .active, agentCount: 1, createdAt: 0, lastActivity: 0),
        ]
        vm.wsClient(vm.wsClient, didReceiveSessionList: sessions)
        vm.wsClient(vm.wsClient, didReceiveAgentList: [
            AgentInfo(id: "a1", name: "Agent 1", preset: "shell", status: .running),
        ])
        // Two sessions → sessionAgents map is non-empty
        XCTAssertEqual(vm.sessionGroups.count, 2)
    }

    func testSessionGroupsUseFallbackLabelForUnknownSession() {
        let vm = AgentDashboardViewModel()
        let sessions = [
            SessionInfo(id: "session-long-id-here", name: nil, state: .active, agentCount: 0, createdAt: 0, lastActivity: 0),
            SessionInfo(id: "s2", name: "Named Session", state: .active, agentCount: 0, createdAt: 0, lastActivity: 0),
        ]
        vm.wsClient(vm.wsClient, didReceiveSessionList: sessions)
        vm.wsClient(vm.wsClient, didReceiveAgentList: [])
        let groups = vm.sessionGroups
        let unnamed = groups.first(where: { $0.sessionId == "session-long-id-here" })
        XCTAssertNotNil(unnamed)
        XCTAssertTrue(unnamed!.sessionLabel.hasPrefix("Session "))
    }

    // MARK: - Error Handling

    func testErrorResponseSetsLoadingFalse() {
        let vm = AgentDashboardViewModel()
        vm.isLoading = true
        let error = ErrorResponse(
            type: "error",
            message: "Internal error",
            code: .internalError,
            retryable: false,
            retryAfterMs: nil,
            timestamp: Date().timeIntervalSince1970
        )
        vm.wsClient(vm.wsClient, didReceiveError: error)
        XCTAssertFalse(vm.isLoading)
    }
}
