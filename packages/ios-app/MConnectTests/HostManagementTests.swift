import XCTest
@testable import MConnect

final class HostModelTests: XCTestCase {

    // MARK: - Initialization

    func testDefaultValues() {
        let host = Host(name: "Test", hostname: "192.168.1.1")
        XCTAssertFalse(host.id.isEmpty)
        XCTAssertEqual(host.name, "Test")
        XCTAssertEqual(host.hostname, "192.168.1.1")
        XCTAssertEqual(host.port, 8080)
        XCTAssertTrue(host.useTLS)
        XCTAssertFalse(host.requireBiometric)
        XCTAssertFalse(host.isConnected)
    }

    func testCustomValues() {
        let host = Host(
            id: "custom-id",
            name: "Production",
            hostname: "prod.example.com",
            port: 443,
            useTLS: true,
            requireBiometric: true,
            isConnected: true
        )
        XCTAssertEqual(host.id, "custom-id")
        XCTAssertEqual(host.port, 443)
        XCTAssertTrue(host.requireBiometric)
        XCTAssertTrue(host.isConnected)
    }

    // MARK: - Codable

    func testEncodeDecode() throws {
        let host = Host(name: "Encode Test", hostname: "10.0.0.1", port: 9090, useTLS: false)
        let data = try JSONEncoder().encode(host)
        let decoded = try JSONDecoder().decode(Host.self, from: data)

        XCTAssertEqual(decoded.id, host.id)
        XCTAssertEqual(decoded.name, host.name)
        XCTAssertEqual(decoded.hostname, host.hostname)
        XCTAssertEqual(decoded.port, host.port)
        XCTAssertEqual(decoded.useTLS, host.useTLS)
        XCTAssertEqual(decoded.requireBiometric, host.requireBiometric)
        XCTAssertEqual(decoded.isConnected, host.isConnected)
    }

    func testEncodeDecodeArray() throws {
        let hosts = [
            Host(name: "A", hostname: "a.local"),
            Host(name: "B", hostname: "b.local", port: 3000),
        ]
        let data = try JSONEncoder().encode(hosts)
        let decoded = try JSONDecoder().decode([Host].self, from: data)

        XCTAssertEqual(decoded.count, 2)
        XCTAssertEqual(decoded[0].name, "A")
        XCTAssertEqual(decoded[1].port, 3000)
    }

    // MARK: - Hashable / Equatable

    func testHashableConformance() {
        let host = Host(id: "same-id", name: "A", hostname: "a.local")
        var set = Set<Host>()
        set.insert(host)
        XCTAssertTrue(set.contains(host))
    }

    func testIdentifiable() {
        let host = Host(id: "id-123", name: "Server", hostname: "host.local")
        XCTAssertEqual(host.id, "id-123")
    }
}

@MainActor
final class HostListViewModelTests: XCTestCase {

    private var viewModel: HostListViewModel!
    private let keychain = KeychainService.shared
    private let testKey = KeychainItems.hostProfiles

    override func setUp() {
        super.setUp()
        // Clear any existing host profiles
        try? keychain.delete(forKey: testKey)
        viewModel = HostListViewModel()
    }

    override func tearDown() {
        try? keychain.delete(forKey: testKey)
        super.tearDown()
    }

    // MARK: - Initial State

    func testInitialStateEmpty() {
        XCTAssertTrue(viewModel.hosts.isEmpty)
        XCTAssertFalse(viewModel.showScanner)
        XCTAssertFalse(viewModel.showAddHost)
    }

    func testInitialStateLoadsFromKeychain() throws {
        let hosts = [Host(name: "Preloaded", hostname: "10.0.0.1")]
        try keychain.saveCodable(hosts, forKey: testKey)

        let vm = HostListViewModel()
        XCTAssertEqual(vm.hosts.count, 1)
        XCTAssertEqual(vm.hosts[0].name, "Preloaded")
    }

    // MARK: - CRUD

    func testAddHost() throws {
        let host = Host(name: "New Host", hostname: "192.168.1.1")
        viewModel.addHost(host)

        XCTAssertEqual(viewModel.hosts.count, 1)
        XCTAssertEqual(viewModel.hosts[0].name, "New Host")

        // Verify persisted
        let loaded = try keychain.loadCodable([Host].self, forKey: testKey)
        XCTAssertEqual(loaded.count, 1)
    }

    func testUpdateExistingHost() throws {
        var host = Host(name: "Original", hostname: "10.0.0.1")
        viewModel.addHost(host)

        host.name = "Updated"
        viewModel.updateHost(host)

        XCTAssertEqual(viewModel.hosts.count, 1)
        XCTAssertEqual(viewModel.hosts[0].name, "Updated")

        let loaded = try keychain.loadCodable([Host].self, forKey: testKey)
        XCTAssertEqual(loaded[0].name, "Updated")
    }

    func testUpdateNonExistentHostAddsIt() {
        let host = Host(name: "New via update", hostname: "10.0.0.2")
        viewModel.updateHost(host)

        XCTAssertEqual(viewModel.hosts.count, 1)
        XCTAssertEqual(viewModel.hosts[0].name, "New via update")
    }

    func testRemoveHost() throws {
        let host = Host(name: "To Remove", hostname: "10.0.0.1")
        viewModel.addHost(host)
        XCTAssertEqual(viewModel.hosts.count, 1)

        viewModel.removeHost(host)
        XCTAssertTrue(viewModel.hosts.isEmpty)

        let loaded = try keychain.loadCodable([Host].self, forKey: testKey)
        XCTAssertTrue(loaded.isEmpty)
    }

    func testDeleteHostsAtOffsets() {
        viewModel.addHost(Host(name: "A", hostname: "a.local"))
        viewModel.addHost(Host(name: "B", hostname: "b.local"))
        viewModel.addHost(Host(name: "C", hostname: "c.local"))
        XCTAssertEqual(viewModel.hosts.count, 3)

        viewModel.deleteHosts(at: IndexSet(integer: 1))
        XCTAssertEqual(viewModel.hosts.count, 2)
        XCTAssertEqual(viewModel.hosts[0].name, "A")
        XCTAssertEqual(viewModel.hosts[1].name, "C")
    }

    // MARK: - QR Code Parsing

    func testHandleQRCodeMConnectURL() {
        viewModel.handleQRCode("mconnect://myserver.local:9090?name=My%20Server&tls=true")
        XCTAssertEqual(viewModel.hosts.count, 1)
        XCTAssertEqual(viewModel.hosts[0].hostname, "myserver.local")
        XCTAssertEqual(viewModel.hosts[0].port, 9090)
        XCTAssertEqual(viewModel.hosts[0].name, "My Server")
        XCTAssertTrue(viewModel.hosts[0].useTLS)
    }

    func testHandleQRCodeMConnectURLNoTLS() {
        viewModel.handleQRCode("mconnect://192.168.1.50:8080?tls=false")
        XCTAssertEqual(viewModel.hosts.count, 1)
        XCTAssertFalse(viewModel.hosts[0].useTLS)
    }

    func testHandleQRCodeMConnectURLDefaultPort() {
        viewModel.handleQRCode("mconnect://myserver.local")
        XCTAssertEqual(viewModel.hosts.count, 1)
        XCTAssertEqual(viewModel.hosts[0].port, 8080)
    }

    func testHandleQRCodePlainHostPort() {
        viewModel.handleQRCode("10.0.0.5:3000")
        XCTAssertEqual(viewModel.hosts.count, 1)
        XCTAssertEqual(viewModel.hosts[0].hostname, "10.0.0.5")
        XCTAssertEqual(viewModel.hosts[0].port, 3000)
    }

    func testHandleQRCodePlainHostOnly() {
        viewModel.handleQRCode("10.0.0.5")
        XCTAssertEqual(viewModel.hosts.count, 1)
        XCTAssertEqual(viewModel.hosts[0].hostname, "10.0.0.5")
        XCTAssertEqual(viewModel.hosts[0].port, 8080)
    }

    func testHandleQRCodeInvalidShowsError() {
        viewModel.handleQRCode("")
        XCTAssertTrue(viewModel.hosts.isEmpty)
        XCTAssertTrue(viewModel.showQRError)
    }

    func testHandleQRCodeMConnectMissingHostShowsError() {
        viewModel.handleQRCode("mconnect://")
        XCTAssertTrue(viewModel.hosts.isEmpty)
        XCTAssertTrue(viewModel.showQRError)
    }
}

@MainActor
final class HostDetailViewModelTests: XCTestCase {

    // MARK: - Init

    func testInitForNewHost() {
        let vm = HostDetailViewModel(host: nil, onSave: nil, onDelete: nil)
        XCTAssertFalse(vm.isEditing)
        XCTAssertEqual(vm.name, "")
        XCTAssertEqual(vm.hostname, "")
        XCTAssertEqual(vm.port, "8080")
        XCTAssertTrue(vm.useTLS)
        XCTAssertFalse(vm.requireBiometric)
    }

    func testInitForExistingHost() {
        let host = Host(name: "Server", hostname: "10.0.0.1", port: 443, useTLS: false, requireBiometric: true)
        let vm = HostDetailViewModel(host: host, onSave: nil, onDelete: nil)
        XCTAssertTrue(vm.isEditing)
        XCTAssertEqual(vm.name, "Server")
        XCTAssertEqual(vm.hostname, "10.0.0.1")
        XCTAssertEqual(vm.port, "443")
        XCTAssertFalse(vm.useTLS)
        XCTAssertTrue(vm.requireBiometric)
    }

    // MARK: - Validation

    func testIsValidWithAllFields() {
        let vm = HostDetailViewModel(host: nil, onSave: nil, onDelete: nil)
        vm.name = "Test"
        vm.hostname = "test.local"
        vm.port = "8080"
        XCTAssertTrue(vm.isValid)
    }

    func testIsValidEmptyNameFails() {
        let vm = HostDetailViewModel(host: nil, onSave: nil, onDelete: nil)
        vm.name = ""
        vm.hostname = "test.local"
        XCTAssertFalse(vm.isValid)
    }

    func testIsValidWhitespaceOnlyNameFails() {
        let vm = HostDetailViewModel(host: nil, onSave: nil, onDelete: nil)
        vm.name = "   "
        vm.hostname = "test.local"
        XCTAssertFalse(vm.isValid)
    }

    func testIsValidEmptyHostnameFails() {
        let vm = HostDetailViewModel(host: nil, onSave: nil, onDelete: nil)
        vm.name = "Test"
        vm.hostname = ""
        XCTAssertFalse(vm.isValid)
    }

    func testIsValidInvalidPortFails() {
        let vm = HostDetailViewModel(host: nil, onSave: nil, onDelete: nil)
        vm.name = "Test"
        vm.hostname = "test.local"
        vm.port = "abc"
        XCTAssertFalse(vm.isValid)
    }

    func testIsValidPortZeroFails() {
        let vm = HostDetailViewModel(host: nil, onSave: nil, onDelete: nil)
        vm.name = "Test"
        vm.hostname = "test.local"
        vm.port = "0"
        XCTAssertFalse(vm.isValid)
    }

    func testIsValidPortTooHighFails() {
        let vm = HostDetailViewModel(host: nil, onSave: nil, onDelete: nil)
        vm.name = "Test"
        vm.hostname = "test.local"
        vm.port = "70000"
        XCTAssertFalse(vm.isValid)
    }

    func testIsValidMaxPortSucceeds() {
        let vm = HostDetailViewModel(host: nil, onSave: nil, onDelete: nil)
        vm.name = "Test"
        vm.hostname = "test.local"
        vm.port = "65535"
        XCTAssertTrue(vm.isValid)
    }

    // MARK: - Save

    func testSaveCallsOnSaveCallback() {
        var savedHost: Host?
        let vm = HostDetailViewModel(host: nil, onSave: { savedHost = $0 }, onDelete: nil)
        vm.name = "New Host"
        vm.hostname = "new.local"
        vm.port = "3000"
        vm.useTLS = false

        vm.save()

        XCTAssertNotNil(savedHost)
        XCTAssertEqual(savedHost?.name, "New Host")
        XCTAssertEqual(savedHost?.hostname, "new.local")
        XCTAssertEqual(savedHost?.port, 3000)
        XCTAssertFalse(savedHost!.useTLS)
    }

    func testSavePreservesExistingId() {
        let host = Host(id: "original-id", name: "Old", hostname: "old.local")
        var savedHost: Host?
        let vm = HostDetailViewModel(host: host, onSave: { savedHost = $0 }, onDelete: nil)
        vm.name = "Updated"

        vm.save()

        XCTAssertEqual(savedHost?.id, "original-id")
        XCTAssertEqual(savedHost?.name, "Updated")
    }

    func testSaveTrimsWhitespace() {
        var savedHost: Host?
        let vm = HostDetailViewModel(host: nil, onSave: { savedHost = $0 }, onDelete: nil)
        vm.name = "  Trimmed  "
        vm.hostname = "  trim.local  "
        vm.port = "8080"

        vm.save()

        XCTAssertEqual(savedHost?.name, "Trimmed")
        XCTAssertEqual(savedHost?.hostname, "trim.local")
    }

    func testSaveDoesNothingWhenInvalid() {
        var saveCalled = false
        let vm = HostDetailViewModel(host: nil, onSave: { _ in saveCalled = true }, onDelete: nil)
        vm.name = ""
        vm.hostname = ""

        vm.save()

        XCTAssertFalse(saveCalled)
    }

    // MARK: - Delete

    func testDeleteCallsOnDeleteCallback() {
        let host = Host(name: "To Delete", hostname: "del.local")
        var deletedHost: Host?
        let vm = HostDetailViewModel(host: host, onSave: nil, onDelete: { deletedHost = $0 })

        vm.delete()

        XCTAssertNotNil(deletedHost)
        XCTAssertEqual(deletedHost?.id, host.id)
    }

    func testDeleteDoesNothingForNewHost() {
        var deleteCalled = false
        let vm = HostDetailViewModel(host: nil, onSave: nil, onDelete: { _ in deleteCalled = true })

        vm.delete()

        XCTAssertFalse(deleteCalled)
    }
}
