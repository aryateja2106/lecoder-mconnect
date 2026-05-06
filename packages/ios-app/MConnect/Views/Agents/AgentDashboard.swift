import SwiftUI
import os

struct AgentDashboard: View {
    @EnvironmentObject private var router: Router
    @StateObject private var viewModel = AgentDashboardViewModel()

    var body: some View {
        NavigationStack(path: $router.agentPath) {
            Group {
                if viewModel.isLoading && viewModel.agents.isEmpty {
                    loadingView
                } else if !viewModel.isConnected && viewModel.agents.isEmpty {
                    noHostEmptyState
                } else if viewModel.agents.isEmpty {
                    connectedButNoAgentsState
                } else {
                    agentList
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
        }
    }

    // MARK: - Empty States

    private var loadingView: some View {
        ProgressView("Loading agents...")
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// Shown when no host is connected at all.
    private var noHostEmptyState: some View {
        VStack(spacing: 20) {
            Image(systemName: "server.rack")
                .font(.system(size: 56))
                .foregroundStyle(.secondary)

            VStack(spacing: 8) {
                Text("No Connected Hosts")
                    .font(.title2.weight(.semibold))

                Text("Pair a host to see its running agents. Agents are shells on your host — each can run AI tools (Claude Code, Aider) or plain bash.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            Button {
                router.selectedTab = .hosts
            } label: {
                Label("Pair a Host", systemImage: "plus.circle")
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(.tint, in: Capsule())
                    .foregroundStyle(.white)
            }
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// Shown when connected but no agents have been started.
    private var connectedButNoAgentsState: some View {
        VStack(spacing: 20) {
            Image(systemName: "cpu")
                .font(.system(size: 56))
                .foregroundStyle(.secondary)

            VStack(spacing: 8) {
                Text("No Agents Running")
                    .font(.title2.weight(.semibold))

                Text("Your host is connected but no agents are active. Start an agent from your host to see it here.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Agent List

    private var agentList: some View {
        List {
            agentHelpBanner

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

    // MARK: - Inline Help Banner

    private var agentHelpBanner: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "info.circle.fill")
                .foregroundStyle(.tint)
                .padding(.top, 2)

            Text("Agents are shells running on your host. Each can run AI tools (Claude Code, Aider) or plain bash. Tap an agent to open its terminal.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 6)
        .listRowBackground(Color(.systemBlue).opacity(0.08))
    }

    // MARK: - Connection Badge

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

                HStack(spacing: 6) {
                    PresetBadge(preset: agent.preset)
                    Text(agent.status.displayName)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            AgentStatusBadge(status: agent.status)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - PresetBadge

struct PresetBadge: View {
    let preset: String

    private var icon: String {
        switch preset.lowercased() {
        case "claude", "claude-code": return "sparkles"
        case "aider": return "wand.and.stars"
        case "hermes": return "bolt"
        case "shell", "bash": return "terminal"
        default: return "terminal"
        }
    }

    private var color: Color {
        switch preset.lowercased() {
        case "claude", "claude-code": return .purple
        case "aider": return .blue
        case "hermes": return .orange
        default: return .gray
        }
    }

    var body: some View {
        Label(preset, systemImage: icon)
            .font(.caption2.weight(.medium))
            .foregroundStyle(color)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.12), in: Capsule())
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
    private let logger = Logger(subsystem: "com.lecoder.mconnect", category: "Agents")

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
        var map: [String: [AgentInfo]] = [:]
        for session in sessions {
            map[session.id] = agents.filter { _ in true }
        }
        return map
    }

    // MARK: - Init

    init(wsClient: WSClient) {
        self.wsClient = wsClient
        wsClient.delegate = self
        observeConnectionState()
    }

    convenience init() {
        self.init(wsClient: WSClient())
    }

    // MARK: - Public API

    func refresh() async {
        let signposter = OSSignposter(logger: logger)
        let state = signposter.beginInterval("agents.refresh")
        defer { signposter.endInterval("agents.refresh", state) }

        isLoading = true
        wsClient.ping()
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
        logger.info("Agents: received \(agents.count) agents")
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
        logger.error("Agents: server error [\(response.code.rawValue)] \(response.message)")
        isLoading = false
    }
}
