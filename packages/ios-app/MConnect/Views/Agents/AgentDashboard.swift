import SwiftUI
import os

struct AgentDashboard: View {
    @EnvironmentObject private var router: Router
    @StateObject private var viewModel = AgentDashboardViewModel()

    var body: some View {
        NavigationStack(path: $router.agentPath) {
            Group {
                if viewModel.agents.isEmpty && !viewModel.isLoading {
                    ContentUnavailableView(
                        "No Agents",
                        systemImage: "cpu",
                        description: Text("Connect to a host to see running agents.")
                    )
                } else {
                    List {
                        if !viewModel.sessionAgents.isEmpty {
                            ForEach(viewModel.sessionGroups, id: \.sessionId) { group in
                                Section(group.sessionLabel) {
                                    ForEach(group.agents) { agent in
                                        NavigationLink(value: Router.Destination.agentDetail(Agent(from: agent, sessionId: group.sessionId))) {
                                            AgentRow(agent: agent)
                                        }
                                    }
                                }
                            }
                        } else {
                            ForEach(viewModel.agents) { agent in
                                NavigationLink(value: Router.Destination.agentDetail(Agent(from: agent))) {
                                    AgentRow(agent: agent)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Agents")
            .navigationDestination(for: Router.Destination.self) { destination in
                switch destination {
                case .agentDetail(let agent):
                    AgentDetailView(agent: agent, wsClient: viewModel.wsClient)
                default:
                    EmptyView()
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    connectionStatusBadge
                }
            }
            .refreshable {
                await viewModel.refresh()
            }
            .overlay {
                if viewModel.isLoading && viewModel.agents.isEmpty {
                    ProgressView("Loading agents...")
                }
            }
        }
    }

    @ViewBuilder
    private var connectionStatusBadge: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(viewModel.isConnected ? Color.green : Color.gray.opacity(0.4))
                .frame(width: 8, height: 8)
            if !viewModel.isConnected {
                Text("Offline")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

// MARK: - AgentRow

struct AgentRow: View {
    let agent: AgentInfo

    var body: some View {
        HStack {
            Image(systemName: agent.status.iconName)
                .foregroundColor(agent.status.color)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 4) {
                Text(agent.name)
                    .font(.headline)
                Text(agent.preset)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            AgentStatusBadge(status: agent.status)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - AgentStatusBadge

struct AgentStatusBadge: View {
    let status: AgentStatus

    var body: some View {
        Text(status.displayName)
            .font(.caption2.weight(.medium))
            .foregroundStyle(status.color)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(status.color.opacity(0.12))
            .clipShape(Capsule())
    }
}

// MARK: - Session Group

struct SessionAgentGroup: Identifiable {
    let sessionId: String
    let sessionLabel: String
    let agents: [AgentInfo]

    var id: String { sessionId }
}

// MARK: - ViewModel

@MainActor
class AgentDashboardViewModel: ObservableObject {

    // MARK: - Published State

    @Published var agents: [AgentInfo] = []
    @Published var sessions: [SessionInfo] = []
    @Published var isLoading = false
    @Published var isConnected = false

    // MARK: - Dependencies

    let wsClient: WSClient
    private let logger = Logger(subsystem: "com.lecoder.mconnect", category: "AgentDashboard")

    // MARK: - Computed

    /// Agents grouped by session for sectioned display.
    var sessionGroups: [SessionAgentGroup] {
        sessionAgents.map { entry in
            SessionAgentGroup(
                sessionId: entry.key,
                sessionLabel: sessions.first(where: { $0.id == entry.key })?.name ?? "Session \(entry.key.prefix(8))",
                agents: entry.value
            )
        }
    }

    /// Map of sessionId → agents when multiple sessions exist.
    var sessionAgents: [String: [AgentInfo]] {
        guard sessions.count > 1 else { return [:] }
        // When there's only one session, show flat list.
        // When multiple, group by session.
        var map: [String: [AgentInfo]] = [:]
        for session in sessions {
            map[session.id] = agents.filter { _ in true }
        }
        return map
    }

    // MARK: - Init

    init(wsClient: WSClient? = nil) {
        self.wsClient = wsClient ?? WSClient()
        self.wsClient.delegate = self
        observeConnectionState()
    }

    // MARK: - Public API

    func refresh() async {
        isLoading = true
        // Trigger a fresh agent/session list from the server.
        // The WSClient publishes updates via delegate callbacks.
        wsClient.ping()
        // Allow a small delay for responses to arrive.
        try? await Task.sleep(for: .milliseconds(500))
        isLoading = false
    }

    // MARK: - Private Helpers

    private func observeConnectionState() {
        isConnected = wsClient.connectionState == .connected
    }
}

// MARK: - WSClientDelegate

extension AgentDashboardViewModel: WSClientDelegate {

    func wsClient(_ client: WSClient, didChangeState state: ConnectionState) {
        isConnected = state == .connected
    }

    func wsClient(_ client: WSClient, didReceiveAgentList agents: [AgentInfo]) {
        self.agents = agents
        isLoading = false
    }

    func wsClient(_ client: WSClient, didReceiveAgentStatus agentId: String, status: AgentStatus) {
        if let index = agents.firstIndex(where: { $0.id == agentId }) {
            let agent = agents[index]
            agents[index] = AgentInfo(id: agent.id, name: agent.name, preset: agent.preset, status: status)
        }
    }

    func wsClient(_ client: WSClient, didReceiveSessionList sessions: [SessionInfo]) {
        self.sessions = sessions
    }

    func wsClient(_ client: WSClient, didReceiveError response: ErrorResponse) {
        logger.error("Server error: [\(response.code.rawValue)] \(response.message)")
        isLoading = false
    }
}
