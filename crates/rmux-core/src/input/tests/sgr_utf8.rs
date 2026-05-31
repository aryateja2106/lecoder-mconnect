use super::*;

#[test]
fn sgr_reset() {
    let (p, _w) = parse(b"\x1b[1m\x1b[0m");
    assert_eq!(p.cell.attr(), 0);
}

#[test]
fn sgr_bold_dim_italics() {
    let (p, _w) = parse(b"\x1b[1;2;3m");
    assert!(p.cell.attr() & GridAttr::BRIGHT != 0);
    assert!(p.cell.attr() & GridAttr::DIM != 0);
    assert!(p.cell.attr() & GridAttr::ITALICS != 0);
}

#[test]
fn sgr_underline() {
    let (p, _w) = parse(b"\x1b[4m");
    assert!(p.cell.attr() & GridAttr::UNDERSCORE != 0);
}

#[test]
fn sgr_blink_reverse_hidden_strikethrough() {
    let (p, _w) = parse(b"\x1b[5;7;8;9m");
    assert!(p.cell.attr() & GridAttr::BLINK != 0);
    assert!(p.cell.attr() & GridAttr::REVERSE != 0);
    assert!(p.cell.attr() & GridAttr::HIDDEN != 0);
    assert!(p.cell.attr() & GridAttr::STRIKETHROUGH != 0);
}

#[test]
fn sgr_fg_colour() {
    let (p, _w) = parse(b"\x1b[31m");
    assert_eq!(p.cell.fg(), 1); // tmux stores n-30 for standard colours
}

#[test]
fn sgr_bg_colour() {
    let (p, _w) = parse(b"\x1b[42m");
    assert_eq!(p.cell.bg(), 42 - 40);
}

#[test]
fn sgr_256_fg() {
    let (p, _w) = parse(b"\x1b[38;5;196m");
    assert_eq!(p.cell.fg(), 196 | COLOUR_FLAG_256);
}

#[test]
fn sgr_256_bg() {
    let (p, _w) = parse(b"\x1b[48;5;22m");
    assert_eq!(p.cell.bg(), 22 | COLOUR_FLAG_256);
}

#[test]
fn sgr_rgb_fg() {
    let (p, _w) = parse(b"\x1b[38;2;255;128;0m");
    let expected = COLOUR_FLAG_RGB | (255 << 16) | (128 << 8);
    assert_eq!(p.cell.fg(), expected);
}

#[test]
fn sgr_rgb_bg() {
    let (p, _w) = parse(b"\x1b[48;2;10;20;30m");
    let expected = COLOUR_FLAG_RGB | (10 << 16) | (20 << 8) | 30;
    assert_eq!(p.cell.bg(), expected);
}

#[test]
fn sgr_default_fg_bg() {
    let (p, _w) = parse(b"\x1b[31;42m\x1b[39;49m");
    assert_eq!(p.cell.fg(), COLOUR_DEFAULT);
    assert_eq!(p.cell.bg(), COLOUR_DEFAULT);
}

#[test]
fn sgr_bright_fg() {
    let (p, _w) = parse(b"\x1b[90m");
    assert_eq!(p.cell.fg(), 90);
}

#[test]
fn sgr_bright_bg() {
    let (p, _w) = parse(b"\x1b[100m");
    assert_eq!(p.cell.bg(), 100 - 10);
}

#[test]
fn sgr_overline() {
    let (p, _w) = parse(b"\x1b[53m");
    assert!(p.cell.attr() & GridAttr::OVERLINE != 0);
    let (p, _w) = parse(b"\x1b[53m\x1b[55m");
    assert!(p.cell.attr() & GridAttr::OVERLINE == 0);
}

#[test]
fn sgr_underscore_reset() {
    let (p, _w) = parse(b"\x1b[4m\x1b[24m");
    assert!(p.cell.attr() & GridAttr::ALL_UNDERSCORE == 0);
}

#[test]
fn sgr_double_underline() {
    let (p, _w) = parse(b"\x1b[21m");
    assert!(p.cell.attr() & GridAttr::UNDERSCORE_2 != 0);
}

#[test]
fn sgr_colon_underscore_styles() {
    // 4:3 = curly underline
    let (p, _w) = parse(b"\x1b[4:3m");
    assert!(p.cell.attr() & GridAttr::UNDERSCORE_3 != 0);
    // 4:0 = remove underscores
    let (p, _w) = parse(b"\x1b[4:3m\x1b[4:0m");
    assert_eq!(p.cell.attr() & GridAttr::ALL_UNDERSCORE, 0);
}

#[test]
fn sgr_colon_rgb() {
    // 38:2:r:g:b format (without colour space ID)
    let (p, _w) = parse(b"\x1b[38:2:100:200:50m");
    let expected = COLOUR_FLAG_RGB | (100 << 16) | (200 << 8) | 50;
    assert_eq!(p.cell.fg(), expected);
}

#[test]
fn sgr_colon_256() {
    // 38:5:196 format
    let (p, _w) = parse(b"\x1b[38:5:196m");
    assert_eq!(p.cell.fg(), 196 | COLOUR_FLAG_256);
}

#[test]
fn sgr_underline_colour() {
    let (p, _w) = parse(b"\x1b[58;5;123m");
    assert_eq!(p.cell.us(), 123 | COLOUR_FLAG_256);
}

#[test]
fn sgr_underline_colour_reset() {
    let (p, _w) = parse(b"\x1b[58;5;123m\x1b[59m");
    assert_eq!(p.cell.us(), COLOUR_DEFAULT);
}

// ─── UTF-8 tests ───────────────────────────────────────────────────

#[test]
fn utf8_two_byte_character() {
    let (p, w) = parse("é".as_bytes());
    assert_eq!(p.state(), InputState::Ground);
    assert_eq!(w.chars, vec!['é']);
}

#[test]
fn utf8_three_byte_character() {
    let (p, w) = parse("→".as_bytes());
    assert_eq!(p.state(), InputState::Ground);
    assert_eq!(w.chars, vec!['→']);
}

#[test]
fn utf8_four_byte_character() {
    let (p, w) = parse("🎉".as_bytes());
    assert_eq!(p.state(), InputState::Ground);
    assert_eq!(w.chars, vec!['🎉']);
}

#[test]
fn utf8_invalid_sequence_emits_replacement() {
    // Invalid: continuation byte without start.
    let (_, w) = parse(b"\x80");
    // Should emit U+FFFD eventually.
    assert!(w.chars.contains(&'\u{FFFD}'));
}

// ─── Since-ground buffer tests ─────────────────────────────────────

#[test]
fn since_ground_accumulates_non_ground_bytes() {
    let mut parser = InputParser::new();
    let mut writer = RecordingWriter::new(80, 24);
    parser.parse(b"\x1b[1m", &mut writer);
    // After CSI dispatches back to ground, since_ground should be cleared.
    assert!(parser.since_ground.is_empty());
}

#[test]
fn since_ground_accumulates_during_partial_sequence() {
    let mut parser = InputParser::new();
    let mut writer = RecordingWriter::new(80, 24);
    parser.parse(b"\x1b[", &mut writer);
    // In csi_enter: since_ground should have the '['.
    assert!(!parser.since_ground.is_empty());
}

// ─── OSC tests ─────────────────────────────────────────────────────
