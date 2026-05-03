import SwiftUI
import UIKit

#if canImport(SwiftTerm)
import SwiftTerm

/// UIViewRepresentable bridge that hosts SwiftTerm's TerminalView (UIKit class).
///
/// Use `SwiftTerm.TerminalView` everywhere — `TerminalView` (unqualified) collides with
/// MConnect's existing SwiftUI `TerminalView` struct.
///
/// Feeds raw PTY bytes from `TerminalBuffer` to SwiftTerm's VT100/xterm emulator,
/// reports user keyboard input back via the view model, and forwards terminal
/// size changes so the server can resize the PTY.
struct SwiftTermBridge: UIViewRepresentable {
    @ObservedObject var viewModel: TerminalViewModel

    func makeCoordinator() -> Coordinator {
        Coordinator(viewModel: viewModel)
    }

    func makeUIView(context: Context) -> SwiftTerm.TerminalView {
        // SwiftTerm's TerminalView requires an explicit font parameter
        let font = UIFont.monospacedSystemFont(ofSize: 13, weight: .regular)
        let tv = SwiftTerm.TerminalView(frame: .zero, font: font)
        tv.terminalDelegate = context.coordinator
        tv.backgroundColor = UIColor.black

        // Report initial terminal dimensions to the view model
        let cols = tv.getTerminal().cols
        let rows = tv.getTerminal().rows
        viewModel.handleTerminalSizeChange(cols: cols, rows: rows)

        return tv
    }

    func updateUIView(_ uiView: SwiftTerm.TerminalView, context: Context) {
        guard let agentId = viewModel.activeAgent?.id else { return }

        let raw = viewModel.terminalBuffer.rawOutput(forAgent: agentId)
        let last = context.coordinator.lastFedOutput

        // Agent switched or buffer cleared → reset and re-feed everything
        if raw.count < last.count || (raw.count == last.count && raw != last) {
            context.coordinator.lastFedOutput = ""
            feed(raw, into: uiView, coordinator: context.coordinator)
            return
        }

        // Append-only: feed only the new tail
        if raw.count > last.count {
            let newChunk = String(raw.dropFirst(last.count))
            feed(newChunk, into: uiView, coordinator: context.coordinator, fullRaw: raw)
        }
    }

    private func feed(_ chunk: String, into uiView: SwiftTerm.TerminalView, coordinator: Coordinator, fullRaw: String? = nil) {
        guard !chunk.isEmpty, let data = chunk.data(using: .utf8) else { return }
        data.withUnsafeBytes { raw in
            let buf = raw.bindMemory(to: UInt8.self)
            uiView.feed(byteArray: ArraySlice(buf))
        }
        coordinator.lastFedOutput = fullRaw ?? chunk
    }

    // MARK: - Coordinator
    //
    // Marked @MainActor so calls to main-actor-isolated TerminalViewModel methods
    // are valid. SwiftTerm fires delegate callbacks on the main thread already.

    @MainActor
    final class Coordinator: NSObject, TerminalViewDelegate {
        let viewModel: TerminalViewModel
        /// Tracks how much of the raw buffer has already been fed to SwiftTerm.
        var lastFedOutput: String = ""

        init(viewModel: TerminalViewModel) {
            self.viewModel = viewModel
        }

        // MARK: TerminalViewDelegate

        func send(source: SwiftTerm.TerminalView, data: ArraySlice<UInt8>) {
            viewModel.sendInputBytes(Data(data))
        }

        func sizeChanged(source: SwiftTerm.TerminalView, newCols: Int, newRows: Int) {
            viewModel.handleTerminalSizeChange(cols: newCols, rows: newRows)
        }

        func setTerminalTitle(source: SwiftTerm.TerminalView, title: String) {}

        func hostCurrentDirectoryUpdate(source: SwiftTerm.TerminalView, directory: String?) {}

        func scrolled(source: SwiftTerm.TerminalView, position: Double) {}

        func rangeChanged(source: SwiftTerm.TerminalView, startY: Int, endY: Int) {}

        func bell(source: SwiftTerm.TerminalView) {}

        func iTermContent(source: SwiftTerm.TerminalView, content: ArraySlice<UInt8>) {}

        func clipboardCopy(source: SwiftTerm.TerminalView, content: Data) {
            UIPasteboard.general.string = String(data: content, encoding: .utf8)
        }

        func requestOpenLink(source: SwiftTerm.TerminalView, link: String, params: [String: String]) {
            if let url = URL(string: link) {
                UIApplication.shared.open(url)
            }
        }
    }
}
#endif
