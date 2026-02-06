import UIKit
import UserNotifications

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self

        // Register background tasks synchronously — Apple requires this completes
        // before didFinishLaunchingWithOptions returns.
        BackgroundSessionManager.registerBackgroundTaskHandlers()

        // Defer push notification permission request to avoid blocking launch UI
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(2))
            _ = await PushService.shared.requestPermission()
        }

        // Observe scene lifecycle notifications for background/foreground transitions
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(sceneDidEnterBackground),
            name: UIScene.didEnterBackgroundNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(sceneWillEnterForeground),
            name: UIScene.willEnterForegroundNotification,
            object: nil
        )

        return true
    }

    // MARK: - Scene Lifecycle

    @objc private func sceneDidEnterBackground(_ notification: Notification) {
        Task { @MainActor in
            BackgroundSessionManager.shared.appDidEnterBackground()
        }
    }

    @objc private func sceneWillEnterForeground(_ notification: Notification) {
        Task { @MainActor in
            BackgroundSessionManager.shared.appWillEnterForeground()
        }
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        Task { @MainActor in
            PushService.shared.registerDeviceToken(token)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        print("[AppDelegate] Failed to register for remote notifications: \(error)")
    }

    func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        // Handle silent/background notifications
        Task { @MainActor in
            PushService.shared.handleNotificationPayload(userInfo)
        }
        completionHandler(.newData)
    }
}

extension AppDelegate: UNUserNotificationCenterDelegate {
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Show banner even when app is in foreground
        completionHandler([.banner, .badge, .sound])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo

        // Route the notification payload through PushService (navigate on tap)
        Task { @MainActor in
            PushService.shared.handleNotificationPayload(userInfo, navigate: true)
            PushService.shared.clearBadge()
        }

        completionHandler()
    }
}

extension Notification.Name {
    static let openSession = Notification.Name("openSession")
}
