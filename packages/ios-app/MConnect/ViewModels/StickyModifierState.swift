import Foundation
import SwiftUI

// MARK: - StickyModifierState

/// Tracks the armed/locked state of the sticky modifier keys
/// (`Ctrl`, `Shift`, `Alt`, `Cmd`) shown in the hardware-key accessory.
///
/// State machine per modifier:
/// - Single tap → arm (consumed by the next key, then released)
/// - Double tap (within 350ms) → lock (persists until tapped again)
/// - Tap when locked → release
///
/// Pure logic, no UI. Designed for `@StateObject` ownership in
/// `MobileTerminalView`.
final class StickyModifierState: ObservableObject {
    // MARK: Modifier

    /// The four sticky modifiers represented in the accessory bar.
    enum Modifier: Hashable, CaseIterable {
        case ctrl
        case shift
        case alt
        case cmd
    }

    // MARK: Published state

    /// Modifiers armed for the next keystroke (cleared by `consume`).
    @Published private(set) var armed: Set<Modifier> = []

    /// Modifiers permanently locked until released by another tap.
    @Published private(set) var locked: Set<Modifier> = []

    // MARK: Private state

    /// Window for detecting a double-tap → lock transition.
    private let doubleTapWindow: TimeInterval = 0.35

    /// Last tap timestamp per modifier (for double-tap detection).
    private var lastTapAt: [Modifier: Date] = [:]

    // MARK: API

    /// Returns whether the given modifier is currently active (armed or locked).
    func isActive(_ mod: Modifier) -> Bool {
        return armed.contains(mod) || locked.contains(mod)
    }

    /// Returns whether the modifier is held in the "locked" state.
    func isLocked(_ mod: Modifier) -> Bool {
        return locked.contains(mod)
    }

    /// Single-tap handler that cycles the modifier through
    /// idle → armed → locked → idle. A second tap within
    /// `doubleTapWindow` of the first promotes "armed" to "locked".
    func tap(_ mod: Modifier) {
        let now = Date()
        let previous = lastTapAt[mod]
        lastTapAt[mod] = now

        // Locked → release.
        if locked.contains(mod) {
            locked.remove(mod)
            armed.remove(mod)
            return
        }

        // Armed and a recent prior tap → promote to locked.
        if armed.contains(mod),
           let prev = previous,
           now.timeIntervalSince(prev) <= doubleTapWindow {
            armed.remove(mod)
            locked.insert(mod)
            return
        }

        // Idle → armed.
        if armed.contains(mod) {
            // Slow second tap on an armed modifier: release.
            armed.remove(mod)
        } else {
            armed.insert(mod)
        }
    }

    /// Run `keyEvent`, then clear all *armed* (non-locked) modifiers.
    /// Locked modifiers remain in effect until the user taps them again.
    func consume(for keyEvent: () -> Void) {
        keyEvent()
        armed.removeAll()
    }

    /// Transform a single key character according to the active modifiers.
    ///
    /// Currently this only implements the `Ctrl + ascii letter`
    /// transformation (e.g. `Ctrl+C` → `\u{03}`). Other modifiers fall
    /// through unchanged for this iteration. Real cross-modifier combos
    /// (Shift+Tab, Alt+arrow, etc.) will be added once the system-keyboard
    /// hand-off is in place.
    func transform(_ char: String) -> String {
        guard isActive(.ctrl), char.count == 1,
              let ascii = char.uppercased().first?.asciiValue,
              ascii >= 0x40, ascii <= 0x5F else {
            return char
        }
        let value = ascii - 0x40
        return String(UnicodeScalar(value))
    }

    /// Hard-reset (used when the terminal disconnects, etc.).
    func clearAll() {
        armed.removeAll()
        locked.removeAll()
        lastTapAt.removeAll()
    }
}
