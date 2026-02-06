import SwiftUI

struct KeyboardBarView: View {
    let onKey: (String) -> Void

    private let specialKeys: [(label: String, value: String)] = [
        ("Esc", "\u{1B}"),
        ("Tab", "\t"),
        ("Ctrl", ""),
        ("↑", "\u{1B}[A"),
        ("↓", "\u{1B}[B"),
        ("←", "\u{1B}[D"),
        ("→", "\u{1B}[C"),
    ]

    @State private var ctrlActive = false

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(specialKeys, id: \.label) { key in
                    Button(action: { handleKey(key) }) {
                        Text(key.label)
                            .font(.system(.caption, design: .monospaced))
                            .fontWeight(key.label == "Ctrl" && ctrlActive ? .bold : .regular)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(
                                key.label == "Ctrl" && ctrlActive
                                    ? Color.accentColor
                                    : Color(.systemGray5)
                            )
                            .foregroundColor(
                                key.label == "Ctrl" && ctrlActive
                                    ? .white
                                    : .primary
                            )
                            .cornerRadius(6)
                    }
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
        }
        .background(Color(.systemGray6))
    }

    private func handleKey(_ key: (label: String, value: String)) {
        if key.label == "Ctrl" {
            ctrlActive.toggle()
        } else {
            if ctrlActive {
                // Send Ctrl+key combination
                ctrlActive = false
            }
            onKey(key.value)
        }
    }
}
