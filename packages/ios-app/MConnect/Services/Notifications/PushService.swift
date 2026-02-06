import Foundation
import UserNotifications

/// Push notification service for agent events.
@MainActor
class PushService: ObservableObject {
    static let shared = PushService()

    @Published var isRegistered = false
    @Published var deviceToken: String?

    private init() {}

    func requestPermission() async -> Bool {
        do {
            let granted = try await UNUserNotificationCenter.current().requestAuthorization(
                options: [.alert, .badge, .sound]
            )
            if granted {
                await MainActor.run {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
            return granted
        } catch {
            print("Push notification permission error: \(error)")
            return false
        }
    }

    func registerDeviceToken(_ token: String) {
        self.deviceToken = token
        self.isRegistered = true
        // Will send token to server in later step
    }

    func handleNotificationPayload(_ userInfo: [AnyHashable: Any]) {
        guard let type = userInfo["type"] as? String else { return }

        switch type {
        case "agent_completed":
            if let agentId = userInfo["agentId"] as? String {
                NotificationCenter.default.post(
                    name: .agentCompleted,
                    object: nil,
                    userInfo: ["agentId": agentId]
                )
            }
        case "agent_error":
            if let agentId = userInfo["agentId"] as? String {
                NotificationCenter.default.post(
                    name: .agentError,
                    object: nil,
                    userInfo: ["agentId": agentId]
                )
            }
        case "approval_required":
            if let command = userInfo["command"] as? String {
                NotificationCenter.default.post(
                    name: .approvalRequired,
                    object: nil,
                    userInfo: ["command": command]
                )
            }
        default:
            break
        }
    }
}

extension Notification.Name {
    static let agentCompleted = Notification.Name("agentCompleted")
    static let agentError = Notification.Name("agentError")
    static let approvalRequired = Notification.Name("approvalRequired")
}

import UIKit
