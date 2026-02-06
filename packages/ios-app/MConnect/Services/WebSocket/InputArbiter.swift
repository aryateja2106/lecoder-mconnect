import Foundation

/// Client-side input arbitration to prevent conflicting input from multiple sources.
///
/// Works with WSClient to track control state from the server and gate local input
/// through the appropriate checks before sending.
@MainActor
class InputArbiter: ObservableObject {
    enum InputState: Equatable {
        case idle
        case userTyping
        case agentWorking
        case pendingApproval(command: String)
        case rejected(InputRejectionReason)
    }

    @Published var state: InputState = .idle
    @Published var controlState: ControlState = .pcDisconnected
    @Published var lastRejectionReason: InputRejectionReason?

    private let wsClient: WSClient

    init(wsClient: WSClient) {
        self.wsClient = wsClient
    }

    /// Attempt to send input to an agent. Returns `true` if the input was accepted locally.
    ///
    /// The server may still reject the input (e.g. due to PC typing or guardrails),
    /// which will be reported via ``handleInputRejected(_:)``.
    func sendInput(_ text: String, agentId: String) -> Bool {
        guard wsClient.connectionState == .connected else { return false }

        switch state {
        case .pendingApproval, .agentWorking:
            return false
        case .idle, .userTyping, .rejected:
            break
        }

        state = .userTyping
        lastRejectionReason = nil
        wsClient.sendInput(text, agentId: agentId)

        // Reset to idle after a short delay (unless overridden by server state)
        Task {
            try? await Task.sleep(for: .milliseconds(100))
            if case .userTyping = state {
                state = .idle
            }
        }

        return true
    }

    // MARK: - Server Event Handlers

    /// Handle control status updates from the server.
    func handleControlStatus(_ response: ControlStatusResponse) {
        controlState = response.state
    }

    /// Handle input rejection from the server.
    func handleInputRejected(_ response: InputRejectedResponse) {
        lastRejectionReason = response.reason
        state = .rejected(response.reason)

        // Auto-reset rejection state after a brief display period
        Task {
            try? await Task.sleep(for: .seconds(2))
            if case .rejected = state {
                state = .idle
            }
        }
    }

    /// Handle agent status updates.
    func handleAgentStatus(_ agentId: String, status: AgentStatus) {
        switch status {
        case .running:
            state = .agentWorking
        case .idle, .stopped, .error, .creating:
            if case .agentWorking = state {
                state = .idle
            }
        }
    }

    /// Handle a guardrail approval prompt from the server.
    func handleApprovalRequired(command: String) {
        state = .pendingApproval(command: command)
    }

    /// Approve a pending command.
    func approveCommand() {
        guard case .pendingApproval = state else { return }
        state = .idle
    }

    /// Reject a pending command.
    func rejectCommand() {
        guard case .pendingApproval = state else { return }
        state = .idle
    }
}
