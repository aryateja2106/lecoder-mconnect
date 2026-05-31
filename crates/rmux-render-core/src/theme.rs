//! Pure mapping from RMUX pane values to ratatui style values.

use ratatui_core::style::{Color, Modifier, Style};

use crate::{PaneAttributes, PaneCell, PaneColor, PaneGlyph};

/// Translates a [`PaneColor`] into a ratatui [`Color`].
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
    }
}

/// Translates a [`PaneAttributes`] bitset into a ratatui [`Modifier`].
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

/// Returns the symbol a ratatui buffer cell should display for a glyph.
#[must_use]
pub fn glyph_symbol(glyph: &PaneGlyph) -> &str {
    if glyph.is_padding() {
        ""
    } else {
        glyph.text.as_str()
    }
}
