import SwiftUI

#if canImport(SwiftTerm)
import SwiftTerm

/// UIViewRepresentable bridge that hosts SwiftTerm's TerminalView.
///
/// Feeds raw PTY bytes from TerminalBuffer to SwiftTerm's VT100/xterm emulator,
/// reports user keyboard input back via the view model, and forwards terminal
/// size changes so the server can resize the PTY.
struct SwiftTermBridge: UIViewRepresentable {
    @ObservedObject var viewModel: TerminalViewModel

    func makeCoordinator() -> Coordinator {
        Coordinator(viewModel: viewModel)
    }

    func makeUIView(context: Context) -> TerminalView {
        let tv = TerminalView(frame: .zero)
        tv.terminalDelegate = context.coordinator
        tv.backgroundColor = .black

        // Report initial terminal dimensions once the view is set up
        let cols = tv.getTerminal().cols
        let rows = tv.getTerminal().rows
        viewModel.handleTerminalSizeChange(cols: cols, rows: rows)

        return tv
    }

    func updateUIView(_ uiView: TerminalView, context: Context) {
        guard let agentId = viewModel.activeAgent?.id else { return }

        let raw = viewModel.terminalBuffer.rawOutput(forAgent: agentId)
        let last = context.coordinator.lastFedOutput

        // Only feed bytes that haven't been fed yet
        guard raw.count > last.count else {
            // Agent switched or buffer cleared — reset and re-feed everything
            if raw != last {
                context.coordinator.lastFedOutput = ""
                if !raw.isEmpty, let data = raw.data(using: .utf8) {
                    data.withUnsafeBytes { raw in
                        let buf = raw.bindMemory(to: UInt8.self)
                        uiView.feed(byteArray: ArraySlice(buf))
                    }
                    context.coordinator.lastFedOutput = raw
                }
            }
            return
        }

        let newChunk = String(raw.dropFirst(last.count))
        if !newChunk.isEmpty, let data = newChunk.data(using: .utf8) {
            data.withUnsafeBytes { rawBuf in
                let buf = rawBuf.bindMemory(to: UInt8.self)
                uiView.feed(byteArray: ArraySlice(buf))
            }
            context.coordinator.lastFedOutput = raw
        }
    }

    // MARK: - Coordinator

    final class Coordinator: NSObject, TerminalViewDelegate {
        let viewModel: TerminalViewModel
        /// Tracks how much of the raw buffer has already been fed to SwiftTerm.
        var lastFedOutput: String = ""

        init(viewModel: TerminalViewModel) {
            self.viewModel = viewModel
        }

        // MARK: TerminalViewDelegate

        func send(source: TerminalView, data: ArraySlice<UInt8>) {
            viewModel.sendInputBytes(Data(data))
        }

        func sizeChanged(source: TerminalView, newCols: Int, newRows: Int) {
            viewModel.handleTerminalSizeChange(cols: newCols, rows: newRows)
        }

        func setTerminalTitle(source: TerminalView, title: String) {}

        func hostCurrentDirectoryUpdate(source: TerminalView, directory: String?) {}

        func scrolled(source: TerminalView, position: Double) {}

        func rangeChanged(source: TerminalView, startY: Int, endY: Int) {}

        func clipboardCopy(source: TerminalView, content: Data) {
            UIPasteboard.general.string = String(data: content, encoding: .utf8)
        }

        func requestOpenLink(source: TerminalView, link: String, params: [String: String]) {
            if let url = URL(string: link) {
                UIApplication.shared.open(url)
            }
        }
    }
}
#endif
