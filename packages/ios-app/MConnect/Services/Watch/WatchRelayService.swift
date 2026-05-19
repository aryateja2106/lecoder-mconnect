import Foundation
import os

#if canImport(WatchConnectivity)
import WatchConnectivity
#endif

@MainActor
final class WatchRelayService: NSObject, ObservableObject {
    static let shared = WatchRelayService()

    typealias CommandHandler = (WatchCommandDraft) -> Bool
    typealias UsageRefreshHandler = () -> Void

    @Published private(set) var summary: WatchSessionSummary = .empty
    @Published private(set) var lastError: String?

    private var commandHandler: CommandHandler?
    private var usageRefreshHandler: UsageRefreshHandler?
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let logger = Logger(subsystem: "com.lecoder.mconnect", category: "WatchRelay")

    private override init() {
        super.init()
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
    }

    func configure() {
        #if canImport(WatchConnectivity)
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
        #endif
    }

    func registerCommandHandler(_ handler: @escaping CommandHandler) {
        commandHandler = handler
    }

    func clearCommandHandler() {
        commandHandler = nil
    }

    func registerUsageRefreshHandler(_ handler: @escaping UsageRefreshHandler) {
        usageRefreshHandler = handler
    }

    func clearUsageRefreshHandler() {
        usageRefreshHandler = nil
    }

    func publish(_ summary: WatchSessionSummary) {
        self.summary = summary
        sendApplicationContext(summary)
    }

    @discardableResult
    func submit(_ draft: WatchCommandDraft) -> Bool {
        guard let commandHandler else {
            lastError = "No active terminal session"
            return false
        }

        let accepted = commandHandler(draft)
        if !accepted {
            lastError = "No active agent to receive watch command"
        }
        return accepted
    }

    private func sendApplicationContext(_ summary: WatchSessionSummary) {
        #if canImport(WatchConnectivity)
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else { return }

        do {
            let data = try encoder.encode(summary)
            let json = String(decoding: data, as: UTF8.self)
            try session.updateApplicationContext([
                "type": "watch_session_snapshot",
                "summary": json,
            ])
        } catch {
            logger.error("Failed to publish watch summary: \(error.localizedDescription)")
        }
        #endif
    }

    private func handleMessage(_ message: [String: Any], replyHandler: (([String: Any]) -> Void)?) {
        guard let type = message["type"] as? String else {
            replyHandler?(["ok": false, "error": "Missing message type"])
            return
        }

        switch type {
        case "watch_command_submit":
            guard
                let draftJSON = message["draft"] as? String,
                let data = draftJSON.data(using: .utf8),
                let draft = try? decoder.decode(WatchCommandDraft.self, from: data)
            else {
                replyHandler?(["ok": false, "error": "Invalid command draft"])
                return
            }

            let accepted = submit(draft)
            replyHandler?(["ok": accepted])

        case "watch_usage_refresh":
            usageRefreshHandler?()
            sendApplicationContext(summary)
            replyHandler?(["ok": true])

        default:
            replyHandler?(["ok": false, "error": "Unknown message type"])
        }
    }
}

#if canImport(WatchConnectivity)
extension WatchRelayService: WCSessionDelegate {
    nonisolated func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        if let error {
            Task { @MainActor in
                self.lastError = error.localizedDescription
            }
        }
    }

    nonisolated func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any],
        replyHandler: @escaping ([String: Any]) -> Void
    ) {
        Task { @MainActor in
            self.handleMessage(message, replyHandler: replyHandler)
        }
    }

    #if os(iOS)
    nonisolated func sessionDidBecomeInactive(_ session: WCSession) {}

    nonisolated func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }
    #endif
}
#endif
