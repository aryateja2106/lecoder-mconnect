import SwiftUI
import AVFoundation
import os.log

/// QR scanner sheet. Wraps AVCaptureSession + QRScannerOverlay.
///
/// Integration note: HostListView already presents this view as a full-screen sheet
/// from the '+' menu 'Scan QR Code' action (viewModel.showScanner). On scan, decode
/// via QRCodec.decode(_:), then populate HostDetailView with the resulting PairingPayload.
struct QRScannerView: View {
    @Environment(\.dismiss) private var dismiss
    /// Called with the raw scanned string on first successful decode.
    let onScan: (String) -> Void

    @State private var cameraStatus: CameraStatus = .checking
    @State private var scannedCode: String?
    @State private var scanSucceeded = false

    private static let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.lecoder.mconnect",
        category: "QRPairing"
    )

    private enum CameraStatus {
        case checking
        case authorized
        case denied
    }

    var body: some View {
        NavigationStack {
            Group {
                switch cameraStatus {
                case .checking:
                    ProgressView("Requesting camera access...")
                case .authorized:
                    QRCameraView { code in
                        handleScan(code)
                    }
                    .ignoresSafeArea()
                    .overlay {
                        QRScannerOverlay(
                            scanSucceeded: scanSucceeded,
                            onClose: { dismiss() },
                            onManualEntry: { dismiss() }
                        )
                    }
                case .denied:
                    VStack(spacing: 24) {
                        ContentUnavailableView(
                            "Camera Access Required",
                            systemImage: "camera.fill",
                            description: Text("Enable camera access in Settings to scan QR codes.")
                        )
                        Button("Open Settings") {
                            if let url = URL(string: UIApplication.openSettingsURLString) {
                                UIApplication.shared.open(url)
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        Button("Enter Token Manually") { dismiss() }
                            .foregroundStyle(.secondary)
                    }
                    .padding()
                }
            }
            .navigationTitle("Scan QR Code")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .task {
            await checkCameraPermission()
        }
    }

    private func handleScan(_ code: String) {
        guard scannedCode == nil else { return }
        scannedCode = code
        Self.logger.info("QR scan succeeded, forwarding payload")
        scanSucceeded = true
        // 200 ms green flash, then deliver
        Task {
            try? await Task.sleep(nanoseconds: 200_000_000)
            onScan(code)
            dismiss()
        }
    }

    private func checkCameraPermission() async {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            cameraStatus = .authorized
        case .notDetermined:
            let granted = await AVCaptureDevice.requestAccess(for: .video)
            cameraStatus = granted ? .authorized : .denied
        default:
            cameraStatus = .denied
        }
    }
}

// MARK: - AVFoundation QR Camera

/// UIViewRepresentable that wraps an `AVCaptureSession` configured for QR code detection.
struct QRCameraView: UIViewRepresentable {
    let onScan: (String) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onScan: onScan)
    }

    func makeUIView(context: Context) -> QRCameraUIView {
        let view = QRCameraUIView()
        view.delegate = context.coordinator
        return view
    }

    func updateUIView(_ uiView: QRCameraUIView, context: Context) {}

    class Coordinator: NSObject, QRCameraUIViewDelegate {
        let onScan: (String) -> Void
        private var hasScanned = false

        init(onScan: @escaping (String) -> Void) {
            self.onScan = onScan
        }

        func qrCameraDidScan(_ code: String) {
            guard !hasScanned else { return }
            hasScanned = true
            onScan(code)
        }
    }
}

protocol QRCameraUIViewDelegate: AnyObject {
    func qrCameraDidScan(_ code: String)
}

/// UIKit view hosting the camera session and preview layer.
class QRCameraUIView: UIView, AVCaptureMetadataOutputObjectsDelegate {

    weak var delegate: QRCameraUIViewDelegate?

    private let captureSession = AVCaptureSession()
    private var previewLayer: AVCaptureVideoPreviewLayer?

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .black
        setupSession()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        backgroundColor = .black
        setupSession()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        previewLayer?.frame = bounds
    }

    override func removeFromSuperview() {
        stopSession()
        super.removeFromSuperview()
    }

    private func setupSession() {
        guard let device = AVCaptureDevice.default(for: .video) else { return }
        guard let input = try? AVCaptureDeviceInput(device: device) else { return }

        if captureSession.canAddInput(input) {
            captureSession.addInput(input)
        }

        let metadataOutput = AVCaptureMetadataOutput()
        if captureSession.canAddOutput(metadataOutput) {
            captureSession.addOutput(metadataOutput)
            metadataOutput.setMetadataObjectsDelegate(self, queue: .main)
            metadataOutput.metadataObjectTypes = [.qr]
        }

        let preview = AVCaptureVideoPreviewLayer(session: captureSession)
        preview.videoGravity = .resizeAspectFill
        preview.frame = bounds
        layer.addSublayer(preview)
        previewLayer = preview

        startSession()
    }

    private func startSession() {
        guard !captureSession.isRunning else { return }
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.captureSession.startRunning()
        }
    }

    private func stopSession() {
        guard captureSession.isRunning else { return }
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.captureSession.stopRunning()
        }
    }

    // MARK: - AVCaptureMetadataOutputObjectsDelegate

    func metadataOutput(
        _ output: AVCaptureMetadataOutput,
        didOutput metadataObjects: [AVMetadataObject],
        from connection: AVCaptureConnection
    ) {
        guard let metadata = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
              metadata.type == .qr,
              let code = metadata.stringValue
        else { return }

        stopSession()
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        delegate?.qrCameraDidScan(code)
    }
}
