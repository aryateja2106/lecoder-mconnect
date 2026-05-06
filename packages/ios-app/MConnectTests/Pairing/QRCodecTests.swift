import XCTest
@testable import MConnect

final class QRCodecTests: XCTestCase {

    // MARK: - Format 1: http://host:port/?token=…

    func testHTTPFormat_success() {
        let result = QRCodec.decode("http://myhost.local:8080/?token=abc123")
        switch result {
        case .success(let payload):
            XCTAssertEqual(payload.hostname, "myhost.local")
            XCTAssertEqual(payload.port, 8080)
            XCTAssertEqual(payload.token, "abc123")
            XCTAssertFalse(payload.useTLS)
        case .failure(let err):
            XCTFail("Expected success, got \(err)")
        }
    }

    func testHTTPFormat_missingToken() {
        let result = QRCodec.decode("http://myhost.local:8080/")
        XCTAssertEqual(result, .failure(.missingToken))
    }

    func testHTTPFormat_missingPort() {
        // URL without explicit port — no port component
        let result = QRCodec.decode("http://myhost.local/?token=abc")
        XCTAssertEqual(result, .failure(.invalidPort))
    }

    func testHTTPFormat_missingHost() {
        let result = QRCodec.decode("http://:8080/?token=abc")
        XCTAssertEqual(result, .failure(.missingHost))
    }

    // MARK: - Format 2: https://host:port/?token=…

    func testHTTPSFormat_useTLSTrue() {
        let result = QRCodec.decode("https://secure.host:443/?token=tok999")
        switch result {
        case .success(let payload):
            XCTAssertTrue(payload.useTLS)
            XCTAssertEqual(payload.hostname, "secure.host")
            XCTAssertEqual(payload.port, 443)
            XCTAssertEqual(payload.token, "tok999")
        case .failure(let err):
            XCTFail("Expected success, got \(err)")
        }
    }

    func testHTTPSFormat_missingToken() {
        let result = QRCodec.decode("https://secure.host:443/")
        XCTAssertEqual(result, .failure(.missingToken))
    }

    // MARK: - Format 3: mconnect://pair?host=…&port=…&token=…&tls=…

    func testMConnectScheme_tlsTrue() {
        let result = QRCodec.decode("mconnect://pair?host=mybox.local&port=9090&token=secret&tls=true")
        switch result {
        case .success(let payload):
            XCTAssertEqual(payload.hostname, "mybox.local")
            XCTAssertEqual(payload.port, 9090)
            XCTAssertEqual(payload.token, "secret")
            XCTAssertTrue(payload.useTLS)
        case .failure(let err):
            XCTFail("Expected success, got \(err)")
        }
    }

    func testMConnectScheme_tlsFalse() {
        let result = QRCodec.decode("mconnect://pair?host=mybox.local&port=9090&token=secret&tls=false")
        switch result {
        case .success(let payload):
            XCTAssertFalse(payload.useTLS)
        case .failure(let err):
            XCTFail("Expected success, got \(err)")
        }
    }

    func testMConnectScheme_tlsNumeric() {
        let result = QRCodec.decode("mconnect://pair?host=mybox.local&port=9090&token=tok&tls=1")
        switch result {
        case .success(let payload):
            XCTAssertTrue(payload.useTLS)
        case .failure(let err):
            XCTFail("Expected success, got \(err)")
        }
    }

    func testMConnectScheme_missingHost() {
        let result = QRCodec.decode("mconnect://pair?port=9090&token=tok&tls=false")
        XCTAssertEqual(result, .failure(.missingHost))
    }

    func testMConnectScheme_missingToken() {
        let result = QRCodec.decode("mconnect://pair?host=mybox.local&port=9090&tls=false")
        XCTAssertEqual(result, .failure(.missingToken))
    }

    func testMConnectScheme_badPort() {
        let result = QRCodec.decode("mconnect://pair?host=mybox.local&port=notanumber&token=tok")
        XCTAssertEqual(result, .failure(.invalidPort))
    }

    func testMConnectScheme_portOutOfRange() {
        let result = QRCodec.decode("mconnect://pair?host=mybox.local&port=99999&token=tok")
        XCTAssertEqual(result, .failure(.invalidPort))
    }

    // MARK: - Format 4: plain JSON {"connectUrl":"...","token":"..."}

    func testJSONFormat_connectUrlWithToken() {
        let json = #"{"connectUrl":"http://jsonhost:7070/?token=jsontoken"}"#
        let result = QRCodec.decode(json)
        switch result {
        case .success(let payload):
            XCTAssertEqual(payload.hostname, "jsonhost")
            XCTAssertEqual(payload.port, 7070)
            XCTAssertEqual(payload.token, "jsontoken")
            XCTAssertFalse(payload.useTLS)
        case .failure(let err):
            XCTFail("Expected success, got \(err)")
        }
    }

    func testJSONFormat_tokenFallback() {
        // Token not in URL query — falls back to top-level "token" field
        let json = #"{"connectUrl":"http://jsonhost:7070/","token":"toptoken"}"#
        let result = QRCodec.decode(json)
        switch result {
        case .success(let payload):
            XCTAssertEqual(payload.token, "toptoken")
        case .failure(let err):
            XCTFail("Expected success, got \(err)")
        }
    }

    func testJSONFormat_httpsUseTLS() {
        let json = #"{"connectUrl":"https://securehost:8443/?token=tlstok"}"#
        let result = QRCodec.decode(json)
        switch result {
        case .success(let payload):
            XCTAssertTrue(payload.useTLS)
        case .failure(let err):
            XCTFail("Expected success, got \(err)")
        }
    }

    func testJSONFormat_missingToken() {
        let json = #"{"connectUrl":"http://jsonhost:7070/"}"#
        XCTAssertEqual(QRCodec.decode(json), .failure(.missingToken))
    }

    func testJSONFormat_missingPort() {
        let json = #"{"connectUrl":"http://jsonhost/?token=tok"}"#
        XCTAssertEqual(QRCodec.decode(json), .failure(.invalidPort))
    }

    // MARK: - Invalid inputs

    func testEmptyString() {
        XCTAssertEqual(QRCodec.decode(""), .failure(.unsupportedFormat))
    }

    func testRandomText() {
        XCTAssertEqual(QRCodec.decode("hello world"), .failure(.unsupportedFormat))
    }

    func testUnknownScheme() {
        XCTAssertEqual(QRCodec.decode("ftp://host:21/?token=abc"), .failure(.unsupportedFormat))
    }

    func testWhitespaceIsTrimmed() {
        let result = QRCodec.decode("  http://myhost.local:8080/?token=abc123  ")
        switch result {
        case .success(let payload):
            XCTAssertEqual(payload.token, "abc123")
        case .failure(let err):
            XCTFail("Expected success after trimming, got \(err)")
        }
    }
}

// MARK: - Result Equatable helper for test assertions
extension Result: Equatable where Success: Equatable, Failure: Equatable {
    public static func == (lhs: Result<Success, Failure>, rhs: Result<Success, Failure>) -> Bool {
        switch (lhs, rhs) {
        case (.success(let l), .success(let r)): return l == r
        case (.failure(let l), .failure(let r)): return l == r
        default: return false
        }
    }
}
