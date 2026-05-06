import SwiftUI
import os

// MARK: - InputHintBanner

/// Dismissable first-time hint banner shown at the top of the terminal.
///
/// Shows hints for first 3 sessions per host, then auto-hides permanently.
/// Dismissal is persisted via AppStorage keyed on hostId.
struct InputHintBanner: View {
    let hostId: String

    @AppStorage private var hintsDismissed: Bool
    @AppStorage private var sessionCount: Int
    @State private var visible = false

    private static let maxSessions = 3
    private let logger = Logger(subsystem: "com.lecoder.mconnect", category: "InputHintBanner")

    private let hints = [
        ("keyboard", "Tap terminal to type"),
        ("doc.on.clipboard", "Long-press for copy/paste"),
        ("pin.fill", "Use Pin to keep keyboard visible"),
    ]

    init(hostId: String) {
        self.hostId = hostId
        _hintsDismissed = AppStorage(wrappedValue: false, "hintsDismissed_\(hostId)")
        _sessionCount   = AppStorage(wrappedValue: 0, "hintsSessionCount_\(hostId)")
    }

    var body: some View {
        if visible {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("Tips")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                    Spacer()
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }

                ForEach(hints, id: \.0) { icon, text in
                    Label(text, systemImage: icon)
                        .font(.caption)
                        .foregroundStyle(.primary)
                }
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 10))
            .padding(.horizontal, 12)
            .padding(.top, 6)
            .transition(.move(edge: .top).combined(with: .opacity))
        }
    }

    // MARK: - Lifecycle

    func onAppear() {
        guard !hintsDismissed else { return }
        let newCount = sessionCount + 1
        sessionCount = newCount
        if newCount <= Self.maxSessions {
            withAnimation(.easeIn(duration: 0.25)) { visible = true }
            let signposter = OSSignposter(logger: logger)
            let state = signposter.beginInterval("hint.shown")
            signposter.endInterval("hint.shown", state)
        } else {
            hintsDismissed = true
        }
    }

    // MARK: - Private

    private func dismiss() {
        let signposter = OSSignposter(logger: logger)
        let state = signposter.beginInterval("hint.dismissed")
        withAnimation(.easeOut(duration: 0.2)) { visible = false }
        hintsDismissed = true
        signposter.endInterval("hint.dismissed", state)
        logger.info("Hints dismissed by user for host \(hostId, privacy: .public)")
    }
}
