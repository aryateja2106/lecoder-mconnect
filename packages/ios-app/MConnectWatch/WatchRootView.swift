import SwiftUI

struct WatchRootView: View {
    @StateObject private var store = WatchSessionStore()
    @State private var prompt = ""

    private let quickPrompts = [
        "Give me the current status.",
        "Summarize the last result.",
        "Continue with the next safe step.",
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    statusBlock
                    usageBlock
                    commandBlock
                    quickPromptBlock
                }
                .padding(.horizontal, 2)
            }
            .navigationTitle("MConnect")
        }
        .onAppear {
            store.activate()
        }
    }

    private var statusBlock: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(store.summary.hostName)
                .font(.headline)
                .lineLimit(1)

            Text(store.summary.activeAgentName ?? "No active agent")
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)

            HStack(spacing: 6) {
                Circle()
                    .fill(store.summary.connectionState.statusColor)
                    .frame(width: 7, height: 7)
                Text(store.summary.connectionState.label)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var usageBlock: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("Usage")
                .font(.caption2)
                .foregroundStyle(.secondary)

            if let totalTokens = store.summary.usage.totalTokens {
                Text("\(totalTokens) tokens")
                    .font(.system(.caption, design: .monospaced))
                if let cost = store.summary.usage.costUsd {
                    Text(cost, format: .currency(code: "USD"))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            } else {
                Text(store.summary.usage.errorMessage ?? "Unavailable")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var commandBlock: some View {
        VStack(alignment: .leading, spacing: 6) {
            TextField("Dictate prompt", text: $prompt)
                .textInputAutocapitalization(.sentences)

            Button {
                sendPrompt(prompt)
            } label: {
                Label("Send", systemImage: "paperplane.fill")
            }
            .disabled(prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
    }

    private var quickPromptBlock: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(quickPrompts, id: \.self) { text in
                Button {
                    sendPrompt(text)
                } label: {
                    Text(text)
                        .lineLimit(2)
                }
            }

            if let sendStatus = store.lastSendStatus {
                Text(sendStatus)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func sendPrompt(_ text: String) {
        store.sendPrompt(text)
        prompt = ""
    }
}

private extension WatchConnectionState {
    var label: String {
        switch self {
        case .connected: return "Connected"
        case .connecting: return "Connecting"
        case .authenticating: return "Auth"
        case .reconnecting: return "Reconnecting"
        case .waitingForNetwork: return "No Network"
        case .disconnected: return "Offline"
        }
    }

    var statusColor: Color {
        switch self {
        case .connected: return .green
        case .connecting, .authenticating: return .yellow
        case .reconnecting, .waitingForNetwork: return .orange
        case .disconnected: return .gray
        }
    }
}
