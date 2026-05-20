import Foundation
import SwiftUI

enum HostRole: String, Codable, CaseIterable, Identifiable {
    case mconnectDaemon
    case macTerminal
    case gpuWorker

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .mconnectDaemon: return "MConnect"
        case .macTerminal: return "Mac Terminal"
        case .gpuWorker: return "GPU Worker"
        }
    }

    var iconName: String {
        switch self {
        case .mconnectDaemon: return "server.rack"
        case .macTerminal: return "macbook"
        case .gpuWorker: return "cpu"
        }
    }
}

enum AgentLoopPreset: String, Codable, CaseIterable, Identifiable {
    case codexAuto
    case mlIntern
    case custom

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .codexAuto: return "Codex Auto"
        case .mlIntern: return "ML Intern"
        case .custom: return "Custom"
        }
    }

    var commandTemplate: String {
        switch self {
        case .codexAuto:
            return "codex --model gpt-5.5 \"<task>\""
        case .mlIntern:
            return "ml-intern --sandbox-tools --max-iterations 100 \"<task>\""
        case .custom:
            return "<your long-running agent command>"
        }
    }
}

struct Host: Identifiable, Hashable, Codable {
    let id: String
    var name: String
    var hostname: String
    var port: Int
    var useTLS: Bool
    var requireBiometric: Bool
    var isConnected: Bool
    var role: HostRole?
    var sshUsername: String?
    var sshPort: Int?
    var gpuProvider: String?
    var computeBudgetHours: Double?
    var agentLoopPreset: AgentLoopPreset?

    init(
        id: String = UUID().uuidString,
        name: String,
        hostname: String,
        port: Int = 8080,
        useTLS: Bool = true,
        requireBiometric: Bool = false,
        isConnected: Bool = false,
        role: HostRole? = nil,
        sshUsername: String? = nil,
        sshPort: Int? = nil,
        gpuProvider: String? = nil,
        computeBudgetHours: Double? = nil,
        agentLoopPreset: AgentLoopPreset? = nil
    ) {
        self.id = id
        self.name = name
        self.hostname = hostname
        self.port = port
        self.useTLS = useTLS
        self.requireBiometric = requireBiometric
        self.isConnected = isConnected
        self.role = role
        self.sshUsername = sshUsername
        self.sshPort = sshPort
        self.gpuProvider = gpuProvider
        self.computeBudgetHours = computeBudgetHours
        self.agentLoopPreset = agentLoopPreset
    }

    var effectiveRole: HostRole {
        role ?? .mconnectDaemon
    }

    var effectiveAgentLoopPreset: AgentLoopPreset {
        agentLoopPreset ?? .codexAuto
    }

    var effectiveSSHUsername: String {
        let trimmed = sshUsername?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? "ubuntu" : trimmed
    }

    var effectiveSSHPort: Int {
        sshPort ?? 22
    }

    var sshTarget: String {
        "\(effectiveSSHUsername)@\(hostname)"
    }

    var sshKeySetupCommand: String {
        "ssh-copy-id -p \(effectiveSSHPort) \(sshTarget)"
    }

    var mconnectStartCommand: String {
        "npx lecoder-mconnect start --port \(port)"
    }

    var agentLoopCommand: String {
        effectiveAgentLoopPreset.commandTemplate
    }
}
