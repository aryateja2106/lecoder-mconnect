//! Colour representation matching tmux colour model.

/// A terminal colour value.
///
/// - Values 0–7 are standard colours.
/// - Value 8 is the default colour.
/// - `COLOUR_FLAG_256 | idx` for 256-colour palette.
/// - `COLOUR_FLAG_RGB | (r << 16) | (g << 8) | b` for RGB.
pub type Colour = i32;

/// Default colour sentinel.
pub const COLOUR_DEFAULT: Colour = 8;

/// No-colour sentinel used by tmux `colour_tostring`.
pub const COLOUR_NONE: Colour = -1;

/// Terminal colour sentinel.
pub const COLOUR_TERMINAL: Colour = 9;

/// Flag for 256-colour palette indices.
pub const COLOUR_FLAG_256: Colour = 0x0100_0000;

/// Flag for true-colour RGB values.
pub const COLOUR_FLAG_RGB: Colour = 0x0200_0000;

/// Compose an RGB colour from r, g, b components.
#[must_use]
pub fn colour_join_rgb(r: u8, g: u8, b: u8) -> Colour {
    COLOUR_FLAG_RGB | (i32::from(r) << 16) | (i32::from(g) << 8) | i32::from(b)
}
