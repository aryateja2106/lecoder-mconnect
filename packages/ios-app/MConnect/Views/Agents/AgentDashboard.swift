import SwiftUI

struct AgentDashboard: View {
    @StateObject private var viewModel = AgentDashboardViewModel()

    var body: some View {
        NavigationStack {
            List {
                if viewModel.agents.isEmpty {
                    ContentUnavailableView(
                        "No Agents",
                        systemImage: "cpu",
                        description: Text("Connect to a host to see running agents.")
                    )
                } else {
                    ForEach(viewModel.agents) { agent in
                        NavigationLink(value: agent) {
                            AgentRow(agent: agent)
                        }
                    }
                }
            }
            .navigationTitle("Agents")
            .navigationDestination(for: Agent.self) { agent in
                AgentDetailView(agent: agent)
            }
            .refreshable {
                await viewModel.refresh()
            }
        }
    }
}

struct AgentRow: View {
    let agent: Agent

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

            Text(agent.status.displayName)
                .font(.caption)
                .foregroundStyle(agent.status.color)
        }
        .padding(.vertical, 4)
    }
}

@MainActor
class AgentDashboardViewModel: ObservableObject {
    @Published var agents: [Agent] = []

    func refresh() async {
        // Will fetch agents via WebSocket
    }
}
