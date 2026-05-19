import Foundation
import WatchConnectivity

@MainActor
final class WatchSessionStore: NSObject, ObservableObject {
    @Published var summary: WatchSessionSummary = .empty
    @Published var lastSendStatus: String?

    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    override init() {
        super.init()
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
    }

    func activate() {
        guard WCSession.isSupported() else {
            lastSendStatus = "Pairing unavailable"
            return
        }

        let session = WCSession.default
        session.delegate = self
        session.activate()

        if let summaryJSON = session.receivedApplicationContext["summary"] as? String {
            updateSummary(from: summaryJSON)
        }
    }

    func sendPrompt(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        let draft = WatchCommandDraft(kind: .dictation, text: trimmed)
        guard let draftJSON = encode(draft) else {
            lastSendStatus = "Could not encode prompt"
            return
        }

        WCSession.default.sendMessage(
            [
                "type": "watch_command_submit",
                "draft": draftJSON,
            ],
            replyHandler: { [weak self] reply in
                Task { @MainActor in
                    let ok = reply["ok"] as? Bool ?? false
                    self?.lastSendStatus = ok ? "Sent to agent" : "No active agent"
                }
            },
            errorHandler: { [weak self] error in
                Task { @MainActor in
                    self?.lastSendStatus = error.localizedDescription
                }
            }
        )
    }

    private func updateSummary(from json: String) {
        guard let data = json.data(using: .utf8),
              let decoded = try? decoder.decode(WatchSessionSummary.self, from: data)
        else {
            return
        }
        summary = decoded
    }

    private func encode<T: Encodable>(_ value: T) -> String? {
        guard let data = try? encoder.encode(value) else { return nil }
        return String(decoding: data, as: UTF8.self)
    }
}

extension WatchSessionStore: WCSessionDelegate {
    nonisolated func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        if let error {
            Task { @MainActor in
                self.lastSendStatus = error.localizedDescription
            }
        }
    }

    nonisolated func session(
        _ session: WCSession,
        didReceiveApplicationContext applicationContext: [String: Any]
    ) {
        guard let summaryJSON = applicationContext["summary"] as? String else { return }
        Task { @MainActor in
            self.updateSummary(from: summaryJSON)
        }
    }
}

enum WatchConnectionState: String, Codable, Equatable {
    case disconnected
    case connecting
    case authenticating
    case connected
    case reconnecting
    case waitingForNetwork
}

enum AgentStatus: String, Codable, Equatable {
    case creating
    case running
    case idle
    case stopped
    case error
}

struct AgentInfo: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let preset: String
    let status: AgentStatus
}

struct WatchUsageSnapshot: Codable, Equatable {
    var promptTokens: Int?
    var completionTokens: Int?
    var totalTokens: Int?
    var costUsd: Double?
    var window: String?
    var model: String?
    var updatedAt: Date?
    var errorMessage: String?

    static func unavailable(_ message: String) -> WatchUsageSnapshot {
        WatchUsageSnapshot(errorMessage: message)
    }
}

enum WatchCommandKind: String, Codable, Equatable {
    case dictation
    case quickPrompt
    case quickAction
}

struct WatchCommandDraft: Identifiable, Codable, Equatable {
    let id: UUID
    var kind: WatchCommandKind
    var text: String
    var createdAt: Date

    init(
        id: UUID = UUID(),
        kind: WatchCommandKind,
        text: String,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.kind = kind
        self.text = text
        self.createdAt = createdAt
    }
}

struct WatchSessionSummary: Codable, Equatable {
    var hostName: String
    var sessionId: String?
    var connectionState: WatchConnectionState
    var agents: [AgentInfo]
    var activeAgentId: String?
    var usage: WatchUsageSnapshot
    var lastActivity: Date?

    var activeAgentName: String? {
        guard let activeAgentId else { return agents.first?.name }
        return agents.first { $0.id == activeAgentId }?.name
    }

    static let empty = WatchSessionSummary(
        hostName: "No active host",
        sessionId: nil,
        connectionState: .disconnected,
        agents: [],
        activeAgentId: nil,
        usage: .unavailable("Open MConnect on iPhone"),
        lastActivity: nil
    )
}
