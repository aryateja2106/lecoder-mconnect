import UIKit
import BackgroundTasks
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

    private init() {}

    // MARK: - Configuration

    /// Set the WSClient instance to manage. Call once during app startup.
    func configure(wsClient: WSClient) {
        self.wsClient = wsClient
    }

    // MARK: - BGTaskScheduler Registration

    /// Register the background processing task with the system.
    /// Must be called before the app finishes launching (in `didFinishLaunchingWithOptions`).
    func registerBackgroundTasks() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: Self.keepAliveTaskIdentifier,
            using: nil
        ) { [weak self] task in
            guard let task = task as? BGProcessingTask else { return }
            Task { @MainActor in
                self?.handleKeepAliveTask(task)
            }
        }
        logger.info("Registered background keepalive task")
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
    private func scheduleKeepAliveTask() {
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

        guard let client = wsClient else {
            task.setTaskCompleted(success: true)
            return
        }

        // If the client is connected, send a heartbeat ack to keep it alive
        if client.connectionState == .connected {
            client.ping()
            logger.info("Sent keepalive ping during background processing")
        } else if wasConnectedBeforeBackground, let host = lastConnectedHost {
            // Try to reconnect
            logger.info("Attempting reconnect during background processing")
            client.connect(to: host)
            if let sessionId = lastAttachedSessionId {
                // Re-attach after a brief delay to allow auth to complete
                Task {
                    try? await Task.sleep(for: .seconds(2))
                    if client.connectionState == .connected {
                        client.attachToSession(sessionId)
                    }
                }
            }
        }

        // Set up expiration handler
        task.expirationHandler = { [weak self] in
            Task { @MainActor in
                self?.logger.info("BGProcessingTask expired")
            }
        }

        // Schedule next keepalive
        scheduleKeepAliveTask()

        // Complete after a brief window
        Task {
            try? await Task.sleep(for: .seconds(5))
            task.setTaskCompleted(success: true)
        }
    }

    // MARK: - Connection Restoration

    /// Restore the WebSocket connection to the last known host and session.
    private func restoreConnection(client: WSClient) {
        guard let host = lastConnectedHost else {
            logger.info("No host to restore connection to")
            return
        }

        // Reset reconnect attempts since this is a fresh foreground restore
        client.connect(to: host)

        // Re-attach to session after connection is established
        if let sessionId = lastAttachedSessionId {
            // We need to wait for the connection to be established before re-attaching.
            // The WSClient will fire auth and connect; we observe the state.
            Task {
                // Poll for connected state with timeout
                let deadline = Date().addingTimeInterval(10)
                while Date() < deadline {
                    if client.connectionState == .connected {
                        client.attachToSession(sessionId)
                        logger.info("Re-attached to session \(sessionId) after foregrounding")
                        return
                    }
                    try? await Task.sleep(for: .milliseconds(200))
                }
                logger.warning("Timed out waiting for connection to restore session attachment")
            }
        }
    }
}
