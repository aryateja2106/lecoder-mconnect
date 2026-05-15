import SwiftUI

// MARK: - MobileTerminalView

/// iOS-first mobile terminal screen.
///
/// Long-term replacement for `TerminalView.swift`. Lives alongside the
/// existing screen so the legacy navigation paths still build. Layout:
///
/// - ZStack root, full-bleed black terminal canvas behind everything.
/// - `SessionHeaderView` overlaid at the top, respecting the safe-area inset.
/// - `FloatingControlPill` floats above the keyboard area when shown,
///   auto-hiding after 3 seconds of input inactivity.
/// - `HardwareKeyAccessory` is pinned to the bottom safe-area inset and
///   sits above the iOS keyboard when it is visible.
///
/// The body still uses `TerminalEmulatorView` for now; once SwiftTerm is
/// wired up we can swap that in without touching the surrounding chrome.
struct MobileTerminalView: View {
    // MARK: Inputs

    /// Driving view-model (owns the buffer, agents, connection state).
    @ObservedObject var viewModel: TerminalViewModel

    /// Returns to the host list.
    let onBack: () -> Void

    /// Opens the session switcher / new tab sheet.
    let onTapSession: () -> Void

    // MARK: State

    @StateObject private var modifierState = StickyModifierState()
    @State private var showFloatingPill: Bool = true
    @State private var pillAutoHideTask: Task<Void, Never>?
    @State private var showKeyboard: Bool = false
    @State private var inputText: String = ""
    @FocusState private var inputFocused: Bool

    private let pillAutoHideDelay: Duration = .seconds(3)

    var body: some View {
        ZStack(alignment: .top) {
            // Full-bleed terminal body.
            TerminalEmulatorView(viewModel: viewModel) {
                handleTerminalTap()
            }
            .background(MConnectTheme.bgTerminal)
            .ignoresSafeArea()

            // Sticky header over the terminal canvas.
            SessionHeaderView(
                sessionTitle: viewModel.activeAgent?.name ?? "Shell",
                connectionState: viewModel.connectionState,
                onBack: onBack,
                onTapSession: onTapSession
            )
            .padding(.top, 8)

            // Floating pill + invisible input field stack at the bottom.
            VStack(spacing: 0) {
                Spacer()
                if showFloatingPill {
                    FloatingControlPill(
                        onMic: handleMic,
                        onToggleKeyboard: handleToggleKeyboard,
                        onAI: handleAIAction,
                        onSettings: handleSettings,
                        onDismiss: handleDismissPill
                    )
                    .padding(.bottom, 12)
                }

                hiddenInputField
            }
            .animation(.spring(response: 0.35, dampingFraction: 0.85), value: showFloatingPill)
        }
        .preferredColorScheme(.dark)
        .statusBar(hidden: false)
        .background(MConnectTheme.bgTerminal.ignoresSafeArea())
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if showKeyboard {
                HardwareKeyAccessory(
                    modifierState: modifierState,
                    onSendInput: handleAccessoryKey
                )
            }
        }
        .onAppear {
            viewModel.connect()
            schedulePillAutoHide()
        }
        .onDisappear {
            viewModel.disconnect()
            pillAutoHideTask?.cancel()
        }
    }

    // MARK: - Hidden input field

    /// Off-screen text field that hosts the system keyboard. We pipe each
    /// committed line into the PTY then reset the buffer.
    private var hiddenInputField: some View {
        TextField("", text: $inputText)
            .font(.system(.body, design: .monospaced))
            .focused($inputFocused)
            .autocorrectionDisabled()
            .textInputAutocapitalization(.never)
            .keyboardType(.asciiCapable)
            .opacity(0)
            .frame(height: 1)
            .onSubmit { submitInput() }
            .onChange(of: inputFocused) { _, focused in
                showKeyboard = focused
            }
    }

    // MARK: - Pill / keyboard handlers

    private func handleTerminalTap() {
        // A tap on the terminal body toggles the floating pill (and keyboard
        // visibility if the pill was already shown).
        if showFloatingPill {
            showFloatingPill = false
            inputFocused = false
        } else {
            showFloatingPill = true
            schedulePillAutoHide()
        }
    }

    private func schedulePillAutoHide() {
        pillAutoHideTask?.cancel()
        pillAutoHideTask = Task { @MainActor in
            try? await Task.sleep(for: pillAutoHideDelay)
            guard !Task.isCancelled else { return }
            // Don't auto-hide while the keyboard is up — the user is still
            // actively interacting with the terminal.
            if !showKeyboard {
                showFloatingPill = false
            }
        }
    }

    private func handleMic() {
        // TODO: hook up SFSpeechRecognizer dictation pipeline.
        schedulePillAutoHide()
    }

    private func handleToggleKeyboard() {
        inputFocused.toggle()
        showKeyboard = inputFocused
        schedulePillAutoHide()
    }

    private func handleAIAction() {
        // TODO: present quick agent action sheet (Run / Resume / Stop).
        schedulePillAutoHide()
    }

    private func handleSettings() {
        // TODO: present session settings sheet.
        schedulePillAutoHide()
    }

    private func handleDismissPill() {
        showFloatingPill = false
    }

    // MARK: - Input dispatch

    private func handleAccessoryKey(_ raw: String) {
        viewModel.sendInput(raw)
        schedulePillAutoHide()
    }

    private func submitInput() {
        guard !inputText.isEmpty else { return }
        viewModel.sendInput(inputText + "\n")
        inputText = ""
        schedulePillAutoHide()
    }
}

// MARK: - Preview

#Preview {
    let host = Host(
        name: "preview",
        hostname: "preview.local"
    )
    let wsClient = WSClient()
    let viewModel = TerminalViewModel(host: host, wsClient: wsClient)
    MobileTerminalView(
        viewModel: viewModel,
        onBack: {},
        onTapSession: {}
    )
}
