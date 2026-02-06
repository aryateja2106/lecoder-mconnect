import SwiftUI

/// UIViewRepresentable wrapper for terminal emulation.
/// Will integrate SwiftTerm library in a later step.
struct TerminalEmulatorView: View {
    @ObservedObject var viewModel: TerminalViewModel

    var body: some View {
        ScrollView {
            Text(viewModel.terminalOutput)
                .font(.system(.body, design: .monospaced))
                .foregroundColor(.green)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(8)
        }
        .background(Color.black)
    }
}
