import SwiftUI

// MARK: - HardwareKeyAccessory

/// Two-row hardware-key accessory rendered above the iOS keyboard.
///
/// - Row 1 (modifiers): `Esc` `Tab` `Ctrl` `Shift` `Alt` `Cmd` `Del`
/// - Row 2 (navigation): `←` `↑` `↓` `→` `Home` `End` `PgUp` `PgDn`
///
/// `Ctrl`, `Shift`, `Alt` and `Cmd` are sticky toggles backed by
/// `StickyModifierState`. Arrows support 60ms key-repeat on long-press.
///
/// NOTE: Because this bar dispatches its own key strings via `onSendInput`,
/// modifiers only transform the *next* key tapped on the accessory bar
/// itself for this iteration. System-keyboard combinations (e.g. arming
/// `Ctrl` here, then typing `c` on the iOS keyboard) require additional
/// `UITextInput` plumbing and will be handled in a follow-up.
struct HardwareKeyAccessory: View {
    /// Sticky-modifier state machine. Owned by `MobileTerminalView`.
    @ObservedObject var modifierState: StickyModifierState

    /// Send a raw input string into the PTY.
    let onSendInput: (String) -> Void

    var body: some View {
        VStack(spacing: MConnectTheme.keyGap) {
            modifierRow
            navigationRow
        }
        .padding(.horizontal, 6)
        .padding(.top, 8)
        .padding(.bottom, 6)
        .frame(maxWidth: .infinity)
        .background(Color.black.opacity(0.92))
    }

    // MARK: Row 1 — modifiers

    private var modifierRow: some View {
        HStack(spacing: MConnectTheme.keyGap) {
            keyPill("Esc") { send("\u{1B}") }
            keyPill("Tab") { send("\t") }
            modifierPill("Ctrl", modifier: .ctrl)
            modifierPill("Shift", modifier: .shift)
            modifierPill("Alt", modifier: .alt)
            modifierPill("Cmd", modifier: .cmd)
            keyPill("Del") { send("\u{7F}") }
        }
    }

    // MARK: Row 2 — navigation

    private var navigationRow: some View {
        HStack(spacing: MConnectTheme.keyGap) {
            arrowPill(systemName: "arrow.left", sequence: "\u{1B}[D", label: "Left arrow")
            arrowPill(systemName: "arrow.up", sequence: "\u{1B}[A", label: "Up arrow")
            arrowPill(systemName: "arrow.down", sequence: "\u{1B}[B", label: "Down arrow")
            arrowPill(systemName: "arrow.right", sequence: "\u{1B}[C", label: "Right arrow")
            keyPill("Home") { send("\u{1B}[H") }
            keyPill("End") { send("\u{1B}[F") }
            keyPill("PgUp") { send("\u{1B}[5~") }
            keyPill("PgDn") { send("\u{1B}[6~") }
        }
    }

    // MARK: Pill builders

    @ViewBuilder
    private func keyPill(_ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                .foregroundColor(MConnectTheme.chipForeground)
                .frame(maxWidth: .infinity)
                .frame(height: MConnectTheme.keyHeight)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(MConnectTheme.chipBackground)
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    @ViewBuilder
    private func modifierPill(
        _ label: String,
        modifier: StickyModifierState.Modifier
    ) -> some View {
        let armed = modifierState.armed.contains(modifier)
        let locked = modifierState.locked.contains(modifier)
        let active = armed || locked

        Button(action: { modifierState.tap(modifier) }) {
            Text(label)
                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                .foregroundColor(active ? .white : MConnectTheme.chipForeground)
                .frame(maxWidth: .infinity)
                .frame(height: MConnectTheme.keyHeight)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(modifierBackground(armed: armed, locked: locked))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(
                            locked ? Color.accentColor : Color.clear,
                            lineWidth: 1.5
                        )
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityValue(locked ? "Locked" : (armed ? "Armed" : "Off"))
    }

    private func modifierBackground(armed: Bool, locked: Bool) -> Color {
        if locked { return Color.accentColor }
        if armed { return Color.accentColor.opacity(0.55) }
        return MConnectTheme.chipBackground
    }

    @ViewBuilder
    private func arrowPill(
        systemName: String,
        sequence: String,
        label: String
    ) -> some View {
        ArrowKeyButton(
            systemName: systemName,
            label: label,
            onTap: { send(sequence) },
            onRepeat: { onSendInput(sequence) }
        )
    }

    // MARK: Send helper

    /// Send a key string, applying any active modifiers and clearing
    /// the armed (non-locked) ones.
    private func send(_ raw: String) {
        let transformed = modifierState.transform(raw)
        modifierState.consume {
            onSendInput(transformed)
        }
    }
}

// MARK: - ArrowKeyButton

/// Arrow-key pill with 60ms long-press key repeat.
///
/// Tap fires `onTap` once. A long press starts a repeating timer that
/// fires `onRepeat` every 60ms until the gesture ends.
private struct ArrowKeyButton: View {
    let systemName: String
    let label: String
    let onTap: () -> Void
    let onRepeat: () -> Void

    @State private var repeatTimer: Timer?
    @State private var isPressed = false

    private let repeatInterval: TimeInterval = 0.060
    private let repeatStartDelay: TimeInterval = 0.350

    var body: some View {
        Image(systemName: systemName)
            .font(.system(size: 14, weight: .semibold))
            .foregroundColor(MConnectTheme.chipForeground)
            .frame(maxWidth: .infinity)
            .frame(height: MConnectTheme.keyHeight)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(
                        isPressed
                        ? MConnectTheme.chipBackground.opacity(0.7)
                        : MConnectTheme.chipBackground
                    )
            )
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in
                        guard !isPressed else { return }
                        isPressed = true
                        onTap()
                        scheduleRepeat()
                    }
                    .onEnded { _ in
                        cancelRepeat()
                        isPressed = false
                    }
            )
            .accessibilityLabel(label)
            .accessibilityAddTraits(.isButton)
    }

    private func scheduleRepeat() {
        cancelRepeat()
        // Wait briefly, then begin firing on a tight interval.
        let timer = Timer.scheduledTimer(
            withTimeInterval: repeatStartDelay,
            repeats: false
        ) { _ in
            let tick = Timer.scheduledTimer(
                withTimeInterval: repeatInterval,
                repeats: true
            ) { _ in
                onRepeat()
            }
            RunLoop.main.add(tick, forMode: .common)
            self.repeatTimer = tick
        }
        RunLoop.main.add(timer, forMode: .common)
        self.repeatTimer = timer
    }

    private func cancelRepeat() {
        repeatTimer?.invalidate()
        repeatTimer = nil
    }
}

// MARK: - Preview

#Preview {
    ZStack {
        MConnectTheme.bgTerminal.ignoresSafeArea()
        VStack {
            Spacer()
            HardwareKeyAccessory(
                modifierState: StickyModifierState(),
                onSendInput: { key in
                    print("key: \(key.debugDescription)")
                }
            )
        }
    }
}
