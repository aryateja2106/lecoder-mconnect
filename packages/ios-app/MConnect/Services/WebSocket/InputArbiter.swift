import Foundation

/// Client-side input arbitration to prevent conflicting input from multiple sources.
@MainActor
class InputArbiter: ObservableObject {
    enum InputState: Equatable {
        case idle
        case userTyping
        case agentWorking
        case pendingApproval(command: String)
    }

    @Published var state: InputState = .idle
    @Published var lastInputSource: String?

    private let wsClient: WSClient

    init(wsClient: WSClient) {
        self.wsClient = wsClient
    }

    func sendInput(_ text: String, agentId: String) -> Bool {
        guard case .idle = state, wsClient.connectionState == .connected else {
            return false
        }

        state = .userTyping
        wsClient.sendInput(text, agentId: agentId)

        // Reset to idle after a short delay
        Task {
            try? await Task.sleep(for: .milliseconds(100))
            if case .userTyping = state {
                state = .idle
            }
        }

        return true
    }

    func handleAgentWorkingState() {
        state = .agentWorking
    }

    func handleAgentIdle() {
        state = .idle
    }

    func handleApprovalRequired(command: String) {
        state = .pendingApproval(command: command)
    }

    func approveCommand() {
        guard case .pendingApproval = state else { return }
        state = .idle
    }

    func rejectCommand() {
        guard case .pendingApproval = state else { return }
        state = .idle
    }
}
