import SwiftUI

// MARK: - SessionHeaderView

/// Sticky top header for the mobile terminal screen.
///
/// Three-region layout: a circular back button on the left, a tappable
/// `● Shell ⌄` session pill in the centre, and a `● Connected` connection
/// status pill on the right. The header is transparent so the terminal
/// canvas shows through behind the chips.
struct SessionHeaderView: View {
    /// Title shown in the centre pill (typically the active agent / session name).
    let sessionTitle: String

    /// Live WebSocket connection state — drives the status dot colour.
    let connectionState: ConnectionState

    /// Tapped on the back chevron (returns to the host list).
    let onBack: () -> Void

    /// Tapped on the centre session pill (opens session switcher).
    let onTapSession: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            backButton
            Spacer(minLength: 8)
            sessionPill
            Spacer(minLength: 8)
            connectionPill
        }
        .padding(.horizontal, 12)
        .frame(height: MConnectTheme.headerHeight)
        .frame(maxWidth: .infinity)
        .background(Color.clear)
    }

    // MARK: Subviews

    private var backButton: some View {
        Button(action: onBack) {
            Image(systemName: "chevron.left")
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(MConnectTheme.chipForeground)
                .frame(width: 36, height: 36)
                .background(
                    Circle().fill(MConnectTheme.chipBackground)
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Back")
    }

    private var sessionPill: some View {
        Button(action: onTapSession) {
            HStack(spacing: 6) {
                Circle()
                    .fill(MConnectTheme.statusConnected)
                    .frame(width: 8, height: 8)
                Text(sessionTitle)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(MConnectTheme.chipForeground)
                Image(systemName: "chevron.down")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(MConnectTheme.chipForeground.opacity(0.7))
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                Capsule().fill(MConnectTheme.chipBackground)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Session: \(sessionTitle)")
        .accessibilityHint("Tap to switch sessions")
    }

    private var connectionPill: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)
            Text(statusLabel)
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(MConnectTheme.chipForeground)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(
            Capsule().fill(MConnectTheme.chipBackground)
        )
        .accessibilityLabel("Connection: \(statusLabel)")
    }

    // MARK: Status mapping

    private var statusColor: Color {
        switch connectionState {
        case .connected:
            return MConnectTheme.statusConnected
        case .connecting, .authenticating, .reconnecting, .waitingForNetwork:
            return MConnectTheme.statusReconnecting
        case .disconnected:
            return MConnectTheme.statusDisconnected
        }
    }

    private var statusLabel: String {
        switch connectionState {
        case .connected: return "Connected"
        case .connecting: return "Connecting"
        case .authenticating: return "Authenticating"
        case .reconnecting: return "Reconnecting"
        case .waitingForNetwork: return "No Network"
        case .disconnected: return "Disconnected"
        }
    }
}

// MARK: - Preview

#Preview {
    ZStack {
        MConnectTheme.bgTerminal.ignoresSafeArea()
        VStack(spacing: 16) {
            SessionHeaderView(
                sessionTitle: "Shell",
                connectionState: .connected,
                onBack: {},
                onTapSession: {}
            )
            SessionHeaderView(
                sessionTitle: "Claude",
                connectionState: .reconnecting(attempt: 2),
                onBack: {},
                onTapSession: {}
            )
            SessionHeaderView(
                sessionTitle: "Shell",
                connectionState: .disconnected,
                onBack: {},
                onTapSession: {}
            )
            Spacer()
        }
    }
}
