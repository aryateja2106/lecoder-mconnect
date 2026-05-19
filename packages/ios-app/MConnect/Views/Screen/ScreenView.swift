import SwiftUI

/// Root view for the Screen tab. Shows a connection form when disconnected,
/// and embeds VNCBridgeView once the user taps Connect.
struct ScreenView: View {
    @StateObject private var viewModel = ScreenViewModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        NavigationStack {
            Group {
                switch viewModel.connectionState {
                case .disconnected, .failed:
                    connectionForm
                case .connecting, .authenticating, .connected:
                    activeSessionView
                }
            }
            .navigationTitle("Screen")
            .navigationBarTitleDisplayMode(.inline)
        }
        .tint(.primary)
    }

    private var connectionForm: some View {
        Form {
            emptyStateSection
            credentialsSection
            connectButtonSection
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private var emptyStateSection: some View {
        Section {
            VStack(spacing: 12) {
                Image(systemName: "rectangle.fill.on.rectangle.fill")
                    .font(.system(size: 48))
                    .foregroundStyle(.primary)

                Text("Connect to a Mac")
                    .font(.title2.weight(.semibold))

                Text("Share your Mac's screen using Screen Sharing or Remote Desktop.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .listRowBackground(Color.clear)
        }
    }

    private var credentialsSection: some View {
        Section("Connection") {
            LabeledContent("Host") {
                TextField("hostname or IP", text: $viewModel.host)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                    .multilineTextAlignment(.trailing)
                    .onChange(of: viewModel.host) { _, newHost in
                        viewModel.loadSavedPassword(for: newHost)
                    }
            }

            LabeledContent("Port") {
                TextField("5900", text: $viewModel.port)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
            }

            LabeledContent("Username") {
                TextField("optional", text: $viewModel.username)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .multilineTextAlignment(.trailing)
            }

            LabeledContent("Password") {
                SecureField("required", text: $viewModel.password)
                    .multilineTextAlignment(.trailing)
            }

            if case .failed(let message) = viewModel.connectionState {
                Label(message, systemImage: "exclamationmark.triangle.fill")
                    .foregroundStyle(.primary)
                    .font(.footnote.weight(.semibold))
            }
        }
    }

    private var connectButtonSection: some View {
        Section {
            Button(action: viewModel.connect) {
                Label("Connect", systemImage: "arrow.right.circle.fill")
                    .frame(maxWidth: .infinity)
            }
            .disabled(!viewModel.isFormValid)
        }
    }

    @ViewBuilder
    private var activeSessionView: some View {
        ZStack(alignment: .topTrailing) {
            VNCBridgeView(
                host: viewModel.host,
                port: viewModel.portInt,
                username: viewModel.username,
                password: viewModel.password,
                onConnected: { viewModel.onConnectionEstablished() },
                onAuthenticationRequired: { viewModel.onAuthenticationRequired() },
                onFailed: { viewModel.onConnectionFailed($0) },
                onDisconnected: { viewModel.disconnect() }
            )
            .ignoresSafeArea()

            statusBadge
                .padding(12)
        }
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Disconnect", role: .destructive) {
                    viewModel.disconnect()
                }
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active && viewModel.connectionState == .disconnected {
                viewModel.connect()
            }
        }
    }

    private var statusBadge: some View {
        Text(viewModel.connectionState.displayText)
            .font(.caption2.weight(.medium))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(.ultraThinMaterial, in: Capsule())
    }
}

#Preview {
    ScreenView()
}
