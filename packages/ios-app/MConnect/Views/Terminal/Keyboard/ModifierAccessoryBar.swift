import SwiftUI
import os

// MARK: - ModifierAccessoryBar

/// Two-row accessory bar that sits above the iOS keyboard inside the terminal.
///
/// Row 1 — modifier toggles: Esc, Tab, Ctrl, Shift, Alt, Cmd, Del
/// Row 2 — navigation: ←, ↑, ↓, →, Home, End, PgUp, PgDn
///
/// Modifier keys are "sticky" (one-shot): arm one or more, then tap a nav or
/// letter key and the modifier is applied then automatically disarmed.
///
/// `onSend` is called with the resulting `Data` byte sequence.
public struct ModifierAccessoryBar: View {

    // MARK: Dependencies

    /// Sticky modifier engine (injected so tests / previews can share state).
    @ObservedObject private var engine: ModifierBarEngine

    /// Called with the byte sequence to write to the terminal.
    public let onSend: (Data) -> Void

    // MARK: Init

    public init(engine: ModifierBarEngine? = nil, onSend: @escaping (Data) -> Void) {
        self.engine = engine ?? ModifierBarEngine()
        self.onSend = onSend
    }

    // MARK: Body

    public var body: some View {
        VStack(spacing: 4) {
            modifierRow
            navigationRow
        }
        .padding(.vertical, 6)
        .background(Color(.systemGray6))
    }

    // MARK: - Row 1: Modifier Toggles

    private var modifierRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                // Standalone special keys (not toggles)
                specialKeyButton(label: "Esc",  keyName: "Esc")
                specialKeyButton(label: "Tab",  keyName: "Tab")

                // Toggle modifiers
                modifierToggleButton(.ctrl,  label: "Ctrl")
                modifierToggleButton(.shift, label: "Shift")
                modifierToggleButton(.alt,   label: "Alt")
                modifierToggleButton(.cmd,   label: "Cmd")

                // Del (standalone)
                specialKeyButton(label: "Del", keyName: "Del")
            }
            .padding(.horizontal, 8)
        }
    }

    // MARK: - Row 2: Navigation

    private var navigationRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                specialKeyButton(label: "←",    keyName: "Left")
                specialKeyButton(label: "↑",    keyName: "Up")
                specialKeyButton(label: "↓",    keyName: "Down")
                specialKeyButton(label: "→",    keyName: "Right")
                specialKeyButton(label: "Home", keyName: "Home")
                specialKeyButton(label: "End",  keyName: "End")
                specialKeyButton(label: "PgUp", keyName: "PgUp")
                specialKeyButton(label: "PgDn", keyName: "PgDn")
            }
            .padding(.horizontal, 8)
        }
    }

    // MARK: - Button Builders

    /// A key that applies current modifiers then sends data.
    private func specialKeyButton(label: String, keyName: String) -> some View {
        Button {
            let data = engine.consume(keyName)
            onSend(data)
        } label: {
            pillLabel(label, isActive: false)
        }
    }

    /// A toggle for a modifier key; highlights blue when armed.
    private func modifierToggleButton(_ key: ModifierKey, label: String) -> some View {
        Button {
            engine.toggle(key)
        } label: {
            pillLabel(label, isActive: engine.isArmed(key))
        }
    }

    // MARK: - Pill Style

    private func pillLabel(_ text: String, isActive: Bool) -> some View {
        Text(text)
            .font(.system(.caption, design: .monospaced))
            .fontWeight(isActive ? .semibold : .regular)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(isActive ? Color.accentColor : Color(.systemGray5))
            .foregroundColor(isActive ? .white : .primary)
            .clipShape(Capsule())
    }
}

// MARK: - ModifierBarEngine (ObservableObject bridge)

/// Main-actor `ObservableObject` that wraps `StickyModifier` for SwiftUI.
/// Keeps armed-state in published properties so the view re-renders on toggle.
@MainActor
public final class ModifierBarEngine: ObservableObject {

    @Published private(set) var armedKeys: Set<ModifierKey> = []

    private let sticky = StickyModifier()
    private let logger = Logger(subsystem: "com.lecoder.mconnect", category: "ModifierBar")

    public init() {}

    public func toggle(_ key: ModifierKey) {
        Task { @MainActor in
            await sticky.toggle(key)
            armedKeys = await sticky.armed
        }
    }

    public func isArmed(_ key: ModifierKey) -> Bool {
        armedKeys.contains(key)
    }

    public func consume(_ keyName: String) -> Data {
        // Snapshot armed keys for synchronous return, then reset via actor.
        var result = Data()
        let semaphore = DispatchSemaphore(value: 0)
        Task {
            result = await sticky.consume(keyName)
            await MainActor.run { self.armedKeys = [] }
            semaphore.signal()
        }
        semaphore.wait()
        return result
    }
}

// MARK: - Preview

#if DEBUG
#Preview {
    ModifierAccessoryBar { data in
        print("Sent: \(data as NSData)")
    }
    .previewDisplayName("Modifier Accessory Bar")
}
#endif
