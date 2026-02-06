import SwiftUI

struct TerminalView: View {
    @StateObject private var viewModel: TerminalViewModel
    @State private var showKeyboard = false

    init(host: Host, wsClient: WSClient) {
        _viewModel = StateObject(wrappedValue: TerminalViewModel(host: host, wsClient: wsClient))
    }

    var body: some View {
        VStack(spacing: 0) {
            TerminalEmulatorView(viewModel: viewModel)
                .onTapGesture { showKeyboard.toggle() }

            if showKeyboard {
                KeyboardBarView(onKey: viewModel.sendKey)
            }
        }
        .toolbar {
            ToolbarItem(placement: .principal) {
                AgentPicker(agents: viewModel.agents, selected: $viewModel.activeAgent)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { viewModel.connect() }
        .onDisappear { viewModel.disconnect() }
    }
}

struct AgentPicker: View {
    let agents: [Agent]
    @Binding var selected: Agent?

    var body: some View {
        if agents.isEmpty {
            Text("No Agents")
                .font(.headline)
        } else {
            Menu {
                ForEach(agents) { agent in
                    Button(action: { selected = agent }) {
                        Label(agent.name, systemImage: agent.id == selected?.id ? "checkmark" : "cpu")
                    }
                }
            } label: {
                HStack {
                    Text(selected?.name ?? "Select Agent")
                        .font(.headline)
                    Image(systemName: "chevron.down")
                        .font(.caption)
                }
            }
        }
    }
}

@MainActor
class TerminalViewModel: ObservableObject {
    @Published var agents: [Agent] = []
    @Published var activeAgent: Agent?
    @Published var terminalOutput: String = ""

    private let host: Host
    private let wsClient: WSClient

    init(host: Host, wsClient: WSClient) {
        self.host = host
        self.wsClient = wsClient
    }

    func connect() {
        // Will be implemented with WebSocket integration
    }

    func disconnect() {
        // Will be implemented with WebSocket integration
    }

    func sendKey(_ key: String) {
        // Will be implemented with WebSocket integration
    }

    func sendInput(_ text: String) {
        // Will be implemented with WebSocket integration
    }
}
