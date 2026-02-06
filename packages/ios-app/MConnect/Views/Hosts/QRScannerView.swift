import SwiftUI
import AVFoundation

struct QRScannerView: View {
    @Environment(\.dismiss) private var dismiss
    let onScan: (String) -> Void

    @State private var isCameraAuthorized = false
    @State private var showPermissionDenied = false

    var body: some View {
        NavigationStack {
            Group {
                if isCameraAuthorized {
                    QRCameraView(onScan: { code in
                        onScan(code)
                        dismiss()
                    })
                } else if showPermissionDenied {
                    ContentUnavailableView(
                        "Camera Access Required",
                        systemImage: "camera.fill",
                        description: Text("Enable camera access in Settings to scan QR codes.")
                    )
                } else {
                    ProgressView("Requesting camera access...")
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
            isCameraAuthorized = true
        case .notDetermined:
            isCameraAuthorized = await AVCaptureDevice.requestAccess(for: .video)
            if !isCameraAuthorized { showPermissionDenied = true }
        default:
            showPermissionDenied = true
        }
    }
}

/// Placeholder for AVFoundation camera integration.
/// Full implementation will use AVCaptureSession with QR code metadata detection.
struct QRCameraView: View {
    let onScan: (String) -> Void

    var body: some View {
        ZStack {
            Color.black
            VStack(spacing: 16) {
                Image(systemName: "qrcode.viewfinder")
                    .font(.system(size: 64))
                    .foregroundColor(.white)
                Text("Point camera at QR code")
                    .foregroundColor(.white)
            }
        }
    }
}
