import SwiftUI
import os

struct TerminalView: View {
    @StateObject private var viewModel: TerminalViewModel
    @State private var showKeyboard = false
    @State private var inputText = ""
    @FocusState private var inputFocused: Bool

    init(host: Host, wsClient: WSClient) {
        _viewModel = StateObject(wrappedValue: TerminalViewModel(host: host, wsClient: wsClient))
    }

    var body: some View {
        ZStack {
            VStack(spacing: 0) {
                // Terminal emulator area
                TerminalEmulatorView(viewModel: viewModel, onTapped: {
                    showKeyboard.toggle()
                    if showKeyboard { inputFocused = true }
                })

                // Input rejection banner
                if let rejection = viewModel.inputRejectionMessage {
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.yellow)
                        Text(rejection)
                            .font(.caption)
                            .foregroundColor(.yellow)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .frame(maxWidth: .infinity)
                    .background(Color.yellow.opacity(0.15))
                }

                // Approval banner (guardrail)
                if case .pendingApproval(let command) = viewModel.inputState {
                    ApprovalBannerView(
                        command: command,
                        onApprove: viewModel.approveCommand,
                        onReject: viewModel.rejectCommand
                    )
                }

                // Command input bar
                if showKeyboard {
                    VStack(spacing: 0) {
                        KeyboardBarView(onKey: viewModel.sendKey)

                        HStack(spacing: 8) {
                            TextField("Command...", text: $inputText)
                                .font(.system(.body, design: .monospaced))
                                .textFieldStyle(.plain)
                                .autocorrectionDisabled()
                                .textInputAutocapitalization(.never)
                                .focused($inputFocused)
                                .onSubmit { submitInput() }

                            Button(action: submitInput) {
                                Image(systemName: "return")
                                    .font(.body.weight(.semibold))
                            }
                            .disabled(inputText.isEmpty)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(Color(.systemGray6))
                    }
                }
            }

            // Connection status overlay
            if viewModel.connectionState != .connected {
                ConnectionStatusOverlay(state: viewModel.connectionState)
            }
        }
        .toolbar {
            ToolbarItem(placement: .principal) {
                AgentPicker(agents: viewModel.agents, selected: $viewModel.activeAgent)
            }
            ToolbarItem(placement: .topBarTrailing) {
                connectionStatusIcon
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { viewModel.connect() }
        .onDisappear { viewModel.disconnect() }
    }

    private func submitInput() {
        guard !inputText.isEmpty else { return }
        viewModel.sendInput(inputText + "\n")
        inputText = ""
    }

    @ViewBuilder
    private var connectionStatusIcon: some View {
        // Small colored circle showing connection state
        Circle()
            .fill(connectionColor)
            .frame(width: 8, height: 8)
    }

    private var connectionColor: Color {
        switch viewModel.connectionState {
        case .connected: return .green
        case .connecting, .authenticating: return .yellow
        case .reconnecting: return .orange
        case .waitingForNetwork: return .orange
        case .disconnected: return .red
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

// MARK: - Connection Status Overlay

struct ConnectionStatusOverlay: View {
    let state: ConnectionState

    var body: some View {
        VStack(spacing: 12) {
            if state == .waitingForNetwork {
                Image(systemName: "wifi.slash")
                    .font(.title2)
                    .foregroundColor(.white)
            } else {
                ProgressView()
                    .tint(.white)
            }

            Text(statusText)
                .font(.subheadline)
                .foregroundColor(.white)

            if let subtitle = statusSubtitle {
                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.7))
            }
        }
        .padding(24)
        .background(.ultraThinMaterial.opacity(0.9))
        .background(Color.black.opacity(0.5))
        .cornerRadius(16)
    }

    private var statusText: String {
        switch state {
        case .disconnected: return "Disconnected"
        case .connecting: return "Connecting..."
        case .authenticating: return "Authenticating..."
        case .connected: return "Connected"
        case .reconnecting(let attempt): return "Reconnecting (\(attempt))..."
        case .waitingForNetwork: return "No Network"
        }
    }

    private var statusSubtitle: String? {
        switch state {
        case .waitingForNetwork:
            return "Will reconnect when network is available"
        case .reconnecting:
            return "Session will be restored automatically"
        default:
            return nil
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
                    .foregroundColor(.orange)
                Text("Approval Required")
                    .font(.caption.bold())
                    .foregroundColor(.orange)
                Spacer()
            }

            Text(command)
                .font(.system(.caption, design: .monospaced))
                .foregroundColor(.primary)
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

    private let host: Host
    private let wsClient: WSClient
    private let inputArbiter: InputArbiter
    let terminalBuffer: TerminalBuffer
    private let logger = Logger(subsystem: "com.lecoder.mconnect", category: "TerminalViewModel")

    // MARK: - Private State

    private var rejectionDismissTask: Task<Void, Never>?

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
            updateDisplayText()
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
