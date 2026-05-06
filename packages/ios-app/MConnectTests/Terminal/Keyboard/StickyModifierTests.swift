import XCTest
@testable import MConnect

// MARK: - StickyModifierTests

final class StickyModifierTests: XCTestCase {

    // MARK: Helpers

    private func make() -> StickyModifier { StickyModifier() }

    private func arm(_ modifier: StickyModifier, _ key: ModifierKey) async {
        await modifier.toggle(key)
    }

    // MARK: - Ctrl tests

    func testCtrlC_emits_ETX() async throws {
        let sm = make()
        await arm(sm, .ctrl)
        let data = await sm.consume("c")
        XCTAssertEqual(data, Data([0x03]), "Ctrl+C must emit ETX (0x03)")
    }

    func testCtrlL_emits_FF() async throws {
        let sm = make()
        await arm(sm, .ctrl)
        let data = await sm.consume("l")
        XCTAssertEqual(data, Data([0x0C]), "Ctrl+L must emit Form Feed (0x0C)")
    }

    func testCtrlA_emits_SOH() async throws {
        let sm = make()
        await arm(sm, .ctrl)
        let data = await sm.consume("a")
        XCTAssertEqual(data, Data([0x01]), "Ctrl+A must emit SOH (0x01)")
    }

    func testCtrlZ_emits_SUB() async throws {
        let sm = make()
        await arm(sm, .ctrl)
        let data = await sm.consume("z")
        XCTAssertEqual(data, Data([0x1A]), "Ctrl+Z must emit SUB (0x1A)")
    }

    func testCtrl_uppercaseChar_treated_as_lowercase() async throws {
        // Toggle ctrl, send uppercase — should map same as lowercase
        let sm = make()
        await arm(sm, .ctrl)
        let data = await sm.consume("C")
        XCTAssertEqual(data, Data([0x03]), "Ctrl+C (uppercase input) must still emit 0x03")
    }

    // MARK: - Shift solo

    func testShift_solo_no_op() async throws {
        let sm = make()
        await arm(sm, .shift)
        let data = await sm.consume("a")
        // Shift alone on a letter: pass through as-is (caller handles shifted glyphs)
        XCTAssertEqual(data, Data("a".utf8), "Shift alone must pass char through unchanged")
    }

    // MARK: - Cmd

    func testCmd_C_emits_logical_sentinel() async throws {
        let sm = make()
        await arm(sm, .cmd)
        let data = await sm.consume("C")
        let str = String(data: data, encoding: .utf8) ?? ""
        XCTAssertTrue(str.hasPrefix("\u{1B}[Cmd:"), "Cmd+C must emit ESC[Cmd: sentinel, got '\(str)'")
        XCTAssertTrue(str.hasSuffix("C"), "Cmd+C sentinel must end with the key name")
    }

    // MARK: - Esc

    func testEsc_emits_ESC_byte() async throws {
        let sm = make()
        let data = await sm.consume("Esc")
        XCTAssertEqual(data, Data([0x1B]), "Esc must emit 0x1B")
    }

    // MARK: - Arrow keys

    func testArrow_up() async throws {
        let sm = make()
        let data = await sm.consume("Up")
        XCTAssertEqual(String(data: data, encoding: .utf8), "\u{1B}[A")
    }

    func testArrow_down() async throws {
        let sm = make()
        let data = await sm.consume("Down")
        XCTAssertEqual(String(data: data, encoding: .utf8), "\u{1B}[B")
    }

    func testArrow_right() async throws {
        let sm = make()
        let data = await sm.consume("Right")
        XCTAssertEqual(String(data: data, encoding: .utf8), "\u{1B}[C")
    }

    func testArrow_left() async throws {
        let sm = make()
        let data = await sm.consume("Left")
        XCTAssertEqual(String(data: data, encoding: .utf8), "\u{1B}[D")
    }

    // MARK: - Ctrl + Arrow (modifier arrow)

    func testCtrl_arrow_up_emits_modified_sequence() async throws {
        let sm = make()
        await arm(sm, .ctrl)
        let data = await sm.consume("Up")
        // Ctrl param = (0 | 4) + 1 = 5 → ESC[1;5A
        XCTAssertEqual(String(data: data, encoding: .utf8), "\u{1B}[1;5A")
    }

    // MARK: - Tab

    func testTab_emits_HT() async throws {
        let sm = make()
        let data = await sm.consume("Tab")
        XCTAssertEqual(data, Data([0x09]), "Tab must emit HT (0x09)")
    }

    func testShift_Tab_emits_reverse_tab() async throws {
        let sm = make()
        await arm(sm, .shift)
        let data = await sm.consume("Tab")
        XCTAssertEqual(String(data: data, encoding: .utf8), "\u{1B}[Z", "Shift+Tab must emit CSI Z")
    }

    // MARK: - Home / End / PgUp / PgDn

    func testHome() async throws {
        let sm = make()
        let data = await sm.consume("Home")
        XCTAssertEqual(String(data: data, encoding: .utf8), "\u{1B}[H")
    }

    func testEnd() async throws {
        let sm = make()
        let data = await sm.consume("End")
        XCTAssertEqual(String(data: data, encoding: .utf8), "\u{1B}[F")
    }

    func testPageUp() async throws {
        let sm = make()
        let data = await sm.consume("PgUp")
        XCTAssertEqual(String(data: data, encoding: .utf8), "\u{1B}[5~")
    }

    func testPageDown() async throws {
        let sm = make()
        let data = await sm.consume("PgDn")
        XCTAssertEqual(String(data: data, encoding: .utf8), "\u{1B}[6~")
    }

    // MARK: - Sticky reset after consume

    func testModifiers_reset_after_consume() async throws {
        let sm = make()
        await arm(sm, .ctrl)
        await arm(sm, .shift)

        // First consume: applies modifiers
        _ = await sm.consume("c")

        // Armed set must now be empty
        let armed = await sm.armed
        XCTAssertTrue(armed.isEmpty, "All modifiers must be disarmed after consume")
    }

    func testModifier_not_consumed_by_another_modifier_toggle() async throws {
        let sm = make()
        await arm(sm, .ctrl)

        // Toggling a modifier should NOT reset Ctrl
        await arm(sm, .shift)

        let armed = await sm.armed
        XCTAssertTrue(armed.contains(.ctrl),  "Ctrl should still be armed")
        XCTAssertTrue(armed.contains(.shift), "Shift should be armed after toggle")
    }

    func testDouble_toggle_disarms() async throws {
        let sm = make()
        await arm(sm, .ctrl)
        await arm(sm, .ctrl)  // toggle off

        let armed = await sm.armed
        XCTAssertFalse(armed.contains(.ctrl), "Double-toggle must disarm Ctrl")
    }

    // MARK: - Del

    func testDel_emits_DEL_byte() async throws {
        let sm = make()
        let data = await sm.consume("Del")
        XCTAssertEqual(data, Data([0x7F]), "Del must emit 0x7F")
    }
}
