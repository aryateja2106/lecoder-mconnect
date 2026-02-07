import Foundation
import UserNotifications
import UIKit

/// Push notification service for agent events.
///
/// Handles requesting notification permissions, registering device tokens
/// with both APNs and the MConnect server, and routing notification payloads
/// to the appropriate in-app handlers.
@MainActor
class PushService: ObservableObject {
    static let shared = PushService()

    @Published var isRegistered = false
    @Published var deviceToken: String?
    @Published var permissionGranted = false

    private var tokenManager: TokenManager { .shared }

    private init() {}

    // MARK: - Permission

    /// Request notification permission and register for remote notifications.
    func requestPermission() async -> Bool {
        do {
            let granted = try await UNUserNotificationCenter.current().requestAuthorization(
                options: [.alert, .badge, .sound]
            )
            permissionGranted = granted
            if granted {
                await MainActor.run {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
            return granted
        } catch {
            print("[PushService] Permission error: \(error)")
            return false
        }
    }

    // MARK: - Token Registration

    /// Called by AppDelegate when APNs returns a device token.
    func registerDeviceToken(_ token: String) {
        self.deviceToken = token
        self.isRegistered = true

        // Send token to server via REST API
        Task {
            await sendTokenToServer(token)
        }
    }

    /// Send device token to the MConnect server via REST API.
    private func sendTokenToServer(_ token: String) async {
        guard let accessToken = tokenManager.accessToken,
              let serverURL = tokenManager.serverURL
        else {
            print("[PushService] No auth token or server URL, deferring token registration")
            return
        }

        guard let url = URL(string: "\(serverURL)/devices/token") else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = [
            "token": token,
            "platform": "ios"
        ]

        guard let bodyData = try? JSONSerialization.data(withJSONObject: body) else { return }
        request.httpBody = bodyData

        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 201 {
                print("[PushService] Device token registered with server")
            } else {
                print("[PushService] Server token registration failed: \(response)")
            }
        } catch {
            print("[PushService] Server token registration error: \(error)")
        }
    }

    // MARK: - Notification Handling

    /// Process a remote notification payload and dispatch to in-app handlers.
    ///
    /// When `navigate` is true (e.g. user tapped the notification), also posts
    /// an `.openSession` notification for deep linking.
    func handleNotificationPayload(_ userInfo: [AnyHashable: Any], navigate: Bool = false) {
        guard let type = userInfo["type"] as? String else { return }

        let sessionId = userInfo["sessionId"] as? String
        let agentId = userInfo["agentId"] as? String
        let command = userInfo["command"] as? String

        var info: [String: Any] = [:]
        if let sessionId { info["sessionId"] = sessionId }
        if let agentId { info["agentId"] = agentId }
        if let command { info["command"] = command }

        switch type {
        case "agent_completed":
            NotificationCenter.default.post(name: .agentCompleted, object: nil, userInfo: info)
        case "agent_error":
            NotificationCenter.default.post(name: .agentError, object: nil, userInfo: info)
        case "approval_required":
            NotificationCenter.default.post(name: .approvalRequired, object: nil, userInfo: info)
        case "session_idle":
            NotificationCenter.default.post(name: .sessionIdle, object: nil, userInfo: info)
        default:
            break
        }

        // Navigate to the relevant session when the user interacted with the notification
        if navigate, let sessionId {
            NotificationCenter.default.post(
                name: .openSession,
                object: nil,
                userInfo: ["sessionId": sessionId]
            )
        }
    }

    // MARK: - Badge Management

    /// Clear the app badge count.
    func clearBadge() async {
        try? await UNUserNotificationCenter.current().setBadgeCount(0)
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let agentCompleted = Notification.Name("agentCompleted")
    static let agentError = Notification.Name("agentError")
    static let approvalRequired = Notification.Name("approvalRequired")
    static let sessionIdle = Notification.Name("sessionIdle")
    static let openSession = Notification.Name("openSession")
}
