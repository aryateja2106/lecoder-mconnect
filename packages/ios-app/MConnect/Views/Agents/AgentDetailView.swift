import SwiftUI

struct AgentDetailView: View {
    let agent: Agent
    @StateObject private var viewModel: AgentDetailViewModel

    init(agent: Agent) {
        self.agent = agent
        _viewModel = StateObject(wrappedValue: AgentDetailViewModel(agent: agent))
    }

    var body: some View {
        List {
            Section("Status") {
                LabeledContent("State") {
                    HStack {
                        Circle()
                            .fill(agent.status.color)
                            .frame(width: 8, height: 8)
                        Text(agent.status.displayName)
                    }
                }
                LabeledContent("Preset", value: agent.preset)
                if let sessionId = agent.sessionId {
                    LabeledContent("Session", value: sessionId)
                }
            }

            Section("Actions") {
                Button("Open Terminal", systemImage: "terminal") {
                    viewModel.openTerminal()
                }

                if agent.status == .running {
                    Button("Stop Agent", systemImage: "stop.fill", role: .destructive) {
                        viewModel.stopAgent()
                    }
                } else if agent.status == .stopped {
                    Button("Start Agent", systemImage: "play.fill") {
                        viewModel.startAgent()
                    }
                }
            }

            if !viewModel.recentOutput.isEmpty {
                Section("Recent Output") {
                    Text(viewModel.recentOutput)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundColor(.secondary)
                }
            }
        }
        .navigationTitle(agent.name)
        .navigationBarTitleDisplayMode(.inline)
    }
}

@MainActor
class AgentDetailViewModel: ObservableObject {
    @Published var recentOutput: String = ""

    private let agent: Agent

    init(agent: Agent) {
        self.agent = agent
    }

    func openTerminal() {
        // Will navigate to terminal view for this agent
    }

    func startAgent() {
        // Will send start command via WebSocket
    }

    func stopAgent() {
        // Will send stop command via WebSocket
    }
}
