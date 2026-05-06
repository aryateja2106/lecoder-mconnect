import Foundation
import os.signpost

/// Errors produced by QRCodec.decode(_:).
enum QRCodecError: Error, Equatable {
    case unsupportedFormat
    case missingHost
    case missingToken
    case invalidPort
}

/// Pure stateless decoder for MConnect QR code payloads.
///
/// Supported formats:
///   1. `http://host:port/?token=…`  (HTTP, useTLS = false)
///   2. `https://host:port/?token=…` (HTTPS, useTLS = true)
///   3. `mconnect://pair?host=…&port=…&token=…&tls=…` (custom scheme)
///   4. Plain JSON: `{"connectUrl":"http://host:port/?token=…","token":"…"}`
///
/// Integration note: Present QRScannerView as a full-screen sheet from
/// HostListView's '+' menu 'Scan QR Code' action; on scan, decode via
/// QRCodec.decode(_:), then push HostDetailView with PairingPayload prefilled.
enum QRCodec {
    private static let logger = Logger(subsystem: Bundle.main.bundleIdentifier ?? "com.lecoder.mconnect", category: "QRPairing")
    private static let signposter = OSSignposter(logger: logger)

    static func decode(_ scanned: String) -> Result<PairingPayload, QRCodecError> {
        let state = signposter.beginInterval("qr.scan", id: signposter.makeSignpostID())
        let result = _decode(scanned)
        switch result {
        case .success:
            signposter.endInterval("qr.scan", state, "qr.scan.success")
            logger.info("QR decode success")
        case .failure(let err):
            signposter.endInterval("qr.scan", state, "qr.scan.fail")
            logger.warning("QR decode failed: \(String(describing: err))")
        }
        return result
    }

    private static func _decode(_ scanned: String) -> Result<PairingPayload, QRCodecError> {
        let trimmed = scanned.trimmingCharacters(in: .whitespacesAndNewlines)

        // Format 4: plain JSON {"connectUrl":"...","token":"..."}
        if trimmed.hasPrefix("{") {
            return decodeJSON(trimmed)
        }

        guard let url = URL(string: trimmed), let scheme = url.scheme else {
            return .failure(.unsupportedFormat)
        }

        switch scheme.lowercased() {
        case "http", "https":
            return decodeHTTP(url: url, useTLS: scheme.lowercased() == "https")
        case "mconnect":
            return decodeMConnectScheme(url: url)
        default:
            return .failure(.unsupportedFormat)
        }
    }

    // MARK: - Format 1 & 2: http(s)://host:port/?token=…

    private static func decodeHTTP(url: URL, useTLS: Bool) -> Result<PairingPayload, QRCodecError> {
        guard let host = url.host, !host.isEmpty else {
            return .failure(.missingHost)
        }
        guard let port = url.port, port > 0, port <= 65535 else {
            return .failure(.invalidPort)
        }
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let token = components.queryItems?.first(where: { $0.name == "token" })?.value,
              !token.isEmpty else {
            return .failure(.missingToken)
        }
        return .success(PairingPayload(hostname: host, port: port, token: token, useTLS: useTLS))
    }

    // MARK: - Format 3: mconnect://pair?host=…&port=…&token=…&tls=…

    private static func decodeMConnectScheme(url: URL) -> Result<PairingPayload, QRCodecError> {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return .failure(.unsupportedFormat)
        }
        let items = components.queryItems ?? []
        func param(_ name: String) -> String? {
            items.first(where: { $0.name == name })?.value
        }

        guard let host = param("host"), !host.isEmpty else {
            return .failure(.missingHost)
        }
        guard let portStr = param("port"), let port = Int(portStr), port > 0, port <= 65535 else {
            return .failure(.invalidPort)
        }
        guard let token = param("token"), !token.isEmpty else {
            return .failure(.missingToken)
        }
        let useTLS = param("tls").map { $0.lowercased() == "true" || $0 == "1" } ?? false
        return .success(PairingPayload(hostname: host, port: port, token: token, useTLS: useTLS))
    }

    // MARK: - Format 4: {"connectUrl":"...","token":"..."}

    private static func decodeJSON(_ json: String) -> Result<PairingPayload, QRCodecError> {
        struct InfoJSON: Decodable {
            let connectUrl: String?
            let token: String?
        }
        guard let data = json.data(using: .utf8),
              let parsed = try? JSONDecoder().decode(InfoJSON.self, from: data) else {
            return .failure(.unsupportedFormat)
        }
        // connectUrl takes priority; token field is override/fallback
        guard let urlString = parsed.connectUrl, let url = URL(string: urlString), let scheme = url.scheme else {
            return .failure(.unsupportedFormat)
        }
        let useTLS = scheme.lowercased() == "https"
        guard let host = url.host, !host.isEmpty else {
            return .failure(.missingHost)
        }
        guard let port = url.port, port > 0, port <= 65535 else {
            return .failure(.invalidPort)
        }
        // Prefer token from URL query; fall back to top-level "token" field
        let urlToken = URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?.first(where: { $0.name == "token" })?.value
        guard let token = urlToken ?? parsed.token, !token.isEmpty else {
            return .failure(.missingToken)
        }
        return .success(PairingPayload(hostname: host, port: port, token: token, useTLS: useTLS))
    }
}
