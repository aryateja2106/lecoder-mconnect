//! Pure mapping from RMUX SDK pane values to ratatui style values.
//!
//! Every function in this module is a total, side-effect-free mapping:
//! the same input always produces the same output and the function never
//! reads time, the filesystem, the network, or any other ambient state.
//! The widget renderer relies on this property; see
//! `crates/ratatui-rmux/tests/render.rs` for the property-style proofs
//! that exercise every branch.

use ratatui_core::style::{Color, Modifier, Style};
use rmux_sdk::{PaneAttributes, PaneCell, PaneColor, PaneGlyph};

/// Translates an SDK [`PaneColor`] into a ratatui [`Color`].
///
/// `PaneColor::Default`, `PaneColor::None`, and `PaneColor::Terminal`
/// all collapse to [`Color::Reset`] because ratatui has a single
/// "use the terminal default" sentinel; SDK consumers that need to
/// distinguish them can read the original [`PaneColor`] directly. ANSI
/// indices `0..=7` map to the eight ANSI colors, bright ANSI indices
/// `0..=7` map to the eight bright ANSI colors, 256-palette values map
/// to [`Color::Indexed`], and RGB triples map to [`Color::Rgb`].
/// Out-of-range or unknown encodings collapse to [`Color::Reset`] so
/// that no SDK value can panic the widget.
#[must_use]
pub fn color(value: PaneColor) -> Color {
    match value {
        PaneColor::Default | PaneColor::None | PaneColor::Terminal => Color::Reset,
        PaneColor::Ansi { index } => match index & 0x07 {
            0 => Color::Black,
            1 => Color::Red,
            2 => Color::Green,
            3 => Color::Yellow,
            4 => Color::Blue,
            5 => Color::Magenta,
            6 => Color::Cyan,
            _ => Color::Gray,
        },
        PaneColor::BrightAnsi { index } => match index & 0x07 {
            0 => Color::DarkGray,
            1 => Color::LightRed,
            2 => Color::LightGreen,
            3 => Color::LightYellow,
            4 => Color::LightBlue,
            5 => Color::LightMagenta,
            6 => Color::LightCyan,
            _ => Color::White,
        },
        PaneColor::Indexed { index } => Color::Indexed(index),
        PaneColor::Rgb { red, green, blue } => Color::Rgb(red, green, blue),
        PaneColor::Encoded { .. } => Color::Reset,
        // `PaneColor` is `#[non_exhaustive]` — any future variant
        // collapses to the safe terminal-default fallback.
        _ => Color::Reset,
    }
}

/// Translates an SDK [`PaneAttributes`] bitset into a ratatui [`Modifier`].
///
/// Bits without a direct ratatui counterpart (the `CHARSET` ACS hint, the
/// `NO_ATTRIBUTES` clear-only marker, and the various non-single
/// underline variants) are folded onto the closest ratatui modifier.
/// The mapping never adds modifiers that are not implied by the input
/// bitset, so an empty input always returns [`Modifier::empty`].
#[must_use]
pub fn modifier(value: PaneAttributes) -> Modifier {
    let mut bits = Modifier::empty();
    if value.contains(PaneAttributes::BOLD) {
        bits |= Modifier::BOLD;
    }
    if value.contains(PaneAttributes::DIM) {
        bits |= Modifier::DIM;
    }
    if value.contains(PaneAttributes::ITALIC) {
        bits |= Modifier::ITALIC;
    }
    if !(value & PaneAttributes::ALL_UNDERSCORE).is_empty() {
        bits |= Modifier::UNDERLINED;
    }
    if value.contains(PaneAttributes::BLINK) {
        bits |= Modifier::SLOW_BLINK;
    }
    if value.contains(PaneAttributes::REVERSE) {
        bits |= Modifier::REVERSED;
    }
    if value.contains(PaneAttributes::HIDDEN) {
        bits |= Modifier::HIDDEN;
    }
    if value.contains(PaneAttributes::STRIKETHROUGH) {
        bits |= Modifier::CROSSED_OUT;
    }
    bits
}

/// Translates a captured [`PaneCell`] into a ratatui [`Style`].
#[must_use]
pub fn cell_style(cell: &PaneCell) -> Style {
    Style::default()
        .fg(color(cell.foreground))
        .bg(color(cell.background))
        .add_modifier(modifier(cell.attributes))
}

/// Returns the symbol a ratatui buffer cell should display for an SDK glyph.
///
/// Padding glyphs render as the empty string so the leading wide-glyph
/// cell can carry the original payload without overwriting the padding
/// column. Non-padding glyphs forward their stored text payload, which
/// is the lossless RMUX grid contents (including zero-width glyphs).
#[must_use]
pub fn glyph_symbol(glyph: &PaneGlyph) -> &str {
    if glyph.is_padding() {
        ""
    } else {
        glyph.text.as_str()
    }
}
