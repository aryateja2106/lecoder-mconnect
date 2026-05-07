import SwiftUI

/// Terminal emulator view with SwiftTerm integration.
///
/// Uses SwiftTerm's TerminalView when available (full VT100/xterm emulation),
/// falls back to a monospaced text ScrollView otherwise.
/// Add SwiftTerm via SPM to enable the full emulator — see docs/SWIFTTERM-INTEGRATION.md.
struct TerminalEmulatorView: View {
    @ObservedObject var viewModel: TerminalViewModel
    let onTapped: () -> Void

    #if canImport(SwiftTerm)
    /// Retains the accessory bar's UIHostingController across SwiftUI re-renders so
    /// SwiftTerm's `inputAccessoryView` keeps a live SwiftUI host (the controller is
    /// not retained by `inputAccessoryView`, which only holds the view).
    @State private var accessoryHost = AccessoryHostHolder()
    #endif

    var body: some View {
        #if canImport(SwiftTerm)
        SwiftTermBridge(viewModel: viewModel, accessoryViewProvider: makeAccessoryView)
            .onTapGesture { onTapped() }
        #else
        TerminalTextView(viewModel: viewModel, onTapped: onTapped)
        #endif
    }

    #if canImport(SwiftTerm)
    /// Returns the cached ModifierAccessoryBar host view; builds it on first call.
    /// Stored on `accessoryHost` (`@State`) so the controller outlives `body` re-renders.
    private func makeAccessoryView() -> UIView {
        accessoryHost.view(viewModel: viewModel)
    }
    #endif
}

#if canImport(SwiftTerm)
/// Reference holder for the ModifierAccessoryBar UIHostingController. Lives in
/// `@State` to survive SwiftUI body re-renders without rebuilding the host.
private final class AccessoryHostHolder {
    private var host: UIHostingController<ModifierAccessoryBar>?

    func view(viewModel: TerminalViewModel) -> UIView {
        if let existing = host { return existing.view }
        let bar = ModifierAccessoryBar { [weak viewModel] data in
            Task { @MainActor in
                viewModel?.sendInputBytes(data)
            }
        }
        let h = UIHostingController(rootView: bar)
        h.view.backgroundColor = .clear
        h.view.translatesAutoresizingMaskIntoConstraints = false
        h.sizeThatFits(in: CGSize(width: UIScreen.main.bounds.width, height: 120))
        h.view.frame = CGRect(x: 0, y: 0, width: UIScreen.main.bounds.width, height: 96)
        host = h
        return h.view
    }
}
#endif

// MARK: - Fallback Text View

/// Pure SwiftUI fallback terminal display.
/// Renders terminal output as monospaced text with auto-scroll.
///
/// Uses debouncing to coalesce rapid output updates and reduce render overhead.
private struct TerminalTextView: View {
    @ObservedObject var viewModel: TerminalViewModel
    let onTapped: () -> Void

    // Debounce rapid output updates
    @State private var renderedText: String = ""
    @State private var updateTask: Task<Void, Never>?

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                Text(renderedText)
                    .font(.system(size: 13, weight: .regular, design: .monospaced))
                    .foregroundColor(.green)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(8)
                    .id("terminalBottom")
            }
            .background(Color.black)
            .onChange(of: viewModel.displayText) { _, newValue in
                // Coalesce rapid updates with a small delay
                updateTask?.cancel()
                updateTask = Task {
                    // 16ms = ~60fps frame budget
                    try? await Task.sleep(for: .milliseconds(16))
                    guard !Task.isCancelled else { return }
                    renderedText = newValue
                }
            }
            .onChange(of: renderedText) { _, _ in
                withAnimation(.easeOut(duration: 0.1)) {
                    proxy.scrollTo("terminalBottom", anchor: .bottom)
                }
            }
            .onTapGesture { onTapped() }
            .onAppear { renderedText = viewModel.displayText }
        }
    }
}

