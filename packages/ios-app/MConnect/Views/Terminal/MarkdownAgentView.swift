import SwiftUI
import os

/// Chat-style markdown render of an agent's terminal output.
///
/// Pipeline: `TerminalBuffer.rawOutput` → `ANSIStripper.strip` → `MarkdownChunker.chunks` → render.
///
/// Mode is persisted per-agent via `@AppStorage("markdownMode_<agentId>")`.
/// When the mode is off, callers should display the normal terminal (SwiftTerm / TerminalEmulatorView)
/// instead of this view.
///
/// Long-press any chunk to copy its text to the clipboard.
struct MarkdownAgentView: View {

    // MARK: - Dependencies

    let agentId: String
    let buffer: TerminalBuffer

    // MARK: - State

    @AppStorage private var markdownMode: Bool

    @State private var chunks: [MarkdownChunker.Chunk] = []
    @State private var rawSnapshot: String = ""
    @State private var renderTask: Task<Void, Never>?

    // MARK: - Instrumentation

    private static let logger = Logger(subsystem: "com.lecoder.mconnect", category: "MarkdownAgentView")
    private static let renderSignpost = OSSignposter(subsystem: "com.lecoder.mconnect", category: "MarkdownAgentView")

    // MARK: - Init

    init(agentId: String, buffer: TerminalBuffer) {
        self.agentId = agentId
        self.buffer = buffer
        self._markdownMode = AppStorage(wrappedValue: false, "markdownMode_\(agentId)")
    }

    // MARK: - Body

    var body: some View {
        Group {
            if markdownMode {
                markdownContent
            } else {
                emptyModeHint
            }
        }
    }

    // MARK: - Markdown Content

    @ViewBuilder
    private var markdownContent: some View {
        if chunks.isEmpty {
            emptyState
        } else {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 8) {
                        ForEach(Array(chunks.enumerated()), id: \.offset) { index, chunk in
                            ChunkView(chunk: chunk)
                                .id(index)
                        }
                    }
                    .padding(12)
                    .id("markdownBottom")
                }
                .background(Color(.systemBackground))
                .onChange(of: chunks.count) { _, _ in
                    withAnimation(.easeOut(duration: 0.15)) {
                        proxy.scrollTo("markdownBottom", anchor: .bottom)
                    }
                }
            }
        }
    }

    // MARK: - Empty States

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "text.bubble")
                .font(.system(size: 40))
                .foregroundStyle(.secondary)
            Text("Markdown mode renders agent answers as chat.\nToggle off to see raw terminal.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }

    private var emptyModeHint: some View {
        VStack(spacing: 12) {
            Image(systemName: "text.bubble")
                .font(.system(size: 40))
                .foregroundStyle(.secondary)
            Text("Markdown mode renders agent answers as chat.\nToggle off to see raw terminal.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }

    // MARK: - Lifecycle

    var markdownModeBinding: Binding<Bool> {
        $markdownMode
    }
}

// MARK: - Task Management Extension

extension MarkdownAgentView {

    /// Called by the parent when new output arrives (or on appear).
    /// Re-renders only when the raw snapshot changes.
    func rerender(raw: String) {
        guard raw != rawSnapshot else { return }
        rawSnapshot = raw
        renderTask?.cancel()
        renderTask = Task {
            guard !Task.isCancelled else { return }
            let signpostID = Self.renderSignpost.makeSignpostID()
            let state = Self.renderSignpost.beginInterval("markdown.render", id: signpostID)
            let cleaned = ANSIStripper.strip(raw)
            let parsed = MarkdownChunker.chunks(from: cleaned)
            Self.renderSignpost.endInterval("markdown.render", state)
            Self.logger.debug("Rendered \(parsed.count) chunks for agent \(agentId)")
            guard !Task.isCancelled else { return }
            await MainActor.run { chunks = parsed }
        }
    }
}

// MARK: - ChunkView

private struct ChunkView: View {
    let chunk: MarkdownChunker.Chunk

    var body: some View {
        switch chunk {
        case .command(let text):
            CommandBubble(text: text)
        case .output(let text):
            OutputBubble(text: text)
        case .assistantMessage(let text):
            AssistantBubble(text: text)
        case .codeBlock(let language, let body):
            CodeBlockBubble(language: language, bodyText: body)
        }
    }
}

// MARK: - Bubble Subviews

private struct CommandBubble: View {
    let text: String
    @State private var copied = false

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text("$")
                .font(.system(size: 12, weight: .bold, design: .monospaced))
                .foregroundStyle(.secondary)
            Text(text)
                .font(.system(size: 12, weight: .regular, design: .monospaced))
                .foregroundStyle(.primary)
                .textSelection(.enabled)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .overlay(copiedBadge)
        .onLongPressGesture { copyToPasteboard(text) }
    }

    @ViewBuilder private var copiedBadge: some View {
        if copied {
            Text("Copied")
                .font(.caption2)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(.tint)
                .foregroundStyle(.white)
                .clipShape(Capsule())
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                .padding(4)
                .transition(.opacity)
        }
    }

    private func copyToPasteboard(_ text: String) {
        UIPasteboard.general.string = "$ \(text)"
        withAnimation { copied = true }
        Task {
            try? await Task.sleep(for: .seconds(1.5))
            await MainActor.run { withAnimation { copied = false } }
        }
    }
}

private struct OutputBubble: View {
    let text: String
    @State private var copied = false

    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .regular, design: .monospaced))
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .textSelection(.enabled)
            .overlay(copiedBadge)
            .onLongPressGesture { copyToPasteboard(text) }
    }

    @ViewBuilder private var copiedBadge: some View {
        if copied {
            Text("Copied")
                .font(.caption2)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(.tint)
                .foregroundStyle(.white)
                .clipShape(Capsule())
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                .transition(.opacity)
        }
    }

    private func copyToPasteboard(_ text: String) {
        UIPasteboard.general.string = text
        withAnimation { copied = true }
        Task {
            try? await Task.sleep(for: .seconds(1.5))
            await MainActor.run { withAnimation { copied = false } }
        }
    }
}

private struct AssistantBubble: View {
    let text: String
    @State private var copied = false

    var body: some View {
        Group {
            if let attributed = try? AttributedString(markdown: text) {
                Text(attributed)
            } else {
                Text(text)
            }
        }
        .font(.body)
        .foregroundStyle(.primary)
        .frame(maxWidth: .infinity, alignment: .leading)
        .textSelection(.enabled)
        .overlay(copiedBadge)
        .onLongPressGesture { copyToPasteboard(text) }
    }

    @ViewBuilder private var copiedBadge: some View {
        if copied {
            Text("Copied")
                .font(.caption2)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(.tint)
                .foregroundStyle(.white)
                .clipShape(Capsule())
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                .transition(.opacity)
        }
    }

    private func copyToPasteboard(_ text: String) {
        UIPasteboard.general.string = text
        withAnimation { copied = true }
        Task {
            try? await Task.sleep(for: .seconds(1.5))
            await MainActor.run { withAnimation { copied = false } }
        }
    }
}

private struct CodeBlockBubble: View {
    let language: String?
    let bodyText: String
    @State private var copied = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let lang = language {
                Text(lang)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 10)
                    .padding(.top, 6)
            }
            Text(bodyText)
                .font(.system(size: 12, weight: .regular, design: .monospaced))
                .foregroundStyle(.primary)
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .textSelection(.enabled)
        }
        .background(Color(.systemGray5))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(copiedBadge)
        .onLongPressGesture { copyToPasteboard(bodyText) }
    }

    @ViewBuilder private var copiedBadge: some View {
        if copied {
            Text("Copied")
                .font(.caption2)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(.tint)
                .foregroundStyle(.white)
                .clipShape(Capsule())
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                .padding(6)
                .transition(.opacity)
        }
    }

    private func copyToPasteboard(_ text: String) {
        UIPasteboard.general.string = text
        withAnimation { copied = true }
        Task {
            try? await Task.sleep(for: .seconds(1.5))
            await MainActor.run { withAnimation { copied = false } }
        }
    }
}
