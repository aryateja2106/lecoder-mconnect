use super::*;

#[test]
fn ground_state_processes_printable_ascii() {
    let (parser, writer) = parse(b"hello");
    assert_eq!(parser.state(), InputState::Ground);
    assert_eq!(writer.chars, vec!['h', 'e', 'l', 'l', 'o']);
}

#[test]
fn esc_transitions_to_esc_enter() {
    let mut parser = InputParser::new();
    let mut writer = RecordingWriter::new(80, 24);
    // ESC alone leaves us in esc_enter.
    parser.parse(b"\x1b", &mut writer);
    assert_eq!(parser.state(), InputState::EscEnter);
}

#[test]
fn csi_transitions_correctly() {
    let mut parser = InputParser::new();
    let mut writer = RecordingWriter::new(80, 24);
    parser.parse(b"\x1b[", &mut writer);
    assert_eq!(parser.state(), InputState::CsiEnter);
    parser.parse(b"1", &mut writer);
    assert_eq!(parser.state(), InputState::CsiParameter);
    parser.parse(b"A", &mut writer); // CUU
    assert_eq!(parser.state(), InputState::Ground);
    assert!(writer.has_call("cursor_up(1)"));
}

#[test]
fn osc_transitions_and_terminates_with_st() {
    let (parser, writer) = parse(b"\x1b]2;My Title\x1b\\");
    assert_eq!(parser.state(), InputState::Ground);
    assert!(writer.has_call("set_title(\"My Title\")"));
}

#[test]
fn osc_terminates_with_bel() {
    let (parser, writer) = parse(b"\x1b]0;BEL Title\x07");
    assert_eq!(parser.state(), InputState::Ground);
    assert!(writer.has_call("set_title(\"BEL Title\")"));
}

#[test]
fn dcs_handler_no_anywhere_transitions() {
    let mut parser = InputParser::new();
    let mut writer = RecordingWriter::new(80, 24);
    // DCS with passthrough data.
    parser.parse(b"\x1bP", &mut writer);
    assert_eq!(parser.state(), InputState::DcsEnter);
    parser.parse(b"q", &mut writer); // Final byte -> DcsHandler
    assert_eq!(parser.state(), InputState::DcsHandler);
    // 0x18 in DCS handler does NOT go to ground (no ANYWHERE).
    parser.parse(b"\x18", &mut writer);
    assert_eq!(parser.state(), InputState::DcsHandler);
}

#[test]
fn dcs_escape_only_backslash_terminates() {
    let mut parser = InputParser::new();
    let mut writer = RecordingWriter::new(80, 24);
    parser.parse(b"\x1bPq", &mut writer);
    assert_eq!(parser.state(), InputState::DcsHandler);
    // ESC inside DCS -> DcsEscape.
    parser.parse(b"\x1b", &mut writer);
    assert_eq!(parser.state(), InputState::DcsEscape);
    // Non-backslash ESC goes back to DcsHandler.
    parser.parse(b"[", &mut writer);
    assert_eq!(parser.state(), InputState::DcsHandler);
    // ESC + backslash terminates.
    parser.parse(b"\x1b\\", &mut writer);
    assert_eq!(parser.state(), InputState::Ground);
}

#[test]
fn consume_st_absorbs_sos_sequence() {
    let mut parser = InputParser::new();
    let mut writer = RecordingWriter::new(80, 24);
    // ESC X (SOS) -> consume_st.
    parser.parse(b"\x1bX", &mut writer);
    assert_eq!(parser.state(), InputState::ConsumeSt);
    // Data is absorbed.
    parser.parse(b"any data here", &mut writer);
    assert_eq!(parser.state(), InputState::ConsumeSt);
    // ST terminates (ESC \\).
    parser.parse(b"\x1b\\", &mut writer);
    assert_eq!(parser.state(), InputState::Ground);
}

#[test]
fn rename_string_state() {
    let (parser, writer) = parse(b"\x1bkMyWindow\x1b\\");
    assert_eq!(parser.state(), InputState::Ground);
    assert!(writer.has_call("set_window_name(\"MyWindow\")"));
}

#[test]
fn apc_string_sets_title() {
    let (parser, writer) = parse(b"\x1b_APC Title\x1b\\");
    assert_eq!(parser.state(), InputState::Ground);
    assert!(writer.has_call("set_title(\"APC Title\")"));
}

#[test]
fn kitty_graphics_apc_uses_passthrough() {
    let (parser, writer) = parse(b"\x1b_Gf=100;AAAA\x1b\\");
    assert_eq!(parser.state(), InputState::Ground);
    assert!(writer.has_call("apc_passthrough(\"Gf=100;AAAA\")"));
    assert!(!writer.has_call("set_title("));
}

// ─── C0 dispatch tests ────────────────────────────────────────────

#[test]
fn c0_bel_rings_bell() {
    let (_p, w) = parse(b"\x07");
    assert!(w.has_call("bell()"));
}

#[test]
fn c0_bs_backspace() {
    let (_p, w) = parse(b"\x08");
    assert!(w.has_call("backspace()"));
}

#[test]
fn c0_ht_tab() {
    let (_p, w) = parse(b"\x09");
    assert!(w.has_call("tab()"));
}

#[test]
fn c0_lf_linefeed() {
    let (_p, w) = parse(b"\x0a");
    assert!(w.has_call("linefeed(false,"));
}

#[test]
fn c0_cr_carriage_return() {
    let (_p, w) = parse(b"\x0d");
    assert!(w.has_call("carriage_return()"));
}

#[test]
fn c0_so_si_charset_switching() {
    let (p, _w) = parse(b"\x0e");
    assert_eq!(p.cell.set, 1);
    let (p, _w) = parse(b"\x0e\x0f");
    assert_eq!(p.cell.set, 0);
}

// ─── ESC dispatch tests ───────────────────────────────────────────

#[test]
fn esc_ris_full_reset() {
    let (_p, w) = parse(b"\x1bc");
    assert!(w.has_call("full_reset()"));
}

#[test]
fn esc_ind_linefeed() {
    let (_p, w) = parse(b"\x1bD");
    assert!(w.has_call("linefeed(false,"));
}

#[test]
fn esc_nel_cr_lf() {
    let (_p, w) = parse(b"\x1bE");
    assert!(w.has_call("carriage_return()"));
    assert!(w.has_call("linefeed(false,"));
}

#[test]
fn esc_hts_set_tab() {
    let (_p, w) = parse(b"\x1bH");
    assert!(w.has_call("set_tab_stop()"));
}

#[test]
fn esc_ri_reverse_index() {
    let (_p, w) = parse(b"\x1bM");
    assert!(w.has_call("reverse_index("));
}

#[test]
fn esc_deckpam_deckpnm() {
    let (_p, w) = parse(b"\x1b=");
    assert!(w.has_call("mode_set(0x8)"));
    let (_p, w) = parse(b"\x1b>");
    assert!(w.has_call("mode_clear(0x8)"));
}

#[test]
fn esc_decsc_decrc_save_restore() {
    let (p, _w) = parse(b"\x1b7");
    assert_eq!(p.saved.cx, 0);
    assert_eq!(p.saved.cy, 0);
}

#[test]
fn esc_decaln_alignment_test() {
    let (_p, w) = parse(b"\x1b#8");
    assert!(w.has_call("alignment_test()"));
}

#[test]
fn esc_scsg0_on_off() {
    let (p, _w) = parse(b"\x1b(0");
    assert_eq!(p.cell.g0set, 1);
    let (p, _w) = parse(b"\x1b(B");
    assert_eq!(p.cell.g0set, 0);
}

#[test]
fn esc_scsg1_on_off() {
    let (p, _w) = parse(b"\x1b)0");
    assert_eq!(p.cell.g1set, 1);
    let (p, _w) = parse(b"\x1b)B");
    assert_eq!(p.cell.g1set, 0);
}

// ─── CSI dispatch tests ───────────────────────────────────────────
