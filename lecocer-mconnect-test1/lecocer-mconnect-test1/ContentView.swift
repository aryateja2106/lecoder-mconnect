//
//  ContentView.swift
//  LeCoder MConnect
//
//  Terminal control system for AI coding agents.
//  Connect to your CLI session via QR code or pairing code.
//

import SwiftUI
import AVFoundation
import WebKit

// MARK: - App State

enum ConnectionState: Equatable {
    case disconnected
    case connecting
    case connected
    case error(String)

    static func == (lhs: ConnectionState, rhs: ConnectionState) -> Bool {
        switch (lhs, rhs) {
        case (.disconnected, .disconnected), (.connecting, .connecting), (.connected, .connected):
            return true
        case (.error(let a), .error(let b)):
            return a == b
        default:
            return false
        }
    }
}

@MainActor
class SessionStore: ObservableObject {
    @Published var connectedURL: URL?
    @Published var sessionName: String = ""
    @Published var recentConnections: [RecentConnection] = []
    @Published var connectionState: ConnectionState = .disconnected

    var connectionError: String? {
        if case .error(let message) = connectionState { return message }
        return nil
    }

    struct RecentConnection: Identifiable, Codable {
        let id: UUID
        let url: String
        let name: String
        let connectedAt: Date

        init(url: String, name: String = "") {
            self.id = UUID()
            self.url = url
            self.name = name.isEmpty ? url : name
            self.connectedAt = Date()
        }
    }

    init() {
        loadRecent()
    }

    func connect(to urlString: String) {
        let normalized = normalizeURL(urlString)
        guard isValidURL(normalized) else {
            connectionState = .error("Invalid URL: \(urlString)")
            return
        }
        guard let url = URL(string: normalized) else {
            connectionState = .error("Could not parse URL: \(normalized)")
            return
        }
        connectionState = .connecting
        connectedURL = url
        connectionState = .connected
        NotificationManager.shared.sendConnectionNotification(state: .connected, host: url.host)
        let recent = RecentConnection(url: normalized)
        recentConnections.removeAll { $0.url == normalized }
        recentConnections.insert(recent, at: 0)
        if recentConnections.count > 5 { recentConnections = Array(recentConnections.prefix(5)) }
        saveRecent()
    }

    func disconnect() {
        connectedURL = nil
        connectionState = .disconnected
        NotificationManager.shared.sendConnectionNotification(state: .disconnected, host: nil)
    }

    private func normalizeURL(_ urlString: String) -> String {
        let trimmed = urlString.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://") {
            return trimmed
        }
        // Bare IP or localhost — prepend http://
        if trimmed.hasPrefix("192.168.") || trimmed.hasPrefix("10.") ||
           trimmed.hasPrefix("100.") || trimmed.hasPrefix("127.0.0.1") ||
           trimmed.hasPrefix("localhost") {
            return "http://\(trimmed)"
        }
        return trimmed
    }

    private func isValidURL(_ urlString: String) -> Bool {
        guard let url = URL(string: urlString),
              let scheme = url.scheme?.lowercased(),
              let host = url.host?.lowercased() else {
            return false
        }

        if scheme == "https" {
            return true
        }

        if scheme == "http" {
            // Cloudflare tunnels
            if host.hasSuffix(".trycloudflare.com") { return true }
            // Local network
            if host.hasPrefix("192.168.") { return true }
            if host.hasPrefix("10.") { return true }
            // Tailscale (100.64.0.0/10 range)
            if host.hasPrefix("100.") { return true }
            // Localhost
            if host == "localhost" || host == "127.0.0.1" { return true }
        }

        return false
    }

    private func saveRecent() {
        if let data = try? JSONEncoder().encode(recentConnections) {
            UserDefaults.standard.set(data, forKey: "recentConnections")
        }
    }

    private func loadRecent() {
        if let data = UserDefaults.standard.data(forKey: "recentConnections"),
           let connections = try? JSONDecoder().decode([RecentConnection].self, from: data) {
            recentConnections = connections
        }
    }
}

// MARK: - Root View

struct ContentView: View {
    @StateObject private var store = SessionStore()
    @StateObject private var notifications = NotificationManager.shared

    var body: some View {
        if let url = store.connectedURL {
            TerminalContainerView(url: url, store: store)
        } else {
            ConnectView(store: store)
        }
    }
}

// MARK: - Connect Screen

struct ConnectView: View {
    @ObservedObject var store: SessionStore
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var showQRScanner = false
    @State private var showManualEntry = false
    @State private var showPairingCode = false
    @State private var connectionErrorBanner: String?

    private var isCompact: Bool { horizontalSizeClass == .compact }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 32) {
                        // Header
                        headerSection

                        // Connection error banner
                        if let error = connectionErrorBanner ?? store.connectionError {
                            HStack(spacing: 10) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundColor(.red)
                                Text(error)
                                    .font(.system(size: 13, design: .monospaced))
                                    .foregroundColor(.red.opacity(0.9))
                                Spacer()
                                Button {
                                    connectionErrorBanner = nil
                                    if store.connectionError != nil {
                                        store.connectionState = .disconnected
                                    }
                                } label: {
                                    Image(systemName: "xmark")
                                        .font(.system(size: 12, weight: .bold))
                                        .foregroundColor(.gray)
                                }
                            }
                            .padding(14)
                            .background(Color.red.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        }

                        // Connect options
                        connectOptions

                        // Recent connections
                        if !store.recentConnections.isEmpty {
                            recentSection
                        }

                        Spacer(minLength: 40)
                    }
                    .padding(.horizontal, isCompact ? 24 : 48)
                    .padding(.top, 20)
                }
                .refreshable {
                    // Allow pull-to-refresh to retry the last recent connection
                    if let last = store.recentConnections.first {
                        store.connect(to: last.url)
                    }
                }
            }
            .navigationBarHidden(true)
        }
        .sheet(isPresented: $showQRScanner) {
            QRScannerSheet(store: store, isPresented: $showQRScanner)
        }
        .sheet(isPresented: $showManualEntry) {
            ManualConnectSheet(store: store, isPresented: $showManualEntry)
        }
        .sheet(isPresented: $showPairingCode) {
            PairingCodeSheet(store: store, isPresented: $showPairingCode)
        }
    }

    private var headerSection: some View {
        VStack(spacing: isCompact ? 12 : 20) {
            // Logo
            ZStack {
                RoundedRectangle(cornerRadius: isCompact ? 20 : 28)
                    .fill(Color.white)
                    .frame(width: isCompact ? 80 : 100, height: isCompact ? 80 : 100)

                Text("L")
                    .font(.system(size: isCompact ? 48 : 60, weight: .black, design: .monospaced))
                    .foregroundColor(.black)
            }
            .shadow(color: .white.opacity(0.15), radius: 20)

            Text("LeCoder MConnect")
                .font(.system(size: isCompact ? 28 : 32, weight: .bold, design: .monospaced))
                .foregroundColor(.white)

            Text("AI Agent Terminal Control")
                .font(.system(size: isCompact ? 14 : 16, weight: .medium, design: .monospaced))
                .foregroundColor(.gray)
        }
        .padding(.top, isCompact ? 20 : 32)
    }

    private var connectOptions: some View {
        VStack(spacing: 16) {
            Text("CONNECT TO SESSION")
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .foregroundColor(.gray)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, 4)

            if isCompact {
                // iPhone: vertical stack
                connectOptionsStack
            } else {
                // iPad: 2-column grid
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                    connectOptionsStack
                }
            }
        }
    }

    @ViewBuilder
    private var connectOptionsStack: some View {
        // QR Scan - primary action
        Button {
            showQRScanner = true
        } label: {
            ConnectOptionRow(
                icon: "qrcode.viewfinder",
                title: "Scan QR Code",
                subtitle: "Point camera at QR code in terminal",
                isPrimary: true
            )
        }

        // Pairing code - secondary
        Button {
            showPairingCode = true
        } label: {
            ConnectOptionRow(
                icon: "keyboard",
                title: "Enter Pairing Code",
                subtitle: "Type the 6-character code shown in CLI",
                isPrimary: false
            )
        }

        // Direct URL - for power users
        Button {
            showManualEntry = true
        } label: {
            ConnectOptionRow(
                icon: "link",
                title: "Connect to URL",
                subtitle: "Enter tunnel or local server URL directly",
                isPrimary: false
            )
        }
    }

    private var recentSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("RECENT")
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .foregroundColor(.gray)

            ForEach(store.recentConnections) { connection in
                Button {
                    store.connect(to: connection.url)
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "clock")
                            .font(.system(size: 16))
                            .foregroundColor(.gray)
                            .frame(width: 24)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(connection.url)
                                .font(.system(size: 13, design: .monospaced))
                                .foregroundColor(.white)
                                .lineLimit(1)
                            Text(connection.connectedAt.formatted(date: .abbreviated, time: .shortened))
                                .font(.system(size: 11))
                                .foregroundColor(.gray)
                        }

                        Spacer()

                        Image(systemName: "chevron.right")
                            .font(.system(size: 12))
                            .foregroundColor(.gray)
                    }
                    .padding(14)
                    .background(Color.white.opacity(0.06))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
            }
        }
    }
}

struct ConnectOptionRow: View {
    let icon: String
    let title: String
    let subtitle: String
    let isPrimary: Bool

    var body: some View {
        HStack(spacing: 16) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(isPrimary ? Color.white : Color.white.opacity(0.1))
                    .frame(width: 44, height: 44)

                Image(systemName: icon)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(isPrimary ? .black : .white)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.white)
                Text(subtitle)
                    .font(.system(size: 12))
                    .foregroundColor(.gray)
                    .lineLimit(1)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.gray)
        }
        .padding(16)
        .background(isPrimary ? Color.white.opacity(0.12) : Color.white.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(isPrimary ? Color.white.opacity(0.3) : Color.clear, lineWidth: 1)
        )
    }
}

// MARK: - QR Scanner

struct QRScannerSheet: View {
    @ObservedObject var store: SessionStore
    @Binding var isPresented: Bool
    @State private var scannedURL: String?
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()

                VStack(spacing: 0) {
                    QRScannerView(scannedCode: $scannedURL)
                        .ignoresSafeArea(edges: .bottom)

                    // Overlay hint
                    VStack(spacing: 8) {
                        Text("Point at the QR code in your terminal")
                            .font(.system(size: 14, design: .monospaced))
                            .foregroundColor(.white)
                        Text("Run: lecoder-mconnect start")
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundColor(.gray)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(20)
                    .background(Color.black)
                }
            }
            .navigationTitle("Scan QR Code")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { isPresented = false }
                        .foregroundColor(.white)
                }
            }
        }
        .onChange(of: scannedURL) { newValue in
            guard let urlString = newValue else { return }
            isPresented = false
            store.connect(to: urlString)
        }
    }
}

struct QRScannerView: UIViewRepresentable {
    @Binding var scannedCode: String?

    func makeUIView(context: Context) -> UIView {
        let view = UIView()
        view.backgroundColor = .black

        let session = AVCaptureSession()
        context.coordinator.session = session

        guard let device = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: device) else {
            return view
        }

        session.addInput(input)

        let output = AVCaptureMetadataOutput()
        session.addOutput(output)
        output.setMetadataObjectsDelegate(context.coordinator, queue: .main)
        output.metadataObjectTypes = [.qr]

        let preview = AVCaptureVideoPreviewLayer(session: session)
        preview.frame = UIScreen.main.bounds
        preview.videoGravity = .resizeAspectFill
        view.layer.addSublayer(preview)
        context.coordinator.previewLayer = preview

        // Scanning reticle overlay
        let overlayView = ScannerOverlayView()
        overlayView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(overlayView)
        NSLayoutConstraint.activate([
            overlayView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            overlayView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            overlayView.topAnchor.constraint(equalTo: view.topAnchor),
            overlayView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        DispatchQueue.global(qos: .background).async {
            session.startRunning()
        }

        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(scannedCode: $scannedCode)
    }

    class Coordinator: NSObject, AVCaptureMetadataOutputObjectsDelegate {
        var scannedCode: Binding<String?>
        var session: AVCaptureSession?
        var previewLayer: AVCaptureVideoPreviewLayer?
        var hasScanned = false

        init(scannedCode: Binding<String?>) {
            self.scannedCode = scannedCode
        }

        func metadataOutput(
            _ output: AVCaptureMetadataOutput,
            didOutput metadataObjects: [AVMetadataObject],
            from connection: AVCaptureConnection
        ) {
            guard !hasScanned,
                  let readableCode = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
                  let stringValue = readableCode.stringValue else { return }

            hasScanned = true
            AudioServicesPlaySystemSound(SystemSoundID(kSystemSoundID_Vibrate))
            scannedCode.wrappedValue = stringValue
            session?.stopRunning()
        }
    }
}

// Scanning reticle overlay
class ScannerOverlayView: UIView {
    override func draw(_ rect: CGRect) {
        super.draw(rect)
        guard let ctx = UIGraphicsGetCurrentContext() else { return }

        let size = min(rect.width, rect.height) * 0.6
        let x = (rect.width - size) / 2
        let y = (rect.height - size) / 2 - 40
        let scanRect = CGRect(x: x, y: y, width: size, height: size)
        let cornerLen: CGFloat = 28
        let cornerWidth: CGFloat = 3

        // Dim overlay
        ctx.setFillColor(UIColor.black.withAlphaComponent(0.5).cgColor)
        ctx.fill(rect)
        ctx.clear(scanRect)

        // Corner indicators
        ctx.setStrokeColor(UIColor.white.cgColor)
        ctx.setLineWidth(cornerWidth)
        ctx.setLineCap(.round)

        let corners: [(CGPoint, CGPoint, CGPoint)] = [
            (CGPoint(x: scanRect.minX, y: scanRect.minY + cornerLen),
             CGPoint(x: scanRect.minX, y: scanRect.minY),
             CGPoint(x: scanRect.minX + cornerLen, y: scanRect.minY)),
            (CGPoint(x: scanRect.maxX - cornerLen, y: scanRect.minY),
             CGPoint(x: scanRect.maxX, y: scanRect.minY),
             CGPoint(x: scanRect.maxX, y: scanRect.minY + cornerLen)),
            (CGPoint(x: scanRect.maxX, y: scanRect.maxY - cornerLen),
             CGPoint(x: scanRect.maxX, y: scanRect.maxY),
             CGPoint(x: scanRect.maxX - cornerLen, y: scanRect.maxY)),
            (CGPoint(x: scanRect.minX + cornerLen, y: scanRect.maxY),
             CGPoint(x: scanRect.minX, y: scanRect.maxY),
             CGPoint(x: scanRect.minX, y: scanRect.maxY - cornerLen))
        ]

        for (start, corner, end) in corners {
            ctx.move(to: start)
            ctx.addLine(to: corner)
            ctx.addLine(to: end)
            ctx.strokePath()
        }
    }
}

// MARK: - Pairing Code Entry

struct PairingCodeSheet: View {
    @ObservedObject var store: SessionStore
    @Binding var isPresented: Bool
    @State private var serverURL = ""
    @State private var code = ""
    @State private var isLoading = false
    @State private var errorMessage = ""
    @FocusState private var focusedField: Field?

    enum Field { case url, code }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 28) {
                        // Icon
                        VStack(spacing: 12) {
                            Image(systemName: "keyboard")
                                .font(.system(size: 40))
                                .foregroundColor(.white)
                                .padding(20)
                                .background(Color.white.opacity(0.1))
                                .clipShape(Circle())

                            Text("Enter Pairing Code")
                                .font(.system(size: 22, weight: .bold, design: .monospaced))
                                .foregroundColor(.white)

                            Text("Find the code shown in your terminal\nafter running: lecoder-mconnect start")
                                .font(.system(size: 13))
                                .foregroundColor(.gray)
                                .multilineTextAlignment(.center)
                        }
                        .padding(.top, 20)

                        // Server URL
                        VStack(alignment: .leading, spacing: 8) {
                            Label("SERVER URL", systemImage: "network")
                                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                .foregroundColor(.gray)

                            TextField("https://xxx.trycloudflare.com or http://192.168.x.x:8765", text: $serverURL)
                                .font(.system(size: 14, design: .monospaced))
                                .foregroundColor(.white)
                                .autocapitalization(.none)
                                .keyboardType(.URL)
                                .focused($focusedField, equals: .url)
                                .padding(14)
                                .background(Color.white.opacity(0.08))
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(focusedField == .url ? Color.white.opacity(0.4) : Color.clear, lineWidth: 1)
                                )
                        }

                        // Pairing Code
                        VStack(alignment: .leading, spacing: 8) {
                            Label("PAIRING CODE", systemImage: "lock")
                                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                .foregroundColor(.gray)

                            TextField("A1B2C3", text: $code)
                                .font(.system(size: 28, weight: .bold, design: .monospaced))
                                .foregroundColor(.white)
                                .multilineTextAlignment(.center)
                                .autocapitalization(.allCharacters)
                                .focused($focusedField, equals: .code)
                            .onChange(of: code) { newValue in
                                code = String(newValue.uppercased().filter { $0.isLetter || $0.isNumber }.prefix(6))
                            }
                                .padding(20)
                                .background(Color.white.opacity(0.08))
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(focusedField == .code ? Color.white.opacity(0.4) : Color.clear, lineWidth: 1)
                                )

                            Text("6-character code · Valid for 5 minutes")
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundColor(.gray)
                        }

                        if !errorMessage.isEmpty {
                            HStack {
                                Image(systemName: "exclamationmark.triangle.fill")
                                Text(errorMessage)
                                    .font(.system(size: 13))
                            }
                            .foregroundColor(.red)
                            .padding(12)
                            .background(Color.red.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }

                        // Connect button
                        Button {
                            connectWithPairingCode()
                        } label: {
                            HStack(spacing: 10) {
                                if isLoading {
                                    ProgressView()
                                        .tint(.black)
                                        .scaleEffect(0.8)
                                } else {
                                    Image(systemName: "arrow.right.circle.fill")
                                }
                                Text(isLoading ? "Connecting..." : "Connect")
                                    .font(.system(size: 16, weight: .bold, design: .monospaced))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(16)
                            .background(canConnect ? Color.white : Color.gray)
                            .foregroundColor(.black)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        .disabled(!canConnect || isLoading)
                    }
                    .padding(.horizontal, 24)
                    .padding(.bottom, 40)
                }
            }
            .navigationTitle("Pairing Code")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { isPresented = false }
                        .foregroundColor(.white)
                }
            }
        }
        .onAppear { focusedField = .url }
    }

    private var canConnect: Bool {
        !serverURL.isEmpty && code.count == 6
    }

    private func connectWithPairingCode() {
        guard canConnect else { return }
        isLoading = true
        errorMessage = ""

        let base = serverURL.trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))

        guard let pairURL = URL(string: "\(base)/auth/pair") else {
            errorMessage = "Invalid server URL"
            isLoading = false
            return
        }

        var request = URLRequest(url: pairURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 10

        let body = ["code": code]
        request.httpBody = try? JSONEncoder().encode(body)

        URLSession.shared.dataTask(with: request) { data, response, error in
            DispatchQueue.main.async {
                isLoading = false

                if let error = error {
                    errorMessage = error.localizedDescription
                    return
                }

                guard let data = data,
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    // If no pair endpoint, just load the base URL directly with code as query
                    let connectURL = "\(base)/?code=\(code)"
                    isPresented = false
                    store.connect(to: connectURL)
                    return
                }

                if let token = json["token"] as? String,
                   let sessionId = json["sessionId"] as? String {
                    let connectURL = "\(base)/?token=\(token)&session=\(sessionId)"
                    isPresented = false
                    store.connect(to: connectURL)
                } else if let urlString = json["url"] as? String {
                    isPresented = false
                    store.connect(to: urlString)
                } else {
                    errorMessage = (json["error"] as? String) ?? "Invalid response from server"
                }
            }
        }.resume()
    }
}

// MARK: - Manual URL Connect

struct ManualConnectSheet: View {
    @ObservedObject var store: SessionStore
    @Binding var isPresented: Bool
    @State private var urlText = ""
    @FocusState private var isFocused: Bool

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()

                VStack(spacing: 24) {
                    VStack(spacing: 10) {
                        Image(systemName: "link.circle")
                            .font(.system(size: 40))
                            .foregroundColor(.white)
                            .padding(20)
                            .background(Color.white.opacity(0.1))
                            .clipShape(Circle())

                        Text("Connect to URL")
                            .font(.system(size: 22, weight: .bold, design: .monospaced))
                            .foregroundColor(.white)

                        Text("Paste the Cloudflare tunnel URL\nor your local network address")
                            .font(.system(size: 13))
                            .foregroundColor(.gray)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 20)

                    VStack(alignment: .leading, spacing: 8) {
                        Label("URL", systemImage: "network")
                            .font(.system(size: 11, weight: .semibold, design: .monospaced))
                            .foregroundColor(.gray)

                        TextEditor(text: $urlText)
                            .font(.system(size: 14, design: .monospaced))
                            .foregroundColor(.white)
                            .scrollContentBackground(.hidden)
                            .background(Color.white.opacity(0.08))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .focused($isFocused)
                            .frame(minHeight: 80, maxHeight: 120)
                            .padding(14)
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(isFocused ? Color.white.opacity(0.4) : Color.clear, lineWidth: 1)
                            )

                        Text("Examples:\nhttps://xxx.trycloudflare.com\nhttp://192.168.1.100:8765\nhttp://100.64.0.1:8765 (Tailscale)")
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(.gray)
                    }

                    Button {
                        let trimmed = urlText.trimmingCharacters(in: .whitespacesAndNewlines)
                        if !trimmed.isEmpty {
                            isPresented = false
                            store.connect(to: trimmed)
                        }
                    } label: {
                        Text("Connect")
                            .font(.system(size: 16, weight: .bold, design: .monospaced))
                            .frame(maxWidth: .infinity)
                            .padding(16)
                            .background(urlText.isEmpty ? Color.gray : Color.white)
                            .foregroundColor(.black)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .disabled(urlText.isEmpty)

                    Spacer()
                }
                .padding(.horizontal, 24)
            }
            .navigationTitle("Direct Connect")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { isPresented = false }
                        .foregroundColor(.white)
                }
            }
        }
        .onAppear { isFocused = true }
    }
}

// MARK: - Terminal Container

struct TerminalContainerView: View {
    let url: URL
    @ObservedObject var store: SessionStore
    @State private var showControls = false
    @State private var isLoading = true
    @State private var connectionError: String?
    @State private var webViewID = UUID()

    var body: some View {
        ZStack(alignment: .bottom) {
            TerminalWebView(url: url, isLoading: $isLoading, connectionError: $connectionError)
                .id(webViewID)
                .ignoresSafeArea()

            // Loading overlay
            if isLoading && connectionError == nil {
                ZStack {
                    Color.black
                    VStack(spacing: 16) {
                        ProgressView()
                            .tint(.white)
                            .scaleEffect(1.2)
                        Text("Connecting to session...")
                            .font(.system(size: 14, design: .monospaced))
                            .foregroundColor(.gray)
                    }
                }
                .ignoresSafeArea()
                .transition(.opacity)
            }

            // Error overlay
            if let error = connectionError {
                ZStack {
                    Color.black
                    VStack(spacing: 20) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 44))
                            .foregroundColor(.red)

                        Text("Connection Failed")
                            .font(.system(size: 20, weight: .bold, design: .monospaced))
                            .foregroundColor(.white)

                        Text(error)
                            .font(.system(size: 13, design: .monospaced))
                            .foregroundColor(.red.opacity(0.8))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)

                        Text(url.absoluteString)
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(.gray)
                            .lineLimit(2)
                            .padding(.horizontal, 32)

                        VStack(spacing: 12) {
                            Button {
                                connectionError = nil
                                isLoading = true
                                webViewID = UUID()
                            } label: {
                                HStack(spacing: 8) {
                                    Image(systemName: "arrow.clockwise")
                                    Text("Retry")
                                        .font(.system(size: 16, weight: .bold, design: .monospaced))
                                }
                                .frame(maxWidth: .infinity)
                                .padding(14)
                                .background(Color.white)
                                .foregroundColor(.black)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                            }

                            Button {
                                store.disconnect()
                            } label: {
                                HStack(spacing: 8) {
                                    Image(systemName: "xmark.circle")
                                    Text("Disconnect")
                                        .font(.system(size: 16, weight: .semibold, design: .monospaced))
                                }
                                .frame(maxWidth: .infinity)
                                .padding(14)
                                .foregroundColor(.red)
                                .background(Color.red.opacity(0.15))
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                            }
                        }
                        .padding(.horizontal, 32)
                        .padding(.top, 8)
                    }
                }
                .ignoresSafeArea()
                .transition(.opacity)
            }

            // Bottom control bar
            if showControls && connectionError == nil {
                controlBar
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .onChange(of: connectionError) { newValue in
            if let error = newValue {
                NotificationManager.shared.sendConnectionNotification(state: .error(error), host: url.host)
            }
        }
        .onTapGesture(count: 2) {
            withAnimation(.spring(response: 0.3)) {
                showControls.toggle()
            }
        }
        .animation(.spring(response: 0.3), value: showControls)
        .statusBar(hidden: true)
        .ignoresSafeArea(.keyboard)
    }

    private var controlBar: some View {
        HStack(spacing: 20) {
            // Connected indicator
            HStack(spacing: 6) {
                Circle()
                    .fill(Color.green)
                    .frame(width: 8, height: 8)
                Text(url.host ?? "connected")
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundColor(.white)
                    .lineLimit(1)
            }

            Spacer()

            // Disconnect button
            Button {
                withAnimation {
                    store.disconnect()
                }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "xmark.circle.fill")
                    Text("Disconnect")
                        .font(.system(size: 13, weight: .semibold))
                }
                .foregroundColor(.red)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(Color.red.opacity(0.15))
                .clipShape(Capsule())
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Color.white.opacity(0.15))
                .frame(height: 0.5)
        }
    }
}

// MARK: - Terminal WebView

struct TerminalWebView: UIViewRepresentable {
    let url: URL
    @Binding var isLoading: Bool
    @Binding var connectionError: String?

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.backgroundColor = UIColor.black
        webView.scrollView.backgroundColor = UIColor.black
        webView.isOpaque = false
        webView.allowsLinkPreview = false
        webView.customUserAgent = "MConnectApp/1.0 iOS/\(UIDevice.current.systemVersion)"

        // Prevent default touch callouts from interfering
        webView.scrollView.delaysContentTouches = false

        let request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
        webView.load(request)

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(isLoading: $isLoading, connectionError: $connectionError)
    }

    class Coordinator: NSObject, WKNavigationDelegate {
        @Binding var isLoading: Bool
        @Binding var connectionError: String?

        init(isLoading: Binding<Bool>, connectionError: Binding<String?>) {
            self._isLoading = isLoading
            self._connectionError = connectionError
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            isLoading = true
            connectionError = nil
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            withAnimation {
                isLoading = false
                connectionError = nil
            }

            // Inject CSS for better mobile experience
            let css = """
                * { -webkit-tap-highlight-color: transparent; }
                body { overscroll-behavior: none; }
            """
            let js = """
                var style = document.createElement('style');
                style.textContent = '\(css)';
                document.head.appendChild(style);
            """
            webView.evaluateJavaScript(js)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            withAnimation {
                isLoading = false
                connectionError = error.localizedDescription
            }
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            withAnimation {
                isLoading = false
                connectionError = error.localizedDescription
            }
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            decisionHandler(.allow)
        }
    }
}

// MARK: - Preview

#Preview {
    ContentView()
        .preferredColorScheme(.dark)
}

