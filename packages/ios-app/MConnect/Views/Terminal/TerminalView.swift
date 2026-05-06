import SwiftUI
import os

// MARK: - TerminalView

struct TerminalView: View {
    @StateObject private var viewModel: TerminalViewModel

    /// Caller-injected FAB overlay. Typed as AnyView to avoid coupling.
    let fab: () -> AnyView

    private let logger = Logger(subsystem: "com.lecoder.mconnect", category: "TerminalView")
    private let signposter = OSSignposter(
        subsystem: "com.lecoder.mconnect",
        category: "TerminalView"
    )

    // Convenience init without FAB (defaults to empty overlay)
    init(host: Host, wsClient: WSClient, fab: @escaping () -> AnyView = { AnyView(EmptyView()) }) {
        _viewModel = StateObject(wrappedValue: TerminalViewModel(host: host, wsClient: wsClient))
        self.fab = fab
    }

    var body: some View {
        ZStack {
            // Terminal fills the content area; SwiftTermBridge (W2) handles keyboard via UITextInput
            TerminalEmulatorView(viewModel: viewModel, onTapped: {})

            // Input rejection banner
            if let rejection = viewModel.inputRejectionMessage {
                VStack {
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(.yellow)
                        Text(rejection)
                            .font(.caption)
                            .foregroundStyle(.yellow)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .frame(maxWidth: .infinity)
                    .background(Color.yellow.opacity(0.15))

                    Spacer()
                }
            }

            // Approval banner (guardrail)
            if case .pendingApproval(let command) = viewModel.inputState {
                VStack {
                    Spacer()
                    ApprovalBannerView(
                        command: command,
                        onApprove: viewModel.approveCommand,
                        onReject: viewModel.rejectCommand
                    )
                }
            }

            // FAB overlay injected by caller (e.g. modifier key bar from W1)
            fab()

            // Connection status overlay when not connected
            if viewModel.connectionState != .connected {
                ConnectionStatusOverlay(
                    state: viewModel.connectionState,
                    onReconnect: viewModel.connect
                )
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            InputHintBanner(hostId: viewModel.host.id)
                .onAppear { /* banner manages its own appear */ }
        }
        .toolbar {
            ToolbarItem(placement: .principal) {
                AgentPicker(agents: viewModel.agents, selected: $viewModel.activeAgent)
                    .overlay(noAgentHint, alignment: .bottom)
            }
            ToolbarItem(placement: .topBarTrailing) {
                ConnectionBadge(
                    state: viewModel.connectionState,
                    onReconnect: viewModel.connect,
                    onDisconnect: viewModel.disconnect
                )
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            let state = signposter.beginInterval("view.appear")
            viewModel.connect()
            signposter.endInterval("view.appear", state)
        }
        .onDisappear {
            let state = signposter.beginInterval("view.disappear")
            viewModel.disconnect()
            signposter.endInterval("view.disappear", state)
        }
    }

    /// Inline hint shown in agent picker area when connected but no agents available.
    @ViewBuilder
    private var noAgentHint: some View {
        if viewModel.agents.isEmpty && viewModel.connectionState == .connected {
            Text("Waiting for agent — start a session via `mconnect start` on the host")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .offset(y: 18)
        }
    }
}

// MARK: - AgentPicker

struct AgentPicker: View {
    let agents: [AgentInfo]
    @Binding var selected: AgentInfo?

    var body: some View {
        if agents.isEmpty {
            Text("No Agents")
                .font(.headline)
        } else {
            Menu {
                ForEach(agents) { agent in
                    Button(action: { selected = agent }) {
                        Label {
                            Text(agent.name)
                        } icon: {
                            if agent.id == selected?.id {
                                Image(systemName: "checkmark")
                            }
                        }
                    }
                }
            } label: {
                HStack(spacing: 4) {
                    if let sel = selected {
                        Circle()
                            .fill(sel.status.color)
                            .frame(width: 8, height: 8)
                    }
                    Text(selected?.name ?? "Select Agent")
                        .font(.headline)
                    Image(systemName: "chevron.down")
                        .font(.caption)
                }
            }
        }
    }
}

// MARK: - Approval Banner

struct ApprovalBannerView: View {
    let command: String
    let onApprove: () -> Void
    let onReject: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: "shield.lefthalf.filled")
                    .foregroundStyle(.orange)
                Text("Approval Required")
                    .font(.caption.bold())
                    .foregroundStyle(.orange)
                Spacer()
            }

            Text(command)
                .font(.system(.caption, design: .monospaced))
                .foregroundStyle(.primary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(8)
                .background(Color(.systemGray5))
                .cornerRadius(6)

            HStack(spacing: 12) {
                Button("Reject", role: .destructive, action: onReject)
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                Button("Approve", action: onApprove)
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
            }
        }
        .padding(12)
        .background(Color.orange.opacity(0.1))
    }
}

// MARK: - TerminalViewModel

@MainActor
class TerminalViewModel: ObservableObject {
    // MARK: - Published State

    @Published var agents: [AgentInfo] = []
    @Published var activeAgent: AgentInfo? {
        didSet {
            if activeAgent?.id != oldValue?.id {
                updateDisplayText()
            }
        }
    }
    @Published var connectionState: ConnectionState = .disconnected
    @Published var displayText: String = ""
    @Published var inputState: InputArbiter.InputState = .idle
    @Published var inputRejectionMessage: String?

    // MARK: - Dependencies

    let host: Host
    private let wsClient: WSClient
    private let inputArbiter: InputArbiter
    let terminalBuffer: TerminalBuffer
    private let logger = Logger(subsystem: "com.lecoder.mconnect", category: "TerminalViewModel")

    // MARK: - Private State

    private var rejectionDismissTask: Task<Void, Never>?

    /// Pending display update task for batching rapid output.
    private var displayUpdateTask: Task<Void, Never>?

    /// Interval for batching display updates (33ms = ~30fps).
    private let displayUpdateInterval: Duration = .milliseconds(33)

    // MARK: - Init

    init(host: Host, wsClient: WSClient) {
        self.host = host
        self.wsClient = wsClient
        self.inputArbiter = InputArbiter(wsClient: wsClient)
        self.terminalBuffer = TerminalBuffer()
    }

    // MARK: - Lifecycle

    func connect() {
        wsClient.delegate = self
        connectionState = wsClient.connectionState
        wsClient.connect(to: host)
    }

    func disconnect() {
        wsClient.delegate = nil
        wsClient.disconnect()
    }

    // MARK: - Input

    func sendInput(_ text: String) {
        guard let agent = activeAgent else {
            logger.warning("No active agent for input")
            return
        }

        let accepted = inputArbiter.sendInput(text, agentId: agent.id)
        if !accepted {
            logger.info("Input rejected locally by arbiter")
        }
    }

    func sendKey(_ key: String) {
        sendInput(key)
    }

    /// Send raw bytes from SwiftTerm's keyboard input to the active agent.
    func sendInputBytes(_ data: Data) {
        guard let text = String(data: data, encoding: .utf8) else { return }
        sendInput(text)
    }

    // MARK: - Approval

    func approveCommand() {
        inputArbiter.approveCommand()
        inputState = inputArbiter.state
    }

    func rejectCommand() {
        inputArbiter.rejectCommand()
        inputState = inputArbiter.state
    }

    // MARK: - Terminal Size

    func handleTerminalSizeChange(cols: Int, rows: Int) {
        guard let agent = activeAgent else { return }
        wsClient.sendResize(agentId: agent.id, cols: cols, rows: rows)
    }

    // MARK: - Private Helpers

    private func updateDisplayText() {
        guard let agentId = activeAgent?.id else {
            displayText = ""
            return
        }
        displayText = terminalBuffer.displayText(forAgent: agentId)
    }

    /// Schedule a batched display update. Multiple calls within the interval are coalesced.
    private func scheduleDisplayUpdate() {
        displayUpdateTask?.cancel()
        displayUpdateTask = Task {
            try? await Task.sleep(for: displayUpdateInterval)
            guard !Task.isCancelled else { return }
            updateDisplayText()
        }
    }

    private func showRejection(_ message: String) {
        inputRejectionMessage = message
        rejectionDismissTask?.cancel()
        rejectionDismissTask = Task {
            try? await Task.sleep(for: .seconds(3))
            guard !Task.isCancelled else { return }
            inputRejectionMessage = nil
        }
    }

    private func selectFirstAgentIfNeeded() {
        if activeAgent == nil, let first = agents.first {
            activeAgent = first
            updateDisplayText()
        }
    }
}

// MARK: - WSClientDelegate

extension TerminalViewModel: WSClientDelegate {
    func wsClient(_ client: WSClient, didChangeState state: ConnectionState) {
        connectionState = state
    }

    func wsClient(_ client: WSClient, didReceiveOutput data: String, fromAgent agentId: String) {
        terminalBuffer.append(data, forAgent: agentId)
        if agentId == activeAgent?.id {
            scheduleDisplayUpdate()
        }
    }

    func wsClient(_ client: WSClient, didReceiveAgentList agents: [AgentInfo]) {
        self.agents = agents
        selectFirstAgentIfNeeded()
    }

    func wsClient(_ client: WSClient, didReceiveAgentStatus agentId: String, status: AgentStatus) {
        inputArbiter.handleAgentStatus(agentId, status: status)
        inputState = inputArbiter.state

        // Update local agent list
        if let index = agents.firstIndex(where: { $0.id == agentId }) {
            let agent = agents[index]
            agents[index] = AgentInfo(id: agent.id, name: agent.name, preset: agent.preset, status: status)
        }

        // Update active agent status
        if activeAgent?.id == agentId {
            activeAgent = agents.first(where: { $0.id == agentId })
        }
    }

    func wsClient(_ client: WSClient, didReceiveControlStatus response: ControlStatusResponse) {
        inputArbiter.handleControlStatus(response)
        inputState = inputArbiter.state
    }

    func wsClient(_ client: WSClient, didReceiveInputRejection response: InputRejectedResponse) {
        inputArbiter.handleInputRejected(response)
        inputState = inputArbiter.state

        let message: String
        switch response.reason {
        case .pcTyping: message = "PC is currently typing"
        case .otherExclusive: message = "Another client has exclusive control"
        case .rateLimited: message = "Rate limited — slow down"
        case .readOnly: message = "Session is read-only"
        case .guardrailBlocked: message = "Command blocked: \(response.command ?? "unknown")"
        }
        showRejection(message)
    }

    func wsClient(_ client: WSClient, didReceiveScrollback response: ScrollbackResponse) {
        // Scrollback response lines map to the session, which maps to the active agent
        if let agentId = activeAgent?.id {
            terminalBuffer.prependScrollback(response.lines, forAgent: agentId)
            updateDisplayText()
        }
    }

    func wsClient(_ client: WSClient, didReceiveError response: ErrorResponse) {
        logger.error("Server error: [\(response.code.rawValue)] \(response.message)")
    }
}
