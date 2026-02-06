import Foundation

enum ConnectionState: Equatable {
    case disconnected
    case connecting
    case authenticating
    case connected
    case reconnecting(attempt: Int)
}

@MainActor
class WSClient: ObservableObject {
    @Published var connectionState: ConnectionState = .disconnected
    @Published var currentSession: Session?
    @Published var agents: [Agent] = []

    private var webSocket: URLSessionWebSocketTask?
    private var urlSession: URLSession?
    private let tokenManager: TokenManager

    init(tokenManager: TokenManager) {
        self.tokenManager = tokenManager
    }

    func connect(to host: Host) {
        guard connectionState == .disconnected else { return }
        connectionState = .connecting

        let scheme = host.useTLS ? "wss" : "ws"
        guard let url = URL(string: "\(scheme)://\(host.hostname):\(host.port)/ws") else { return }

        let session = URLSession(configuration: .default)
        self.urlSession = session
        let task = session.webSocketTask(with: url)
        self.webSocket = task
        task.resume()

        connectionState = .authenticating
        sendAuthMessage()
        receiveMessage()
    }

    func disconnect() {
        webSocket?.cancel(with: .normalClosure, reason: nil)
        webSocket = nil
        connectionState = .disconnected
    }

    func sendInput(_ text: String, agentId: String) {
        let message: [String: Any] = [
            "type": "input",
            "agentId": agentId,
            "data": text,
        ]
        send(message)
    }

    // MARK: - Private

    private func sendAuthMessage() {
        guard let token = tokenManager.accessToken else {
            connectionState = .disconnected
            return
        }
        let message: [String: Any] = [
            "type": "auth",
            "token": token,
        ]
        send(message)
    }

    private func send(_ dict: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: dict),
              let text = String(data: data, encoding: .utf8)
        else { return }
        webSocket?.send(.string(text)) { error in
            if let error {
                print("WebSocket send error: \(error)")
            }
        }
    }

    private func receiveMessage() {
        webSocket?.receive { [weak self] result in
            Task { @MainActor in
                switch result {
                case .success(let message):
                    self?.handleMessage(message)
                    self?.receiveMessage()
                case .failure(let error):
                    print("WebSocket receive error: \(error)")
                    self?.connectionState = .disconnected
                }
            }
        }
    }

    private func handleMessage(_ message: URLSessionWebSocketTask.Message) {
        switch message {
        case .string(let text):
            guard let data = text.data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let type = json["type"] as? String
            else { return }

            switch type {
            case "auth_success":
                connectionState = .connected
            case "session_state":
                // Update session and agents
                break
            case "output":
                // Route terminal output
                break
            case "heartbeat":
                send(["type": "heartbeat_ack"])
            default:
                break
            }
        case .data:
            break
        @unknown default:
            break
        }
    }
}
