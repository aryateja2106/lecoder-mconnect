#if canImport(SwiftTerm)
import SwiftUI
import SwiftTerm
import UIKit
import os

// MARK: - Notification Names

extension Notification.Name {
    static let terminalSelectionCopy = Notification.Name("com.lecoder.mconnect.terminal.selectionCopy")
    static let terminalPasteRequest  = Notification.Name("com.lecoder.mconnect.terminal.pasteRequest")
}

// MARK: - SwiftTermBridge

/// UIViewRepresentable wrapper for SwiftTerm's SwiftTerm.TerminalView.
///
/// Features:
/// - Auto-focus via invisible tap recognizer overlay (more reliable than SwiftUI .onTapGesture)
/// - Input accessory view injection via `accessoryViewProvider` closure
/// - Hardware keyboard commands: Cmd+C, Cmd+V, Cmd+K, Cmd+L
/// - os.Logger + os.signpost instrumentation
/// - Selection bridge: `coordinator.getSelectedText()`
struct SwiftTermBridge: UIViewRepresentable {
    @ObservedObject var viewModel: TerminalViewModel

    /// Optional factory for the input accessory view shown above the iOS keyboard.
    /// Lead/W1 will supply the ModifierAccessoryBar UIView here at integration time.
    var accessoryViewProvider: (() -> UIView)? = nil

    // MARK: makeUIView

    func makeUIView(context: Context) -> SwiftTerm.TerminalView {
        let tv = SwiftTerm.TerminalView(frame: .zero)
        tv.terminalDelegate = context.coordinator
        tv.backgroundColor = .black

        // Inject accessory view if provided
        if let provider = accessoryViewProvider {
            tv.inputAccessoryView = provider()
        }

        // Report initial terminal size
        let term = tv.getTerminal()
        viewModel.handleTerminalSizeChange(cols: term.cols, rows: term.rows)

        // Overlay tap recognizer — more reliable than SwiftUI .onTapGesture for first-responder
        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleTap(_:)))
        tap.cancelsTouchesInView = false
        tv.addGestureRecognizer(tap)

        // Hardware keyboard: SwiftTerm.TerminalView is a UIResponder/UITextInput
        // and routes key events through its built-in handlers. Cmd+C/V/A
        // bindings are exposed via UIEditMenuInteraction in SelectionMenu.swift.

        context.coordinator.terminalView = tv
        return tv
    }

    // MARK: updateUIView

    func updateUIView(_ tv: SwiftTerm.TerminalView, context: Context) {
        guard let agentId = viewModel.activeAgent?.id else { return }

        let raw = viewModel.terminalBuffer.rawOutput(forAgent: agentId)
        let coord = context.coordinator

        guard raw != coord.lastFedOutput else { return }

        let newData = String(raw.dropFirst(coord.lastFedOutput.count))
        coord.lastFedOutput = raw

        if let bytes = newData.data(using: .utf8) {
            let signposter = OSSignposter(logger: coord.log)
            let state = signposter.beginInterval("output.feed")
            tv.feed(byteArray: ArraySlice<UInt8>(bytes))
            signposter.endInterval("output.feed", state)
        }
    }

    // MARK: makeCoordinator

    func makeCoordinator() -> Coordinator {
        Coordinator(viewModel: viewModel)
    }

    // MARK: - Coordinator

    @MainActor
    final class Coordinator: NSObject, TerminalViewDelegate {
        let viewModel: TerminalViewModel
        var lastFedOutput: String = ""
        var isFocused: Bool = false
        weak var terminalView: SwiftTerm.TerminalView?

        let log = Logger(subsystem: "com.lecoder.mconnect", category: "SwiftTermBridge")
        private let signposter: OSSignposter

        init(viewModel: TerminalViewModel) {
            self.viewModel = viewModel
            self.signposter = OSSignposter(logger: Logger(subsystem: "com.lecoder.mconnect", category: "SwiftTermBridge"))
        }

        // MARK: Focus

        /// Programmatically focus the terminal view and pop the keyboard.
        func focus(animated: Bool) {
            guard let tv = terminalView else { return }
            let state = signposter.beginInterval("terminal.firstResponder.acquired")
            _ = tv.becomeFirstResponder()
            signposter.endInterval("terminal.firstResponder.acquired", state)
            isFocused = true
            log.debug("focus(animated:\(animated)) -> becomeFirstResponder")
        }

        @objc func handleTap(_ recognizer: UITapGestureRecognizer) {
            focus(animated: true)
        }

        // MARK: Hardware Keyboard Commands

        @objc func hwCmdC() {
            log.debug("hw-kb: Cmd+C — posting selectionCopy")
            NotificationCenter.default.post(name: .terminalSelectionCopy, object: terminalView)
        }

        @objc func hwCmdV() {
            log.debug("hw-kb: Cmd+V — posting pasteRequest")
            NotificationCenter.default.post(name: .terminalPasteRequest, object: terminalView)
        }

        @objc func hwCmdK(_ sender: UIKeyCommand) {
            // Cmd+K: clear screen via Ctrl+L (0x0C)
            log.debug("hw-kb: Cmd+K — sending clear screen")
            viewModel.sendKey("\u{0C}")
        }

        @objc func hwCmdL(_ sender: UIKeyCommand) {
            // Cmd+L: Ctrl+L clear screen
            log.debug("hw-kb: Cmd+L — sending Ctrl+L")
            viewModel.sendKey("\u{0C}")
        }

        // MARK: Selection Bridge

        /// Returns selected text if a selection is active, nil otherwise.
        func getSelectedText() -> String? {
            guard let tv = terminalView else { return nil }
            let selected = tv.getSelection()
            return (selected?.isEmpty ?? true) ? nil : selected
        }

        // MARK: TerminalViewDelegate

        func send(source: SwiftTerm.TerminalView, data: ArraySlice<UInt8>) {
            let state = signposter.beginInterval("input.send")
            let text = String(bytes: data, encoding: .utf8) ?? ""
            viewModel.sendInput(text)
            signposter.endInterval("input.send", state)
            log.debug("send: \(data.count) bytes")
        }

        func sizeChanged(source: SwiftTerm.TerminalView, newCols: Int, newRows: Int) {
            viewModel.handleTerminalSizeChange(cols: newCols, rows: newRows)
            log.debug("sizeChanged: \(newCols)x\(newRows)")
        }

        func setTerminalTitle(source: SwiftTerm.TerminalView, title: String) {
            log.debug("setTerminalTitle: \(title)")
        }

        func hostCurrentDirectoryUpdate(source: SwiftTerm.TerminalView, directory: String?) {
            log.debug("hostCurrentDirectoryUpdate: \(directory ?? "<nil>")")
        }

        func scrolled(source: SwiftTerm.TerminalView, position: Double) {
            // no-op — scroll position tracking not needed
        }

        func requestOpenLink(source: SwiftTerm.TerminalView, link: String, params: [String: String]) {
            log.info("requestOpenLink: \(link)")
            guard let url = URL(string: link) else { return }
            UIApplication.shared.open(url)
        }

        func bell(source: SwiftTerm.TerminalView) {
            // no-op — bell handling deferred to later
        }

        func clipboardCopy(source: SwiftTerm.TerminalView, content: Data) {
            if let str = String(data: content, encoding: .utf8) {
                UIPasteboard.general.string = str
                log.debug("clipboardCopy: \(str.count) chars")
            }
        }

        func iTermContent(source: SwiftTerm.TerminalView, content: ArraySlice<UInt8>) {
            // no-op — iTerm2 OSC 1337 not handled
        }

        func rangeChanged(source: SwiftTerm.TerminalView, startY: Int, endY: Int) {
            // no-op — range change notifications not needed
        }
    }
}

#endif // canImport(SwiftTerm)
