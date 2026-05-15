import SwiftUI

// MARK: - MConnectTheme

/// Design tokens for the mobile terminal UI.
///
/// Mirrors the canonical color/spacing values defined in
/// `docs/design/MOBILE-TERMINAL-DESIGN.md`. Use these tokens instead of
/// inline hex values so the iOS and web clients stay in sync.
enum MConnectTheme {
    // MARK: Backgrounds

    /// Pure black terminal canvas (`--bg-terminal`).
    static let bgTerminal = Color.black

    /// Translucent dark backdrop for the floating control pill (`--pill-bg`).
    static let pillBackground = Color.black.opacity(0.55)

    // MARK: Chips & pills

    /// Soft white background used for header chips and toolbar keys (`--chip-bg`).
    static let chipBackground = Color.white.opacity(0.95)

    /// Near-black foreground used on light chips (`--chip-fg`, #111827).
    static let chipForeground = Color(
        .sRGB,
        red: 0.067,
        green: 0.094,
        blue: 0.153,
        opacity: 1
    )

    /// White foreground used on the dark floating pill (`--pill-fg`).
    static let pillForeground = Color.white.opacity(0.9)

    // MARK: Status indicators

    /// Connected — green (`--status-connected`, #22c55e).
    static let statusConnected = Color(
        .sRGB,
        red: 0.133,
        green: 0.773,
        blue: 0.369,
        opacity: 1
    )

    /// Reconnecting — amber (`--status-reconnecting`, #f59e0b).
    static let statusReconnecting = Color(
        .sRGB,
        red: 0.961,
        green: 0.620,
        blue: 0.043,
        opacity: 1
    )

    /// Disconnected — red (`--status-disconnected`, #ef4444).
    static let statusDisconnected = Color(
        .sRGB,
        red: 0.937,
        green: 0.267,
        blue: 0.267,
        opacity: 1
    )

    // MARK: Layout metrics

    /// Sticky header band height.
    static let headerHeight: CGFloat = 56

    /// Hardware key pill height.
    static let keyHeight: CGFloat = 36

    /// Spacing between adjacent key pills.
    static let keyGap: CGFloat = 6
}
