import SwiftUI

// MARK: - FloatingControlPill

/// Translucent floating control pill that hovers above the keyboard.
///
/// Five round buttons — mic, keyboard toggle, AI sparkles, settings,
/// dismiss. Backdrop is `.ultraThinMaterial` over a 55% black tint so it
/// reads as a "glassy" iOS control on the dark terminal canvas.
struct FloatingControlPill: View {
    /// Voice-to-text dictation.
    let onMic: () -> Void

    /// Toggle the iOS system keyboard.
    let onToggleKeyboard: () -> Void

    /// Open the quick AI / agent action sheet.
    let onAI: () -> Void

    /// Open session settings (font size, theme, keep-alive).
    let onSettings: () -> Void

    /// Dismiss the pill.
    let onDismiss: () -> Void

    private let pillHeight: CGFloat = 48
    private let pillWidth: CGFloat = 280
    private let buttonSize: CGFloat = 36

    var body: some View {
        HStack(spacing: 0) {
            pillButton(systemName: "mic.fill", label: "Microphone", action: onMic)
            Spacer(minLength: 0)
            pillButton(systemName: "keyboard", label: "Keyboard", action: onToggleKeyboard)
            Spacer(minLength: 0)
            pillButton(systemName: "sparkles", label: "AI actions", action: onAI)
            Spacer(minLength: 0)
            pillButton(systemName: "slider.horizontal.3", label: "Settings", action: onSettings)
            Spacer(minLength: 0)
            pillButton(systemName: "xmark", label: "Dismiss", action: onDismiss)
        }
        .padding(.horizontal, 12)
        .frame(width: pillWidth, height: pillHeight)
        .background(
            ZStack {
                Capsule().fill(.ultraThinMaterial)
                Capsule().fill(MConnectTheme.pillBackground)
            }
        )
        .overlay(
            Capsule().stroke(Color.white.opacity(0.08), lineWidth: 0.5)
        )
        .shadow(color: .black.opacity(0.35), radius: 16, x: 0, y: 6)
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }

    // MARK: Subviews

    @ViewBuilder
    private func pillButton(
        systemName: String,
        label: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(MConnectTheme.pillForeground)
                .frame(width: buttonSize, height: buttonSize)
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

// MARK: - Preview

#Preview {
    ZStack {
        MConnectTheme.bgTerminal.ignoresSafeArea()
        VStack {
            Spacer()
            FloatingControlPill(
                onMic: {},
                onToggleKeyboard: {},
                onAI: {},
                onSettings: {},
                onDismiss: {}
            )
            .padding(.bottom, 32)
        }
    }
}
