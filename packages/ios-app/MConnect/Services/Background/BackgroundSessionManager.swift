import UIKit
import BackgroundTasks
import Combine
import os

/// Manages WebSocket connection lifecycle across app state transitions.
///
/// When the app enters background:
/// 1. Starts a `UIApplication.beginBackgroundTask` to keep the WebSocket alive
///    for the system-granted background time (~30s).
/// 2. Schedules a `BGProcessingTask` so the system can wake the app to send
///    a heartbeat if the connection is still needed.
///
/// When the app returns to foreground:
/// 1. Cancels any pending background task requests.
/// 2. Restores the WebSocket connection if it was lost while backgrounded.
@MainActor
class BackgroundSessionManager: ObservableObject {

    static let shared = BackgroundSessionManager()

    // MARK: - Constants

    /// BGTaskScheduler identifier for the WebSocket keepalive task.
    static let keepAliveTaskIdentifier = "com.lecoder.mconnect.ws-keepalive"

    // MARK: - Published State

    /// Whether the app is currently in the background.
    @Published private(set) var isInBackground = false

    /// Whether the WebSocket was connected when the app entered background.
    @Published private(set) var wasConnectedBeforeBackground = false

    /// The host the client was connected to before backgrounding.
    @Published private(set) var lastConnectedHost: Host?

    /// The session the client was attached to before backgrounding.
    @Published private(set) var lastAttachedSessionId: String?

    // MARK: - Private State

    private let logger = Logger(subsystem: "com.lecoder.mconnect", category: "BackgroundSession")

    /// The background task identifier returned by `beginBackgroundTask`.
    private var backgroundTaskId: UIBackgroundTaskIdentifier = .invalid

    /// Reference to the WSClient to manage.
    private weak var wsClient: WSClient?

    /// Subscriptions for reactive connection-state observation.
    private var cancellables = Set<AnyCancellable>()

    /// Maximum time to wait for the connection to reach `.connected` before giving up.
    private let connectionRestorationTimeout: TimeInterval = 10.0

    private init() {}

    #if DEBUG
    /// Reset all state for testing. Only available in debug builds.
    func resetForTesting() {
        isInBackground = false
        wasConnectedBeforeBackground = false
        lastConnectedHost = nil
        lastAttachedSessionId = nil
        backgroundTaskId = .invalid
        wsClient = nil
        cancellables.removeAll()
    }
    #endif

    // MARK: - Configuration

    /// Set the WSClient instance to manage.
    /// Safe to call multiple times — only updates if the client has changed.
    func configure(wsClient: WSClient) {
        guard self.wsClient !== wsClient else { return }
        self.wsClient = wsClient
    }

    // MARK: - BGTaskScheduler Registration

    /// Register the background processing task handler with the system.
    ///
    /// **Must** be called synchronously during `application(_:didFinishLaunchingWithOptions:)`
    /// before the method returns. Apple requires all `BGTaskScheduler` registrations to happen
    /// in that window. This is `nonisolated` and `static` so it can be called directly from
    /// the non-isolated `AppDelegate` without going through a `Task`.
    nonisolated static func registerBackgroundTaskHandlers() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: keepAliveTaskIdentifier,
            using: nil
        ) { task in
            guard let task = task as? BGProcessingTask else { return }
            Task { @MainActor in
                BackgroundSessionManager.shared.handleKeepAliveTask(task)
            }
        }
    }

    // MARK: - App Lifecycle: Enter Background

    /// Called when the app transitions to background.
    /// Captures current connection state and starts a background task to maintain the socket.
    func appDidEnterBackground() {
        isInBackground = true

        guard let client = wsClient else { return }

        // Capture current state for restoration
        wasConnectedBeforeBackground = client.connectionState == .connected
        lastConnectedHost = client.currentHostForBackground
        lastAttachedSessionId = client.attachedSessionId

        guard wasConnectedBeforeBackground else {
            logger.info("App backgrounded, no active connection to maintain")
            return
        }

        logger.info("App backgrounded with active WebSocket connection")

        // Start a background task to keep the connection alive during the grace period
        startBackgroundTask()

        // Schedule a BGProcessingTask for longer-term keepalive
        scheduleKeepAliveTask()
    }

    // MARK: - App Lifecycle: Enter Foreground

    /// Called when the app transitions to foreground.
    /// Restores the WebSocket connection if it was lost while backgrounded.
    func appWillEnterForeground() {
        isInBackground = false

        // Cancel any scheduled background processing tasks
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: Self.keepAliveTaskIdentifier)

        // End the background task if still running
        endBackgroundTask()

        guard let client = wsClient else { return }

        // If we had a connection before and it's now gone, restore it
        if wasConnectedBeforeBackground && client.connectionState == .disconnected {
            logger.info("Restoring WebSocket connection after foregrounding")
            restoreConnection(client: client)
        } else if client.connectionState == .connected {
            logger.info("WebSocket connection survived backgrounding")
            // Send a ping to verify the connection is still alive
            client.ping()
        }

        // Reset background state
        wasConnectedBeforeBackground = false
    }

    // MARK: - Background Task Management

    /// Start a UIKit background task to extend execution time.
    private func startBackgroundTask() {
        guard backgroundTaskId == .invalid else { return }

        backgroundTaskId = UIApplication.shared.beginBackgroundTask(
            withName: "MConnect WebSocket Keepalive"
        ) { [weak self] in
            // System is about to kill us — clean up
            Task { @MainActor in
                self?.logger.info("Background task expiration handler called")
                self?.endBackgroundTask()
            }
        }

        if backgroundTaskId == .invalid {
            logger.warning("Failed to start background task")
        } else {
            logger.info("Started background task: \(self.backgroundTaskId.rawValue)")
        }
    }

    /// End the UIKit background task.
    private func endBackgroundTask() {
        guard backgroundTaskId != .invalid else { return }
        logger.info("Ending background task: \(self.backgroundTaskId.rawValue)")
        UIApplication.shared.endBackgroundTask(backgroundTaskId)
        backgroundTaskId = .invalid
    }

    // MARK: - BGProcessingTask

    /// Schedule a BGProcessingTask for longer-term keepalive.
    /// The system decides when to run it based on power and network conditions.
    /// Only schedules if a connection was active before backgrounding.
    private func scheduleKeepAliveTask() {
        guard wasConnectedBeforeBackground else { return }

        let request = BGProcessingTaskRequest(identifier: Self.keepAliveTaskIdentifier)
        request.requiresNetworkConnectivity = true
        request.requiresExternalPower = false
        // Schedule soon — we want to keep the connection alive
        request.earliestBeginDate = Date(timeIntervalSinceNow: 60)

        do {
            try BGTaskScheduler.shared.submit(request)
            logger.info("Scheduled keepalive BGProcessingTask")
        } catch {
            logger.error("Failed to schedule keepalive task: \(error.localizedDescription)")
        }
    }

    /// Handle the system-invoked BGProcessingTask.
    private func handleKeepAliveTask(_ task: BGProcessingTask) {
        logger.info("BGProcessingTask running: keepalive")

        // Track whether the task has already been completed to avoid double-completion.
        var isCompleted = false
        let completeTask: (Bool) -> Void = { [weak self] success in
            guard !isCompleted else { return }
            isCompleted = true
            task.setTaskCompleted(success: success)
            self?.logger.info("BGProcessingTask completed (success: \(success))")
        }

        // Set up expiration handler first — the system can fire this at any time.
        task.expirationHandler = { [weak self] in
            Task { @MainActor in
                self?.logger.info("BGProcessingTask expired by system")
                completeTask(false)
            }
        }

        guard let client = wsClient, wasConnectedBeforeBackground else {
            completeTask(true)
            return
        }

        if client.connectionState == .connected {
            // Connection survived — send a ping to keep it alive
            client.ping()
            logger.info("Sent keepalive ping during background processing")
            scheduleKeepAliveTask()
            completeTask(true)
        } else if let host = lastConnectedHost {
            // Try to reconnect, then complete once done (or after timeout)
            logger.info("Attempting reconnect during background processing")
            client.connect(to: host)

            // Use Combine to wait for connected state, then complete
            client.$connectionState
                .first(where: { $0 == .connected })
                .timeout(.seconds(8), scheduler: DispatchQueue.main)
                .sink(
                    receiveCompletion: { [weak self] completion in
                        if case .failure = completion {
                            self?.logger.warning("BGProcessingTask reconnect timed out")
                        }
                        self?.scheduleKeepAliveTask()
                        completeTask(true)
                    },
                    receiveValue: { [weak self, weak client] _ in
                        guard let client, let sessionId = self?.lastAttachedSessionId else { return }
                        client.attachToSession(sessionId)
                        self?.logger.info("Re-attached to session during background processing")
                    }
                )
                .store(in: &cancellables)
        } else {
            completeTask(true)
        }
    }

    // MARK: - Connection Restoration

    /// Restore the WebSocket connection to the last known host and session.
    private func restoreConnection(client: WSClient) {
        guard let host = lastConnectedHost else {
            logger.info("No host to restore connection to")
            return
        }

        client.connect(to: host)

        // Re-attach to session reactively once the connection reaches `.connected`.
        guard let sessionId = lastAttachedSessionId else { return }

        // Cancel any previous restoration subscription
        cancellables.removeAll()

        client.$connectionState
            .first(where: { $0 == .connected })
            .timeout(.seconds(connectionRestorationTimeout), scheduler: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    if case .failure = completion {
                        self?.logger.warning("Timed out waiting for connection to restore session attachment")
                    }
                    self?.cancellables.removeAll()
                },
                receiveValue: { [weak self, weak client] _ in
                    guard let client else { return }
                    client.attachToSession(sessionId)
                    self?.logger.info("Re-attached to session \(sessionId) after foregrounding")
                }
            )
            .store(in: &cancellables)
    }
}
