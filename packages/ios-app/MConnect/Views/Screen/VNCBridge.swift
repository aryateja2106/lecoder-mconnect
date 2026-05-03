import SwiftUI
import UIKit

// MARK: - RoyalVNCKit availability gate
//
// All RoyalVNCKit imports and usage are wrapped in #if canImport(RoyalVNCKit).
// The app compiles and runs without the package; a placeholder is shown instead.
// Add the package via Xcode → File → Add Package Dependencies (see docs/VNC-INTEGRATION.md).

#if canImport(RoyalVNCKit)
import RoyalVNCKit

// MARK: - FramebufferHostVC

/// UIViewController that owns the VNCConnection, framebuffer CALayer, and gesture recognizers.
final class FramebufferHostVC: UIViewController {

    // MARK: Dependencies (set before view loads)
    var host: String = ""
    var port: Int = 5900
    var username: String = ""
    var password: String = ""

    // MARK: Callbacks → ScreenViewModel
    var onConnected: (() -> Void)?
    var onAuthenticationRequired: (() -> Void)?
    var onFailed: ((String) -> Void)?
    var onDisconnected: (() -> Void)?

    // MARK: Private
    private var connection: VNCConnection?
    private var framebufferLayer: CALayer?
    private var settings: VNCConnectionSettings?

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        setupFramebufferLayer()
        setupGestures()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        startConnection()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        connection?.disconnect()
    }

    // MARK: - Framebuffer layer

    private func setupFramebufferLayer() {
        let layer = CALayer()
        layer.frame = view.bounds
        layer.contentsGravity = .resizeAspect
        layer.backgroundColor = UIColor.black.cgColor
        view.layer.addSublayer(layer)
        framebufferLayer = layer
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        framebufferLayer?.frame = view.bounds
    }

    // MARK: - Gestures

    private func setupGestures() {
        let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
        view.addGestureRecognizer(tap)

        let pan = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
        view.addGestureRecognizer(pan)

        let longPress = UILongPressGestureRecognizer(target: self, action: #selector(handleLongPress(_:)))
        view.addGestureRecognizer(longPress)
    }

    @objc private func handleTap(_ gesture: UITapGestureRecognizer) {
        let pt = gesture.location(in: view)
        sendMouseEvent(at: pt, buttonMask: 0x01, isDown: true)
        sendMouseEvent(at: pt, buttonMask: 0x00, isDown: false)
    }

    @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
        let pt = gesture.location(in: view)
        sendMouseEvent(at: pt, buttonMask: 0x00, isDown: false)
    }

    @objc private func handleLongPress(_ gesture: UILongPressGestureRecognizer) {
        guard gesture.state == .began else { return }
        let pt = gesture.location(in: view)
        sendMouseEvent(at: pt, buttonMask: 0x04, isDown: true)
        sendMouseEvent(at: pt, buttonMask: 0x00, isDown: false)
    }

    /// Sends a pointer event to the remote desktop.
    private func sendMouseEvent(at point: CGPoint, buttonMask: UInt8, isDown: Bool) {
        guard let fb = connection?.framebuffer else { return }
        let scaleX = CGFloat(fb.width) / view.bounds.width
        let scaleY = CGFloat(fb.height) / view.bounds.height
        let remoteX = UInt16(point.x * scaleX)
        let remoteY = UInt16(point.y * scaleY)
        connection?.sendPointerEvent(buttonMask: buttonMask, x: remoteX, y: remoteY)
    }

    // MARK: - VNC Connection

    func startConnection() {
        var s = VNCConnectionSettings()
        s.host = host
        s.port = UInt16(port)
        s.isShared = true
        s.colorDepth = .depth24Bit
        s.encodings = [.zRLE, .ZRLE, .JPEG, .CopyRect, .Raw]
        settings = s

        let conn = VNCConnection(settings: s)
        conn.delegate = self
        connection = conn
        conn.connect()
    }

    func stopConnection() {
        connection?.disconnect()
        connection = nil
    }
}

// MARK: - VNCConnectionDelegate

extension FramebufferHostVC: VNCConnectionDelegate {
    func connection(_ connection: VNCConnection,
                    credentialFor authenticationType: VNCAuthenticationType,
                    completion: @escaping (VNCCredential?) -> Void) {
        DispatchQueue.main.async { [weak self] in
            self?.onAuthenticationRequired?()
        }
        if !username.isEmpty {
            completion(VNCUsernamePasswordCredential(username: username, password: password))
        } else {
            completion(VNCPasswordCredential(password: password))
        }
    }

    func connectionDidConnect(_ connection: VNCConnection) {
        DispatchQueue.main.async { [weak self] in
            self?.onConnected?()
        }
    }

    func connectionDidDisconnect(_ connection: VNCConnection) {
        DispatchQueue.main.async { [weak self] in
            self?.onDisconnected?()
        }
    }

    func connection(_ connection: VNCConnection, didFailWithError error: Error) {
        DispatchQueue.main.async { [weak self] in
            self?.onFailed?(error.localizedDescription)
        }
    }

    func connection(_ connection: VNCConnection, didCreateFramebuffer framebuffer: VNCFramebuffer) {
        // Framebuffer created — rendering handled via didUpdateFramebuffer
    }

    func connection(_ connection: VNCConnection,
                    didUpdateFramebuffer framebuffer: VNCFramebuffer,
                    x: UInt16, y: UInt16,
                    width: UInt16, height: UInt16) {
        guard let image = framebuffer.cgImage else { return }
        DispatchQueue.main.async { [weak self] in
            self?.framebufferLayer?.contents = image
        }
    }
}

// MARK: - UIViewControllerRepresentable

struct VNCBridgeView: UIViewControllerRepresentable {
    let host: String
    let port: Int
    let username: String
    let password: String

    var onConnected: (() -> Void)?
    var onAuthenticationRequired: (() -> Void)?
    var onFailed: ((String) -> Void)?
    var onDisconnected: (() -> Void)?

    func makeUIViewController(context: Context) -> FramebufferHostVC {
        let vc = FramebufferHostVC()
        vc.host = host
        vc.port = port
        vc.username = username
        vc.password = password
        vc.onConnected = onConnected
        vc.onAuthenticationRequired = onAuthenticationRequired
        vc.onFailed = onFailed
        vc.onDisconnected = onDisconnected
        return vc
    }

    func updateUIViewController(_ uiViewController: FramebufferHostVC, context: Context) {
        // Connection params are set at creation; reconnect not triggered here.
    }
}

#else

// MARK: - Stub when RoyalVNCKit is not linked

/// Placeholder shown when RoyalVNCKit has not yet been added as an SPM dependency.
struct VNCBridgeView: View {
    let host: String
    let port: Int
    let username: String
    let password: String

    var onConnected: (() -> Void)? = nil
    var onAuthenticationRequired: (() -> Void)? = nil
    var onFailed: ((String) -> Void)? = nil
    var onDisconnected: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "display.trianglebadge.exclamationmark")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("RoyalVNCKit not linked yet")
                .font(.headline)
            Text("See **docs/VNC-INTEGRATION.md** for Xcode SPM setup.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .font(.subheadline)
        }
        .padding()
    }
}

#endif
