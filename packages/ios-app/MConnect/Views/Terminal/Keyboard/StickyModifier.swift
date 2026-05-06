import Foundation
import os

// MARK: - Modifier Keys

/// Modifier keys that can be "armed" in the accessory bar.
public enum ModifierKey: String, CaseIterable, Sendable {
    case ctrl  = "Ctrl"
    case shift = "Shift"
    case alt   = "Alt"
    case cmd   = "Cmd"
}

// MARK: - StickyModifier

/// Pure-logic actor managing which modifiers are currently armed.
/// One-shot: after a non-modifier key consumes state, all modifiers reset.
public actor StickyModifier {

    // MARK: State

    private(set) var armed: Set<ModifierKey> = []

    // MARK: Instrumentation

    private let logger = Logger(subsystem: "com.lecoder.mconnect", category: "ModifierBar")
    private let signposter = OSSignposter(subsystem: "com.lecoder.mconnect", category: "ModifierBar")

    // MARK: - Toggle

    /// Arms or disarms a modifier key.
    public func toggle(_ key: ModifierKey) {
        if armed.contains(key) {
            armed.remove(key)
            logger.debug("Modifier disarmed: \(key.rawValue)")
        } else {
            armed.insert(key)
            logger.debug("Modifier armed: \(key.rawValue)")
        }
    }

    /// Returns `true` if the given modifier is currently armed.
    public func isArmed(_ key: ModifierKey) -> Bool {
        armed.contains(key)
    }

    // MARK: - Consume

    /// Applies the currently-armed modifiers to `char`, returns the resulting byte sequence.
    /// Resets all modifiers afterwards (one-shot semantics).
    ///
    /// - Parameter char: The character or special key name to consume.
    ///   Special names: "Esc", "Tab", "Del", "Home", "End", "PgUp", "PgDn",
    ///                  "Up", "Down", "Left", "Right".
    /// - Returns: `Data` containing the appropriate byte sequence.
    public func consume(_ char: String) -> Data {
        let signpostID = signposter.makeSignpostID()
        let state = signposter.beginInterval("modifier.consume", id: signpostID)
        defer {
            signposter.endInterval("modifier.consume", state)
            logger.debug("Consumed '\(char)' with modifiers: \(self.armed.map(\.rawValue).joined(separator: "+"))")
            armed.removeAll()
        }

        // Special keys — always emit ANSI sequences regardless of modifiers
        if let sequence = Self.specialKeySequence(char, modifiers: armed) {
            return Data(sequence.utf8)
        }

        // Ctrl modifier: single ASCII character a-z → 0x01-0x1A
        if armed.contains(.ctrl), char.count == 1,
           let ascii = char.lowercased().unicodeScalars.first?.value,
           ascii >= 97 && ascii <= 122 {
            let controlByte = UInt8(ascii - 96)  // 'a'=97 → 0x01, 'z'=122 → 0x1A
            return Data([controlByte])
        }

        // Cmd modifier: emit a logical Cmd-X sentinel (apps can intercept)
        if armed.contains(.cmd), char.count == 1 {
            // Emit ESC + [ + "Cmd:" + char as a private out-of-band signal.
            // OS menu integration is deferred; this is the logical signal.
            let sentinel = "\u{1B}[Cmd:\(char)"
            return Data(sentinel.utf8)
        }

        // Alt/Option modifier: prefix with ESC (xterm meta convention)
        if armed.contains(.alt), char.count == 1 {
            return Data("\u{1B}\(char)".utf8)
        }

        // Shift modifier alone with a printable char: pass through as-is
        // (the caller's keyboard already handles shifted characters)
        return Data(char.utf8)
    }

    // MARK: - Special Key Sequences

    private static func specialKeySequence(_ name: String, modifiers: Set<ModifierKey>) -> String? {
        // Build modifier parameter for CSI sequences (Xterm modifier encoding)
        // modifier param = (shift?1:0) | (alt?2:0) | (ctrl?4:0) + 1
        let modParam: Int = {
            var m = 0
            if modifiers.contains(.shift) { m |= 1 }
            if modifiers.contains(.alt)   { m |= 2 }
            if modifiers.contains(.ctrl)  { m |= 4 }
            if modifiers.contains(.cmd)   { m |= 8 }
            return m + 1
        }()
        let hasMod = modParam > 1

        switch name {
        case "Esc":
            return "\u{1B}"
        case "Tab":
            if modifiers.contains(.shift) {
                return "\u{1B}[Z"   // CSI Z = reverse tab
            }
            return "\t"
        case "Del":
            return "\u{7F}"         // DEL / Backspace
        case "Home":
            return hasMod ? "\u{1B}[1;\(modParam)H" : "\u{1B}[H"
        case "End":
            return hasMod ? "\u{1B}[1;\(modParam)F" : "\u{1B}[F"
        case "PgUp":
            return hasMod ? "\u{1B}[5;\(modParam)~" : "\u{1B}[5~"
        case "PgDn":
            return hasMod ? "\u{1B}[6;\(modParam)~" : "\u{1B}[6~"
        case "Up":
            return hasMod ? "\u{1B}[1;\(modParam)A" : "\u{1B}[A"
        case "Down":
            return hasMod ? "\u{1B}[1;\(modParam)B" : "\u{1B}[B"
        case "Left":
            return hasMod ? "\u{1B}[1;\(modParam)D" : "\u{1B}[D"
        case "Right":
            return hasMod ? "\u{1B}[1;\(modParam)C" : "\u{1B}[C"
        default:
            return nil
        }
    }
}
