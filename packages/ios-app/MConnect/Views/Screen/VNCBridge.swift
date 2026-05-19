import SwiftUI
import UIKit

// RoyalVNCKit is intentionally gated off until this bridge is updated against
// the package's current public API. The Screen tab remains testable without the
// dependency and shows a clear integration placeholder.
#if false
import RoyalVNCKit

final class FramebufferHostVC: UIViewController {
    var host: String = ""
    var port: Int = 5900
    var username: String = ""
    var password: String = ""

    var onConnected: (() -> Void)?
    var onAuthenticationRequired: (() -> Void)?
    var onFailed: ((String) -> Void)?
    var onDisconnected: (() -> Void)?

    private var connection: VNCConnection?
    private var framebufferLayer: CALayer?
    private var settings: VNCConnectionSettings?

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

    private func setupGestures() {
        let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
        view.addGestureRecognizer(tap)

        let pan = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
        view.addGestureRecognizer(pan)

        let longPress = UILongPressGestureRecognizer(target: self, action: #selector(handleLongPress(_:)))
        view.addGestureRecognizer(longPress)
    }

    @objc private func handleTap(_ gesture: UITapGestureRecognizer) {
        let point = gesture.location(in: view)
        sendMouseEvent(at: point, buttonMask: 0x01)
        sendMouseEvent(at: point, buttonMask: 0x00)
    }

    @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
        sendMouseEvent(at: gesture.location(in: view), buttonMask: 0x00)
    }

    @objc private func handleLongPress(_ gesture: UILongPressGestureRecognizer) {
        guard gesture.state == .began else { return }
        let point = gesture.location(in: view)
        sendMouseEvent(at: point, buttonMask: 0x04)
        sendMouseEvent(at: point, buttonMask: 0x00)
    }

    private func sendMouseEvent(at point: CGPoint, buttonMask: UInt8) {
        guard let framebuffer = connection?.framebuffer else { return }

        let scaleX = CGFloat(framebuffer.width) / view.bounds.width
        let scaleY = CGFloat(framebuffer.height) / view.bounds.height
        let remoteX = UInt16(point.x * scaleX)
        let remoteY = UInt16(point.y * scaleY)

        connection?.sendPointerEvent(buttonMask: buttonMask, x: remoteX, y: remoteY)
    }

    func startConnection() {
        var settings = VNCConnectionSettings()
        settings.host = host
        settings.port = UInt16(port)
        settings.isShared = true
        settings.colorDepth = .depth24Bit
        settings.encodings = [.zRLE, .ZRLE, .JPEG, .CopyRect, .Raw]
        self.settings = settings

        let connection = VNCConnection(settings: settings)
        connection.delegate = self
        self.connection = connection
        connection.connect()
    }

    func stopConnection() {
        connection?.disconnect()
        connection = nil
    }
}

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

    func connection(_ connection: VNCConnection, didCreateFramebuffer framebuffer: VNCFramebuffer) {}

    func connection(_ connection: VNCConnection,
                    didUpdateFramebuffer framebuffer: VNCFramebuffer,
                    x: UInt16,
                    y: UInt16,
                    width: UInt16,
                    height: UInt16) {
        guard let image = framebuffer.cgImage else { return }

        DispatchQueue.main.async { [weak self] in
            self?.framebufferLayer?.contents = image
        }
    }
}

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
        let viewController = FramebufferHostVC()
        viewController.host = host
        viewController.port = port
        viewController.username = username
        viewController.password = password
        viewController.onConnected = onConnected
        viewController.onAuthenticationRequired = onAuthenticationRequired
        viewController.onFailed = onFailed
        viewController.onDisconnected = onDisconnected
        return viewController
    }

    func updateUIViewController(_ uiViewController: FramebufferHostVC, context: Context) {}
}

#else

struct VNCBridgeView: View {
    let host: String
    let port: Int
    let username: String
    let password: String

    var onConnected: (() -> Void)?
    var onAuthenticationRequired: (() -> Void)?
    var onFailed: ((String) -> Void)?
    var onDisconnected: (() -> Void)?

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "display.trianglebadge.exclamationmark")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)

            Text("VNC bridge not linked yet")
                .font(.headline)

            Text("The Screen tab is wired in. See docs/VNC-INTEGRATION.md for the RoyalVNCKit adapter work.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
    }
}

#endif
