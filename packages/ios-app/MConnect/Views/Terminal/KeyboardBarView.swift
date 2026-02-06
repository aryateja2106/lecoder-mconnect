import SwiftUI

struct KeyboardBarView: View {
    let onKey: (String) -> Void

    @State private var ctrlActive = false

    private let specialKeys: [(label: String, value: String)] = [
        ("Esc", "\u{1B}"),
        ("Tab", "\t"),
        ("Ctrl", ""),          // Toggle modifier
        ("↑", "\u{1B}[A"),
        ("↓", "\u{1B}[B"),
        ("←", "\u{1B}[D"),
        ("→", "\u{1B}[C"),
    ]

    // Common Ctrl+ shortcuts shown when Ctrl is active
    private let ctrlShortcuts: [(label: String, value: String)] = [
        ("C", "\u{03}"),   // Ctrl+C (interrupt)
        ("D", "\u{04}"),   // Ctrl+D (EOF)
        ("Z", "\u{1A}"),   // Ctrl+Z (suspend)
        ("L", "\u{0C}"),   // Ctrl+L (clear)
        ("A", "\u{01}"),   // Ctrl+A (home)
        ("E", "\u{05}"),   // Ctrl+E (end)
        ("R", "\u{12}"),   // Ctrl+R (reverse search)
    ]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                if ctrlActive {
                    // Show Ctrl shortcuts
                    ctrlToggleButton
                    ForEach(ctrlShortcuts, id: \.label) { shortcut in
                        Button(action: {
                            ctrlActive = false
                            onKey(shortcut.value)
                        }) {
                            Text("^\(shortcut.label)")
                                .font(.system(.caption, design: .monospaced))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(Color(.systemGray5))
                                .foregroundColor(.primary)
                                .cornerRadius(6)
                        }
                    }
                } else {
                    // Show standard special keys
                    ForEach(specialKeys, id: \.label) { key in
                        if key.label == "Ctrl" {
                            ctrlToggleButton
                        } else {
                            Button(action: { onKey(key.value) }) {
                                Text(key.label)
                                    .font(.system(.caption, design: .monospaced))
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .background(Color(.systemGray5))
                                    .foregroundColor(.primary)
                                    .cornerRadius(6)
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
        }
        .background(Color(.systemGray6))
    }

    private var ctrlToggleButton: some View {
        Button(action: { ctrlActive.toggle() }) {
            Text("Ctrl")
                .font(.system(.caption, design: .monospaced))
                .fontWeight(ctrlActive ? .bold : .regular)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(ctrlActive ? Color.accentColor : Color(.systemGray5))
                .foregroundColor(ctrlActive ? .white : .primary)
                .cornerRadius(6)
        }
    }
}
