import SwiftUI

/// Terminal emulator view with SwiftTerm integration.
///
/// Uses SwiftTerm's TerminalView when available (full VT100/xterm emulation),
/// falls back to a monospaced text ScrollView otherwise.
/// Add SwiftTerm via SPM to enable the full emulator — see docs/SWIFTTERM-INTEGRATION.md.
struct TerminalEmulatorView: View {
    @ObservedObject var viewModel: TerminalViewModel
    let onTapped: () -> Void

    var body: some View {
        #if canImport(SwiftTerm)
        SwiftTermBridge(viewModel: viewModel, accessoryViewProvider: makeAccessoryView)
            .onTapGesture { onTapped() }
        #else
        TerminalTextView(viewModel: viewModel, onTapped: onTapped)
        #endif
    }

    #if canImport(SwiftTerm)
    /// Builds the ModifierAccessoryBar host view to override SwiftTerm's default keyboard accessory.
    private func makeAccessoryView() -> UIView {
        let viewModel = self.viewModel
        let bar = ModifierAccessoryBar { data in
            Task { @MainActor in
                viewModel.sendInputBytes(data)
            }
        }
        let host = UIHostingController(rootView: bar)
        host.view.backgroundColor = .clear
        host.view.translatesAutoresizingMaskIntoConstraints = false
        // SwiftTerm sizes inputAccessoryView via intrinsicContentSize; our bar
        // measures itself via SwiftUI layout so set a reasonable height.
        host.sizeThatFits(in: CGSize(width: UIScreen.main.bounds.width, height: 120))
        host.view.frame = CGRect(x: 0, y: 0, width: UIScreen.main.bounds.width, height: 96)
        return host.view
    }
    #endif
}

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

