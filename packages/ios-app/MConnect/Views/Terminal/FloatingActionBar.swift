import SwiftUI
import os

// MARK: - FloatingActionBar

struct FloatingActionBar: View {

    // MARK: - Configuration

    let items: [FloatingActionItem]

    /// Called when the user taps the terminal area externally; use onTerminalTap() to re-show.
    var onTerminalTap: (() -> Void)?

    // MARK: - Private State

    @AppStorage("fabAnchor") private var anchorRaw: String = "bottomTrailing"

    /// Offset applied on top of the anchor-derived base position.
    @State private var dragOffset: CGSize = .zero
    @State private var accumulatedOffset: CGSize = .zero

    @State private var isVisible: Bool = true
    @State private var fadeTask: Task<Void, Never>?

    @State private var showInfoSheet: Bool = false
    @State private var showHelpSheet: Bool = false
    @State private var showDisconnectAlert: Bool = false
    @State private var pendingDisconnectAction: (() -> Void)?

    @State private var longPressItem: FloatingActionItem?

    private let logger = Logger(subsystem: "com.lecoder.mconnect", category: "FloatingActionBar")
    private let signposter = OSSignposter(subsystem: "com.lecoder.mconnect", category: "FloatingActionBar")

    // MARK: - Body

    var body: some View {
        GeometryReader { geo in
            pill
                .position(position(in: geo.size))
                .gesture(drag)
                .opacity(isVisible ? 1 : 0.15)
                .animation(.easeInOut(duration: 0.3), value: isVisible)
        }
        .sheet(isPresented: $showInfoSheet) { InfoSheet() }
        .sheet(isPresented: $showHelpSheet) { HelpSheet() }
        .alert("Disconnect?", isPresented: $showDisconnectAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Disconnect", role: .destructive) { pendingDisconnectAction?() }
        } message: {
            Text("This will end the current session.")
        }
        .onAppear { scheduleFade() }
    }

    // MARK: - Pill

    private var pill: some View {
        HStack(spacing: 0) {
            ForEach(items) { item in
                fabButton(item)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(.ultraThinMaterial, in: Capsule())
        .shadow(color: .black.opacity(0.18), radius: 8, x: 0, y: 4)
    }

    @ViewBuilder
    private func fabButton(_ item: FloatingActionItem) -> some View {
        Button {
            handleTap(item)
        } label: {
            Image(systemName: item.systemImage)
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(item.isOn ? Color.accentColor : Color.primary)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(item.label)
        .onLongPressGesture(minimumDuration: 0.5) {
            longPressItem = item
        }
        .popover(isPresented: Binding(
            get: { longPressItem?.id == item.id },
            set: { if !$0 { longPressItem = nil } }
        )) {
            Text(item.label)
                .font(.footnote)
                .padding(10)
                .presentationCompactAdaptation(.popover)
        }
    }

    // MARK: - Drag

    private var drag: some Gesture {
        DragGesture()
            .onChanged { value in
                dragOffset = CGSize(
                    width: accumulatedOffset.width + value.translation.width,
                    height: accumulatedOffset.height + value.translation.height
                )
                resetFade()
            }
            .onEnded { value in
                accumulatedOffset = dragOffset
                anchorRaw = "custom"
            }
    }

    // MARK: - Positioning

    private func position(in size: CGSize) -> CGPoint {
        let base: CGPoint
        switch anchorRaw {
        case "bottomLeading":
            base = CGPoint(x: 80, y: size.height - 60)
        case "topTrailing":
            base = CGPoint(x: size.width - 80, y: 60)
        case "topLeading":
            base = CGPoint(x: 80, y: 60)
        default: // bottomTrailing + custom
            base = CGPoint(x: size.width / 2, y: size.height - 60)
        }

        return CGPoint(
            x: base.x + dragOffset.width,
            y: base.y + dragOffset.height
        )
    }

    // MARK: - Fade

    private func scheduleFade() {
        fadeTask?.cancel()
        fadeTask = Task {
            try? await Task.sleep(for: .seconds(3))
            guard !Task.isCancelled else { return }
            // If any item is pinned (keyboard-pinned), inhibit auto-fade
            let pinned = items.first(where: { $0.id == .pin })?.isOn ?? false
            if !pinned {
                await MainActor.run { isVisible = false }
            }
        }
    }

    private func resetFade() {
        isVisible = true
        scheduleFade()
    }

    /// Call this when the terminal area is tapped to re-show the FAB.
    func show() {
        isVisible = true
        scheduleFade()
    }

    // MARK: - Action Handling

    private func handleTap(_ item: FloatingActionItem) {
        logger.info("FAB tap: \(item.id.rawValue)")

        let state = signposter.beginInterval("fab.action", "\(item.id.rawValue)")

        switch item.id {
        case .info:
            showInfoSheet = true
        case .help:
            showHelpSheet = true
        case .disconnect:
            pendingDisconnectAction = item.action
            showDisconnectAlert = true
        default:
            item.action()
        }

        signposter.endInterval("fab.action", state)
        resetFade()
    }
}

// MARK: - InfoSheet

private struct InfoSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Session") {
                    LabeledContent("Host", value: "--")
                    LabeledContent("Agent", value: "--")
                    LabeledContent("Uptime", value: "--")
                    LabeledContent("Output", value: "--")
                }
            }
            .navigationTitle("Session Info")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

// MARK: - HelpSheet

private struct HelpSheet: View {
    @Environment(\.dismiss) private var dismiss

    private let bindings: [(String, String)] = [
        ("Ctrl+C", "Interrupt"),
        ("Ctrl+D", "EOF / logout"),
        ("Ctrl+Z", "Suspend"),
        ("Ctrl+L", "Clear screen"),
        ("Tab", "Autocomplete"),
        ("↑ / ↓", "Command history"),
    ]

    var body: some View {
        NavigationStack {
            List(bindings, id: \.0) { key, desc in
                LabeledContent(key, value: desc)
                    .font(.system(.body, design: .monospaced))
            }
            .navigationTitle("Key Bindings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
