import SwiftUI
import AVFoundation

struct QRScannerView: View {
    @Environment(\.dismiss) private var dismiss
    let onScan: (String) -> Void

    @State private var cameraStatus: CameraStatus = .checking
    @State private var scannedCode: String?

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
                        guard scannedCode == nil else { return }
                        scannedCode = code
                        onScan(code)
                        dismiss()
                    }
                    .overlay {
                        ScannerOverlay()
                    }
                case .denied:
                    ContentUnavailableView(
                        "Camera Access Required",
                        systemImage: "camera.fill",
                        description: Text("Enable camera access in Settings to scan QR codes.")
                    )
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

/// Visual overlay for the scanner with a cutout viewfinder.
private struct ScannerOverlay: View {
    var body: some View {
        GeometryReader { geometry in
            let size = min(geometry.size.width, geometry.size.height) * 0.65
            ZStack {
                Color.black.opacity(0.4)
                    .ignoresSafeArea()

                RoundedRectangle(cornerRadius: 16)
                    .frame(width: size, height: size)
                    .blendMode(.destinationOut)
            }
            .compositingGroup()
            .overlay {
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(.white, lineWidth: 2)
                    .frame(width: size, height: size)
            }
            .overlay(alignment: .bottom) {
                Text("Point camera at QR code")
                    .font(.subheadline)
                    .foregroundStyle(.white)
                    .padding(.bottom, 40)
            }
        }
        .allowsHitTesting(false)
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
