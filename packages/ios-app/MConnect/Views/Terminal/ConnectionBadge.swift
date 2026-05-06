import SwiftUI
import os

// MARK: - ConnectionBadge

/// Top-right corner pill showing connection state with dot + label.
/// Tap to reconnect when disconnected, or disconnect when connected.
struct ConnectionBadge: View {
    let state: ConnectionState
    let onReconnect: () -> Void
    let onDisconnect: () -> Void

    private let logger = Logger(subsystem: "com.lecoder.mconnect", category: "ConnectionBadge")

    var body: some View {
        Button(action: handleTap) {
            HStack(spacing: 5) {
                Circle()
                    .fill(dotColor)
                    .frame(width: 7, height: 7)
                Text(label)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.primary)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(.regularMaterial, in: Capsule())
        }
        .buttonStyle(.plain)
    }

    private func handleTap() {
        switch state {
        case .connected:
            logger.info("User tapped badge — disconnecting")
            onDisconnect()
        case .disconnected, .waitingForNetwork:
            logger.info("User tapped badge — reconnecting")
            onReconnect()
        case .connecting, .authenticating, .reconnecting:
            break // no-op while in-progress
        }
    }

    private var label: String {
        switch state {
        case .connected:           return "Connected"
        case .connecting:          return "Connecting"
        case .authenticating:      return "Authenticating"
        case .reconnecting(let n): return "Reconnecting (\(n))"
        case .waitingForNetwork:   return "Offline"
        case .disconnected:        return "Disconnected"
        }
    }

    private var dotColor: Color {
        switch state {
        case .connected:                    return .green
        case .connecting, .authenticating:  return .yellow
        case .reconnecting:                 return .orange
        case .waitingForNetwork:            return .orange
        case .disconnected:                 return .red
        }
    }
}

// MARK: - ConnectionStatusOverlay

/// Full-screen overlay shown when not connected.
/// Shows a CTA "Reconnect" button when disconnected.
struct ConnectionStatusOverlay: View {
    let state: ConnectionState
    let onReconnect: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            if state == .waitingForNetwork {
                Image(systemName: "wifi.slash")
                    .font(.title2)
                    .foregroundStyle(.white)
            } else if state == .disconnected {
                Image(systemName: "bolt.slash.fill")
                    .font(.title2)
                    .foregroundStyle(.white)
            } else {
                ProgressView()
                    .tint(.white)
            }

            Text(statusText)
                .font(.subheadline)
                .foregroundStyle(.white)

            if let subtitle = statusSubtitle {
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.7))
                    .multilineTextAlignment(.center)
            }

            if state == .disconnected || state == .waitingForNetwork {
                Button("Reconnect", action: onReconnect)
                    .buttonStyle(.borderedProminent)
                    .controlSize(.regular)
                    .padding(.top, 4)
            }
        }
        .padding(24)
        .background(.ultraThinMaterial.opacity(0.9))
        .background(Color.black.opacity(0.5))
        .cornerRadius(16)
    }

    private var statusText: String {
        switch state {
        case .disconnected:            return "Disconnected"
        case .connecting:              return "Connecting..."
        case .authenticating:          return "Authenticating..."
        case .connected:               return "Connected"
        case .reconnecting(let n):     return "Reconnecting (\(n))..."
        case .waitingForNetwork:       return "No Network"
        }
    }

    private var statusSubtitle: String? {
        switch state {
        case .waitingForNetwork:
            return "Will reconnect when network is available"
        case .reconnecting:
            return "Session will be restored automatically"
        case .disconnected:
            return "Start a session via `mconnect start` on the host"
        default:
            return nil
        }
    }
}
