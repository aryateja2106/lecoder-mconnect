import Combine
import Foundation
import os

/// Connection lifecycle states.
enum ConnectionState: Equatable {
    case disconnected
    case connecting
    case authenticating
    case connected
    case reconnecting(attempt: Int)
    /// Network is unavailable — reconnection will resume automatically when the network returns.
    case waitingForNetwork
}

/// Delegate protocol for receiving WebSocket events.
///
/// All methods are called on the main actor.
@MainActor
protocol WSClientDelegate: AnyObject {
    func wsClient(_ client: WSClient, didChangeState state: ConnectionState)
    func wsClient(_ client: WSClient, didReceiveOutput data: String, fromAgent agentId: String)
    func wsClient(_ client: WSClient, didReceiveSessionList sessions: [SessionInfo])
    func wsClient(_ client: WSClient, didReceiveSessionState response: SessionStateResponse)
    func wsClient(_ client: WSClient, didReceiveAgentList agents: [AgentInfo])
    func wsClient(_ client: WSClient, didReceiveAgentStatus agentId: String, status: AgentStatus)
    func wsClient(_ client: WSClient, didReceiveControlStatus response: ControlStatusResponse)
    func wsClient(_ client: WSClient, didReceiveControlResponse response: ControlResponse)
    func wsClient(_ client: WSClient, didReceiveInputRejection response: InputRejectedResponse)
    func wsClient(_ client: WSClient, didReceiveScrollback response: ScrollbackResponse)
    func wsClient(_ client: WSClient, clientJoined clientInfo: ClientInfo)
    func wsClient(_ client: WSClient, clientLeft clientId: String)
    func wsClient(_ client: WSClient, didReceiveError response: ErrorResponse)
}

/// Default no-op implementations so delegates can opt in to only the events they care about.
extension WSClientDelegate {
    func wsClient(_ client: WSClient, didChangeState state: ConnectionState) {}
    func wsClient(_ client: WSClient, didReceiveOutput data: String, fromAgent agentId: String) {}
    func wsClient(_ client: WSClient, didReceiveSessionList sessions: [SessionInfo]) {}
    func wsClient(_ client: WSClient, didReceiveSessionState response: SessionStateResponse) {}
    func wsClient(_ client: WSClient, didReceiveAgentList agents: [AgentInfo]) {}
    func wsClient(_ client: WSClient, didReceiveAgentStatus agentId: String, status: AgentStatus) {}
    func wsClient(_ client: WSClient, didReceiveControlStatus response: ControlStatusResponse) {}
    func wsClient(_ client: WSClient, didReceiveControlResponse response: ControlResponse) {}
    func wsClient(_ client: WSClient, didReceiveInputRejection response: InputRejectedResponse) {}
    func wsClient(_ client: WSClient, didReceiveScrollback response: ScrollbackResponse) {}
    func wsClient(_ client: WSClient, clientJoined clientInfo: ClientInfo) {}
    func wsClient(_ client: WSClient, clientLeft clientId: String) {}
    func wsClient(_ client: WSClient, didReceiveError response: ErrorResponse) {}
}

/// WebSocket client implementing MConnect protocol v3.
///
/// Manages the full connection lifecycle:
/// 1. Connect to server via `wss://` or `ws://`
/// 2. Authenticate with JWT token (first message)
/// 3. Send/receive typed protocol messages
/// 4. Respond to server heartbeats
/// 5. Automatically reconnect on disconnection with exponential backoff
/// 6. Monitor network reachability and pause/resume reconnection accordingly
/// 7. Restore session attachment after successful reconnection
@MainActor
class WSClient: ObservableObject {

    // MARK: - Published State

    @Published private(set) var connectionState: ConnectionState = .disconnected
    @Published private(set) var clientId: String?
    @Published private(set) var attachedSessionId: String?
    @Published private(set) var sessions: [SessionInfo] = []
    @Published private(set) var agents: [AgentInfo] = []
    @Published private(set) var controlState: ControlState?

    // MARK: - Delegate

    weak var delegate: WSClientDelegate?

    // MARK: - Dependencies

    private let tokenManager: TokenManager
    private let authService: AuthService
    private let networkMonitor: NetworkMonitoring
    private let encoder = JSONEncoder()
    private let logger = Logger(subsystem: "com.lecoder.mconnect", category: "WSClient")

    // MARK: - Connection State

    private var webSocket: URLSessionWebSocketTask?
    private var urlSession: URLSession?
    private var currentHost: Host?
    private var heartbeatTimer: Timer?
    private var lastHeartbeatReceived: Date?

    /// Exposes the current host for background session restoration.
    var currentHostForBackground: Host? { currentHost }

    // MARK: - Reconnection State

    /// Whether automatic reconnection is enabled.
    var autoReconnect = true

    /// Maximum number of reconnection attempts before giving up.
    let maxReconnectAttempts = 10

    /// Base delay in seconds for exponential backoff.
    private let baseReconnectDelay: TimeInterval = 1.0

    /// Maximum delay in seconds for exponential backoff.
    private let maxReconnectDelay: TimeInterval = 30.0

    /// Number of scrollback lines to request after a successful reconnection.
    var reconnectScrollbackLines: Int = 500

    private var reconnectAttempt = 0
    private var reconnectTask: Task<Void, Never>?
    private var isIntentionalDisconnect = false
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Session Restoration State

    /// The session ID to re-attach to after a successful reconnection.
    private var pendingSessionReattach: String?

    // MARK: - Heartbeat Configuration

    /// Interval to check that heartbeats are still arriving. The server sends heartbeats
    /// every 30 seconds; we allow up to 90 seconds of silence before considering the
    /// connection dead.
    private let heartbeatCheckInterval: TimeInterval = 30.0
    private let heartbeatTimeout: TimeInterval = 90.0

    // MARK: - Init

    init(
        tokenManager: TokenManager = .shared,
        authService: AuthService? = nil,
        networkMonitor: NetworkMonitoring = NetworkMonitor.shared
    ) {
        self.tokenManager = tokenManager
        self.authService = authService ?? AuthService(tokenManager: tokenManager)
        self.networkMonitor = networkMonitor
        setupNetworkMonitor()
    }

    // MARK: - Network Monitor Integration

    private func setupNetworkMonitor() {
        networkMonitor.networkRestoredPublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] in
                self?.handleNetworkRestored()
            }
            .store(in: &cancellables)
        networkMonitor.start()
    }

    /// Called when the network transitions from unreachable → reachable.
    private func handleNetworkRestored() {
        guard !isIntentionalDisconnect, let host = currentHost else { return }

        switch connectionState {
        case .waitingForNetwork:
            logger.info("Network restored — resuming reconnection immediately")
            reconnectAttempt = 0
            scheduleReconnect(host: host)
        case .reconnecting:
            // Already trying to reconnect; the next attempt will succeed now that
            // the network is back. Reset attempts so we get fresh backoff.
            logger.info("Network restored during reconnection — resetting attempt counter")
            reconnectAttempt = 0
        case .disconnected where autoReconnect:
            // Exhausted attempts earlier but network is back; give it another shot.
            logger.info("Network restored after max attempts — retrying")
            reconnectAttempt = 0
            scheduleReconnect(host: host)
        default:
            break
        }
    }

    // MARK: - Public API: Connection

    /// Connect to a host. If already connected, disconnects first.
    ///
    /// When reconnecting to the same host (e.g., after background restoration),
    /// preserves `pendingSessionReattach` so the session is automatically restored
    /// after authentication succeeds.
    func connect(to host: Host) {
        let isSameHost = currentHost?.id == host.id
        let savedReattach = isSameHost ? pendingSessionReattach : nil

        if connectionState != .disconnected && connectionState != .waitingForNetwork {
            disconnect()
        }

        currentHost = host
        isIntentionalDisconnect = false
        reconnectAttempt = 0
        pendingSessionReattach = savedReattach

        performConnect(host: host)
    }

    /// Gracefully disconnect. Stops reconnection.
    func disconnect() {
        isIntentionalDisconnect = true
        reconnectTask?.cancel()
        reconnectTask = nil
        pendingSessionReattach = nil
        teardownConnection()
        setConnectionState(.disconnected)
    }

    // MARK: - Public API: Session Operations

    /// Attach to a session by ID.
    func attachToSession(_ sessionId: String) {
        send(SessionAttachMessage(sessionId: sessionId))
        attachedSessionId = sessionId
    }

    /// Detach from the current session.
    func detachFromSession() {
        send(SessionDetachMessage())
        attachedSessionId = nil
        pendingSessionReattach = nil
        agents = []
        controlState = nil
    }

    // MARK: - Public API: Terminal I/O

    /// Send terminal input to an agent.
    func sendInput(_ text: String, agentId: String) {
        guard connectionState == .connected else { return }
        send(TerminalInputMessage(agentId: agentId, data: text))
    }

    /// Resize the terminal for an agent.
    func sendResize(agentId: String, cols: Int, rows: Int) {
        guard connectionState == .connected else { return }
        send(ResizeMessage(agentId: agentId, cols: cols, rows: rows))
    }

    // MARK: - Public API: Control

    /// Request exclusive input control.
    func requestExclusiveControl() {
        guard connectionState == .connected else { return }
        send(ControlRequestMessage(action: .exclusive))
    }

    /// Release exclusive input control.
    func releaseExclusiveControl() {
        guard connectionState == .connected else { return }
        send(ControlRequestMessage(action: .release))
    }

    // MARK: - Public API: Scrollback

    /// Request scrollback history for a session.
    func requestScrollback(sessionId: String, fromLine: Int, count: Int) {
        guard connectionState == .connected else { return }
        send(ScrollbackRequestMessage(sessionId: sessionId, fromLine: fromLine, count: count))
    }

    // MARK: - Public API: Ping

    /// Send a ping to measure latency.
    func ping() {
        guard connectionState == .connected else { return }
        send(PingMessage())
    }

    // MARK: - Public API: Device Token

    /// Register a device token for push notifications via WebSocket.
    func registerDeviceToken(_ token: String) {
        guard connectionState == .connected else { return }
        send(DeviceTokenRegisterMessage(deviceToken: token))
    }

    // MARK: - Connection Lifecycle (Private)

    private func performConnect(host: Host) {
        let scheme = host.useTLS ? "wss" : "ws"
        guard let url = URL(string: "\(scheme)://\(host.hostname):\(host.port)/ws") else {
            logger.error("Invalid WebSocket URL for host \(host.name)")
            return
        }

        // Check network before attempting connection
        if !networkMonitor.isReachable {
            logger.info("Network unavailable — waiting for connectivity")
            setConnectionState(.waitingForNetwork)
            return
        }

        setConnectionState(.connecting)
        logger.info("Connecting to \(url.absoluteString)")

        let config = URLSessionConfiguration.default
        config.waitsForConnectivity = true
        let session = URLSession(configuration: config)
        self.urlSession = session

        let task = session.webSocketTask(with: url)
        self.webSocket = task
        task.resume()

        setConnectionState(.authenticating)
        sendAuthMessage()
        startReceiveLoop()
    }

    private func teardownConnection() {
        stopHeartbeatTimer()
        webSocket?.cancel(with: .normalClosure, reason: nil)
        webSocket = nil
        urlSession?.invalidateAndCancel()
        urlSession = nil
        clientId = nil
    }

    /// Clear all session-related state. Called only on intentional disconnect or fresh connect.
    private func clearSessionState() {
        attachedSessionId = nil
        sessions = []
        agents = []
        controlState = nil
        pendingSessionReattach = nil
    }

    private func setConnectionState(_ state: ConnectionState) {
        connectionState = state
        delegate?.wsClient(self, didChangeState: state)
    }

    // MARK: - Authentication

    private func sendAuthMessage() {
        guard let token = tokenManager.accessToken else {
            logger.warning("No access token available for auth")
            disconnect()
            return
        }
        send(AuthMessage(token: token))
    }

    // MARK: - Send

    private func send<T: Encodable>(_ message: T) {
        guard let data = try? encoder.encode(message),
              let text = String(data: data, encoding: .utf8)
        else {
            logger.error("Failed to encode message")
            return
        }
        webSocket?.send(.string(text)) { [weak self] error in
            if let error {
                Task { @MainActor in
                    self?.logger.error("Send error: \(error.localizedDescription)")
                }
            }
        }
    }

    // MARK: - Receive Loop

    private func startReceiveLoop() {
        webSocket?.receive { [weak self] result in
            Task { @MainActor in
                guard let self else { return }
                switch result {
                case .success(let message):
                    self.handleRawMessage(message)
                    self.startReceiveLoop()
                case .failure(let error):
                    self.logger.error("Receive error: \(error.localizedDescription)")
                    self.handleConnectionLost()
                }
            }
        }
    }

    // MARK: - Message Handling

    private func handleRawMessage(_ raw: URLSessionWebSocketTask.Message) {
        let data: Data
        switch raw {
        case .string(let text):
            guard let d = text.data(using: .utf8) else { return }
            data = d
        case .data(let d):
            data = d
        @unknown default:
            return
        }

        guard let message = ServerMessage.parse(from: data) else {
            logger.warning("Failed to parse server message")
            return
        }

        handleServerMessage(message)
    }

    private func handleServerMessage(_ message: ServerMessage) {
        switch message {
        case .authSuccess(let response):
            handleAuthSuccess(response)
        case .authFailed(let response):
            handleAuthFailed(response)
        case .sessionList(let response):
            sessions = response.sessions
            delegate?.wsClient(self, didReceiveSessionList: response.sessions)
        case .sessionState(let response):
            delegate?.wsClient(self, didReceiveSessionState: response)
        case .terminalOutput(let response):
            delegate?.wsClient(self, didReceiveOutput: response.data, fromAgent: response.agentId)
        case .agentStatus(let response):
            updateAgentStatus(agentId: response.agentId, status: response.status)
            delegate?.wsClient(self, didReceiveAgentStatus: response.agentId, status: response.status)
        case .agentList(let response):
            agents = response.agents
            delegate?.wsClient(self, didReceiveAgentList: response.agents)
        case .controlStatus(let response):
            controlState = response.state
            delegate?.wsClient(self, didReceiveControlStatus: response)
        case .controlResponse(let response):
            delegate?.wsClient(self, didReceiveControlResponse: response)
        case .inputRejected(let response):
            delegate?.wsClient(self, didReceiveInputRejection: response)
        case .scrollbackResponse(let response):
            delegate?.wsClient(self, didReceiveScrollback: response)
        case .clientJoined(let response):
            delegate?.wsClient(self, clientJoined: response.client)
        case .clientLeft(let response):
            delegate?.wsClient(self, clientLeft: response.clientId)
        case .heartbeat(let response):
            handleHeartbeat(response)
        case .pong:
            break // latency measurement — no-op for now
        case .error(let response):
            handleProtocolError(response)
        }
    }

    // MARK: - Auth Handling

    private func handleAuthSuccess(_ response: AuthSuccessResponse) {
        clientId = response.clientId
        reconnectAttempt = 0
        setConnectionState(.connected)
        startHeartbeatTimer()
        logger.info("Authenticated as client \(response.clientId)")

        // Register push notification device token if available
        if let deviceToken = PushService.shared.deviceToken {
            registerDeviceToken(deviceToken)
        }

        // Register with background session manager for keepalive
        BackgroundSessionManager.shared.configure(wsClient: self)

        // Restore session if we have a pending reattach (set during connection loss
        // or preserved across same-host reconnection via BackgroundSessionManager)
        if let sessionId = pendingSessionReattach {
            logger.info("Restoring session attachment to \(sessionId) after reconnection")
            pendingSessionReattach = nil
            attachToSession(sessionId)
            // Request scrollback to catch up on output missed during disconnection
            requestScrollback(sessionId: sessionId, fromLine: 0, count: reconnectScrollbackLines)
        }
    }

    private func handleAuthFailed(_ response: AuthFailedResponse) {
        logger.warning("Auth failed: \(response.reason.rawValue), retryable: \(response.retryable)")

        if response.reason == .expiredToken, response.retryable {
            attemptTokenRefreshAndReauth()
        } else {
            disconnect()
        }
    }

    /// Try to refresh the access token and re-send the auth message.
    private func attemptTokenRefreshAndReauth() {
        guard let host = currentHost else {
            disconnect()
            return
        }

        let serverURL = "\(host.useTLS ? "https" : "http")://\(host.hostname):\(host.port)"

        Task {
            do {
                try await authService.refreshAccessToken(serverURL: serverURL)
                sendAuthMessage()
            } catch {
                logger.error("Token refresh failed: \(error.localizedDescription)")
                disconnect()
            }
        }
    }

    // MARK: - Agent State

    private func updateAgentStatus(agentId: String, status: AgentStatus) {
        if let index = agents.firstIndex(where: { $0.id == agentId }) {
            let agent = agents[index]
            agents[index] = AgentInfo(id: agent.id, name: agent.name, preset: agent.preset, status: status)
        }
    }

    // MARK: - Heartbeat

    private func handleHeartbeat(_ response: HeartbeatResponse) {
        lastHeartbeatReceived = Date()
        send(HeartbeatAckMessage(timestamp: response.timestamp))
    }

    private func startHeartbeatTimer() {
        stopHeartbeatTimer()
        lastHeartbeatReceived = Date()

        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: heartbeatCheckInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.checkHeartbeat()
            }
        }
    }

    private func stopHeartbeatTimer() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
    }

    private func checkHeartbeat() {
        guard let last = lastHeartbeatReceived else { return }
        let elapsed = Date().timeIntervalSince(last)
        if elapsed > heartbeatTimeout {
            logger.warning("Heartbeat timeout (\(elapsed)s since last heartbeat)")
            handleConnectionLost()
        }
    }

    // MARK: - Error Handling

    private func handleProtocolError(_ response: ErrorResponse) {
        logger.error("Protocol error [\(response.code.rawValue)]: \(response.message)")
        delegate?.wsClient(self, didReceiveError: response)

        if response.code == .authExpired || response.code == .authFailed {
            handleConnectionLost()
        }
    }

    // MARK: - Reconnection

    private func handleConnectionLost() {
        // Save session state for restoration before tearing down
        if let sessionId = attachedSessionId {
            pendingSessionReattach = sessionId
        }

        teardownConnection()

        guard autoReconnect, !isIntentionalDisconnect, let host = currentHost else {
            clearSessionState()
            setConnectionState(.disconnected)
            return
        }

        // If the network is down, wait for it to come back instead of burning attempts
        if !networkMonitor.isReachable {
            logger.info("Network unreachable — entering waitingForNetwork state")
            setConnectionState(.waitingForNetwork)
            return
        }

        guard reconnectAttempt < maxReconnectAttempts else {
            logger.warning("Max reconnect attempts reached (\(self.maxReconnectAttempts))")
            clearSessionState()
            setConnectionState(.disconnected)
            return
        }

        scheduleReconnect(host: host)
    }

    /// Schedule a reconnection attempt with exponential backoff.
    private func scheduleReconnect(host: Host) {
        reconnectTask?.cancel()

        reconnectAttempt += 1
        setConnectionState(.reconnecting(attempt: reconnectAttempt))

        let delay = reconnectDelay(attempt: reconnectAttempt)
        logger.info("Reconnecting in \(delay)s (attempt \(self.reconnectAttempt)/\(self.maxReconnectAttempts))")

        reconnectTask = Task {
            try? await Task.sleep(for: .seconds(delay))
            guard !Task.isCancelled else { return }
            performConnect(host: host)
        }
    }

    /// Exponential backoff with jitter: min(maxDelay, baseDelay * 2^(attempt-1)) + random jitter.
    func reconnectDelay(attempt: Int) -> TimeInterval {
        let exponential = baseReconnectDelay * pow(2.0, Double(attempt - 1))
        let clamped = min(exponential, maxReconnectDelay)
        let jitter = Double.random(in: 0...0.5)
        return clamped + jitter
    }
}
