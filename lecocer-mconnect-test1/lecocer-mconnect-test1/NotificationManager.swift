//
//  NotificationManager.swift
//  LeCoder MConnect
//
//  Local push notifications for connection status changes.
//

import UserNotifications

@MainActor
class NotificationManager: ObservableObject {
    static let shared = NotificationManager()
    @Published var isAuthorized = false

    private init() {}

    func requestPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            Task { @MainActor in
                self.isAuthorized = granted
            }
        }
    }

    func sendConnectionNotification(state: ConnectionState, host: String?) {
        guard isAuthorized else { return }

        let content = UNMutableNotificationContent()

        switch state {
        case .connected:
            content.title = "Connected to \(host ?? "session")"
            content.body = "Terminal session is active."
            content.categoryIdentifier = "CONNECTION_STATUS"
            content.sound = .default
        case .error(let message):
            content.title = "Connection Failed"
            content.body = message
            content.categoryIdentifier = "CONNECTION_ERROR"
            content.sound = UNNotificationSound.defaultCritical
        case .disconnected:
            content.title = "Session Disconnected"
            content.body = "You have been disconnected from the terminal session."
            content.categoryIdentifier = "CONNECTION_STATUS"
            content.sound = .default
        case .connecting:
            return
        }

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 0.1, repeats: false)
        let request = UNNotificationRequest(
            identifier: "connection-\(UUID().uuidString)",
            content: content,
            trigger: trigger
        )

        UNUserNotificationCenter.current().add(request)
    }
}
