import SwiftUI

/// Terminal emulator view with SwiftTerm integration.
///
/// Uses SwiftTerm's TerminalView when available, falls back to a
/// monospaced text ScrollView otherwise. The fallback handles basic
/// display while SwiftTerm provides full VT100/xterm emulation.
struct TerminalEmulatorView: View {
    @ObservedObject var viewModel: TerminalViewModel
    let onTapped: () -> Void

    var body: some View {
        // The fallback implementation (SwiftTerm integration will use UIViewRepresentable)
        // To enable SwiftTerm:
        // 1. Add SwiftTerm package: https://github.com/migueldeicaza/SwiftTerm
        // 2. Uncomment the #if canImport check below
        // 3. Replace TerminalTextView with SwiftTermView

        // #if canImport(SwiftTerm)
        // SwiftTermView(viewModel: viewModel)
        // #else
        TerminalTextView(viewModel: viewModel, onTapped: onTapped)
        // #endif
    }
}

// MARK: - Fallback Text View

/// Pure SwiftUI fallback terminal display.
/// Renders terminal output as monospaced text with auto-scroll.
private struct TerminalTextView: View {
    @ObservedObject var viewModel: TerminalViewModel
    let onTapped: () -> Void

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                Text(viewModel.displayText)
                    .font(.system(size: 13, weight: .regular, design: .monospaced))
                    .foregroundColor(.green)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(8)
                    .id("terminalBottom")
            }
            .background(Color.black)
            .onChange(of: viewModel.displayText) { _, _ in
                withAnimation(.easeOut(duration: 0.1)) {
                    proxy.scrollTo("terminalBottom", anchor: .bottom)
                }
            }
            .onTapGesture { onTapped() }
        }
    }
}

// MARK: - SwiftTerm UIViewRepresentable (Ready for Integration)

/// UIViewRepresentable wrapper for SwiftTerm's TerminalView.
///
/// To enable, add SwiftTerm via SPM:
/// Package URL: https://github.com/migueldeicaza/SwiftTerm
///
/// Then uncomment the `#if canImport(SwiftTerm)` section in TerminalEmulatorView.body
/// and switch to using `SwiftTermView(viewModel:)` instead of `TerminalTextView`.
///
/// The SwiftTermView will:
/// - Create a SwiftTerm.TerminalView UIView
/// - Feed raw output via `terminal.feed(byteArray:)`
/// - Report size changes via `viewModel.handleTerminalSizeChange(cols:rows:)`
/// - Handle input via the TerminalViewDelegate
///
/// Implementation notes:
/// ```swift
/// #if canImport(SwiftTerm)
/// import SwiftTerm
///
/// struct SwiftTermView: UIViewRepresentable {
///     @ObservedObject var viewModel: TerminalViewModel
///
///     func makeUIView(context: Context) -> TerminalView {
///         let termView = TerminalView(frame: .zero)
///         termView.terminalDelegate = context.coordinator
///         termView.backgroundColor = .black
///         termView.font = NSFont.monospacedSystemFont(ofSize: 13, weight: .regular)
///
///         // Report initial size
///         let cols = termView.getTerminal().cols
///         let rows = termView.getTerminal().rows
///         viewModel.handleTerminalSizeChange(cols: cols, rows: rows)
///
///         return termView
///     }
///
///     func updateUIView(_ uiView: TerminalView, context: Context) {
///         // Feed new output to the terminal
///         if let agentId = viewModel.activeAgent?.id {
///             let raw = context.coordinator.terminalBuffer.rawOutput(forAgent: agentId)
///             if raw != context.coordinator.lastFedOutput {
///                 let newData = String(raw.dropFirst(context.coordinator.lastFedOutput.count))
///                 if let data = newData.data(using: .utf8) {
///                     uiView.feed(byteArray: [UInt8](data))
///                 }
///                 context.coordinator.lastFedOutput = raw
///             }
///         }
///     }
///
///     func makeCoordinator() -> Coordinator {
///         Coordinator(viewModel: viewModel)
///     }
///
///     class Coordinator: NSObject, TerminalViewDelegate {
///         let viewModel: TerminalViewModel
///         var lastFedOutput = ""
///         var terminalBuffer: TerminalBuffer { viewModel.terminalBuffer }
///
///         init(viewModel: TerminalViewModel) {
///             self.viewModel = viewModel
///         }
///
///         func sizeChanged(source: TerminalView, newCols: Int, newRows: Int) {
///             viewModel.handleTerminalSizeChange(cols: newCols, rows: newRows)
///         }
///
///         func setTerminalTitle(source: TerminalView, title: String) {
///             // Optional: update view title
///         }
///
///         func hostCurrentDirectoryUpdate(source: TerminalView, directory: String?) {
///             // Optional: track current directory
///         }
///
///         func send(source: TerminalView, data: ArraySlice<UInt8>) {
///             // Handle keyboard input from terminal
///             let text = String(bytes: data, encoding: .utf8) ?? ""
///             viewModel.sendInput(text)
///         }
///     }
/// }
/// #endif
/// ```
// See documentation comments above for SwiftTerm integration details.
