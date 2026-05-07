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
    private var fbWidth: CGFloat = 0
    private var fbHeight: CGFloat = 0

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        setupFramebufferLayer()
        setupGestures()
        setupKeyboardInput()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        startConnection()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        stopConnection()
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
    }

    @objc private func handleTap(_ gesture: UITapGestureRecognizer) {
        let pt = gesture.location(in: view)
        guard let (rx, ry) = mapToRemote(point: pt) else { return }
        connection?.mouseButtonDown(.left, x: rx, y: ry)
        connection?.mouseButtonUp(.left, x: rx, y: ry)
    }

    /// Maps an iOS view-local point to remote framebuffer coordinates.
    /// Accounts for `.resizeAspect` letterboxing.
    private func mapToRemote(point: CGPoint) -> (UInt16, UInt16)? {
        guard fbWidth > 0, fbHeight > 0,
              view.bounds.width > 0, view.bounds.height > 0 else { return nil }

        let viewW = view.bounds.width
        let viewH = view.bounds.height
        let fbAspect = fbWidth / fbHeight
        let viewAspect = viewW / viewH

        let drawnW: CGFloat
        let drawnH: CGFloat
        let offX: CGFloat
        let offY: CGFloat
        if viewAspect > fbAspect {
            // pillarbox: framebuffer fits to height
            drawnH = viewH
            drawnW = viewH * fbAspect
            offX = (viewW - drawnW) / 2
            offY = 0
        } else {
            // letterbox: framebuffer fits to width
            drawnW = viewW
            drawnH = viewW / fbAspect
            offX = 0
            offY = (viewH - drawnH) / 2
        }

        let inX = point.x - offX
        let inY = point.y - offY
        guard inX >= 0, inY >= 0, inX <= drawnW, inY <= drawnH else { return nil }

        let rx = max(0, min(fbWidth - 1, inX * fbWidth / drawnW))
        let ry = max(0, min(fbHeight - 1, inY * fbHeight / drawnH))
        return (UInt16(rx), UInt16(ry))
    }

    // MARK: - Keyboard input

    private lazy var hiddenTextField: UITextField = {
        let tf = UITextField(frame: .zero)
        tf.autocapitalizationType = .none
        tf.autocorrectionType = .no
        tf.delegate = self
        tf.isHidden = true
        return tf
    }()

    private func setupKeyboardInput() {
        view.addSubview(hiddenTextField)
        hiddenTextField.becomeFirstResponder()
    }

    /// Sends a printable ASCII character to the remote as a key press+release.
    /// For ASCII range 0x20–0x7E, the X11 keysym equals the ASCII code.
    fileprivate func sendChar(_ ch: Character) {
        guard let scalar = ch.unicodeScalars.first else { return }
        let code = scalar.value
        // Map newline → X11 Return (0xFF0D); backspace → 0xFF08
        let keysym: UInt32
        switch code {
        case 0x0A, 0x0D: keysym = 0xFF0D
        case 0x08, 0x7F: keysym = 0xFF08
        default:
            guard code >= 0x20, code <= 0x7E else { return }
            keysym = code
        }
        connection?._objc_keyDown(keysym)
        connection?._objc_keyUp(keysym)
    }

    // MARK: - VNC Connection

    func startConnection() {
        let settings = VNCConnection.Settings(
            isDebugLoggingEnabled: false,
            hostname: host,
            port: UInt16(port),
            isShared: true,
            isScalingEnabled: false,
            useDisplayLink: true,
            inputMode: .none,
            isClipboardRedirectionEnabled: false,
            colorDepth: .depth24Bit,
            frameEncodings: [.zrle, .hextile, .zlib, .copyRect, .raw]
        )

        let conn = VNCConnection(settings: settings)
        conn.delegate = self
        connection = conn
        conn.connect()
    }

    func stopConnection() {
        connection?.disconnect()
        connection = nil
    }
}

// MARK: - UITextFieldDelegate (keyboard passthrough)

extension FramebufferHostVC: UITextFieldDelegate {
    func textField(_ textField: UITextField,
                   shouldChangeCharactersIn range: NSRange,
                   replacementString string: String) -> Bool {
        if string.isEmpty {
            // backspace
            sendChar("\u{08}")
        } else {
            for ch in string { sendChar(ch) }
        }
        // Don't actually keep text in the field
        return false
    }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        sendChar("\n")
        return false
    }
}

// MARK: - VNCConnectionDelegate

extension FramebufferHostVC: VNCConnectionDelegate {
    func connection(_ connection: VNCConnection,
                    stateDidChange connectionState: VNCConnection.ConnectionState) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            switch connectionState.status {
            case .connected:
                self.onConnected?()
            case .disconnected:
                if let err = connectionState.error {
                    self.onFailed?(err.localizedDescription)
                } else {
                    self.onDisconnected?()
                }
            case .connecting, .disconnecting:
                break
            }
        }
    }

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

    func connection(_ connection: VNCConnection,
                    didCreateFramebuffer framebuffer: VNCFramebuffer) {
        DispatchQueue.main.async { [weak self] in
            self?.fbWidth = CGFloat(framebuffer.size.width)
            self?.fbHeight = CGFloat(framebuffer.size.height)
        }
    }

    func connection(_ connection: VNCConnection,
                    didResizeFramebuffer framebuffer: VNCFramebuffer) {
        DispatchQueue.main.async { [weak self] in
            self?.fbWidth = CGFloat(framebuffer.size.width)
            self?.fbHeight = CGFloat(framebuffer.size.height)
        }
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

    func connection(_ connection: VNCConnection,
                    didUpdateCursor cursor: VNCCursor) {
        // No custom cursor rendering on iOS for MVP.
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
