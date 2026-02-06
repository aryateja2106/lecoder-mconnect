import SwiftUI
import os

struct AgentDetailView: View {
    let agent: Agent
    @StateObject private var viewModel: AgentDetailViewModel
    @EnvironmentObject private var router: Router

    init(agent: Agent, wsClient: WSClient? = nil) {
        self.agent = agent
        _viewModel = StateObject(wrappedValue: AgentDetailViewModel(agent: agent, wsClient: wsClient))
    }

    var body: some View {
        List {
            statusSection
            actionsSection
            outputSection
        }
        .navigationTitle(agent.name)
        .navigationBarTitleDisplayMode(.inline)
        .alert("Error", isPresented: $viewModel.showError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.errorMessage)
        }
    }

    // MARK: - Sections

    @ViewBuilder
    private var statusSection: some View {
        Section("Status") {
            LabeledContent("State") {
                AgentStatusBadge(status: viewModel.currentStatus)
            }

            LabeledContent("Preset", value: agent.preset)

            if let sessionId = agent.sessionId {
                LabeledContent("Session") {
                    Text(sessionId.prefix(12) + "...")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            LabeledContent("Created") {
                Text(agent.createdAt, style: .relative)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private var actionsSection: some View {
        Section("Actions") {
            Button {
                viewModel.openTerminal(router: router)
            } label: {
                Label("Open Terminal", systemImage: "terminal")
            }

            if viewModel.currentStatus.canStop {
                Button(role: .destructive) {
                    viewModel.stopAgent()
                } label: {
                    if viewModel.isStopLoading {
                        Label {
                            Text("Stopping...")
                        } icon: {
                            ProgressView()
                                .controlSize(.small)
                        }
                    } else {
                        Label("Stop Agent", systemImage: "stop.fill")
                    }
                }
                .disabled(viewModel.isStopLoading)
            }

            if viewModel.currentStatus.canStart {
                Button {
                    viewModel.startAgent()
                } label: {
                    if viewModel.isStartLoading {
                        Label {
                            Text("Starting...")
                        } icon: {
                            ProgressView()
                                .controlSize(.small)
                        }
                    } else {
                        Label("Start Agent", systemImage: "play.fill")
                    }
                }
                .disabled(viewModel.isStartLoading)
            }

            if viewModel.currentStatus == .error {
                Button {
                    viewModel.startAgent()
                } label: {
                    Label("Restart Agent", systemImage: "arrow.clockwise")
                }
            }
        }
    }

    @ViewBuilder
    private var outputSection: some View {
        if !viewModel.recentOutput.isEmpty {
            Section("Recent Output") {
                ScrollView(.horizontal, showsIndicators: false) {
                    Text(viewModel.recentOutput)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundColor(.secondary)
                        .textSelection(.enabled)
                }
                .frame(maxHeight: 200)
            }
        }
    }
}

// MARK: - ViewModel

@MainActor
class AgentDetailViewModel: ObservableObject {

    // MARK: - Published State

    @Published var recentOutput: String = ""
    @Published var currentStatus: AgentStatus
    @Published var isStartLoading = false
    @Published var isStopLoading = false
    @Published var showError = false
    var errorMessage = ""

    // MARK: - Dependencies

    private let agent: Agent
    private weak var wsClient: WSClient?
    private let logger = Logger(subsystem: "com.lecoder.mconnect", category: "AgentDetail")

    /// Maximum characters to keep in the recent output preview.
    private let maxOutputLength = 4096

    // MARK: - Init

    init(agent: Agent, wsClient: WSClient? = nil) {
        self.agent = agent
        self.currentStatus = agent.status
        self.wsClient = wsClient
    }

    // MARK: - Public API

    func openTerminal(router: Router) {
        // Navigate to the terminal for this agent's session.
        // Switch to the hosts tab where the terminal view is accessible.
        router.selectedTab = .hosts
    }

    func startAgent() {
        guard let wsClient else { return }
        isStartLoading = true
        wsClient.sendInput("", agentId: agent.id)
        logger.info("Requested start for agent \(self.agent.id)")

        Task {
            try? await Task.sleep(for: .seconds(5))
            isStartLoading = false
        }
    }

    func stopAgent() {
        guard let wsClient else { return }
        isStopLoading = true
        wsClient.sendInput("\u{03}", agentId: agent.id) // Ctrl+C
        logger.info("Requested stop for agent \(self.agent.id)")

        Task {
            try? await Task.sleep(for: .seconds(5))
            isStopLoading = false
        }
    }

    // MARK: - Private Helpers

    private func appendOutput(_ text: String) {
        recentOutput += text
        if recentOutput.count > maxOutputLength {
            let startIndex = recentOutput.index(recentOutput.endIndex, offsetBy: -maxOutputLength)
            recentOutput = String(recentOutput[startIndex...])
        }
    }

    // MARK: - WSClientDelegate Handling

    func handleOutput(_ data: String, fromAgent agentId: String) {
        guard agentId == agent.id else { return }
        appendOutput(data)
    }

    func handleAgentStatus(_ agentId: String, status: AgentStatus) {
        guard agentId == agent.id else { return }
        currentStatus = status
        isStartLoading = false
        isStopLoading = false
    }

    func handleError(_ response: ErrorResponse) {
        errorMessage = response.message
        showError = true
        isStartLoading = false
        isStopLoading = false
    }
}
