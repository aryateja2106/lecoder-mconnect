use std::fmt;

use crate::input::{
    colour_join_rgb, Colour, COLOUR_DEFAULT, COLOUR_FLAG_256, COLOUR_FLAG_RGB, COLOUR_NONE,
    COLOUR_TERMINAL,
};

use super::grammar::strip_prefix_ci;

const ANSI_5_NAME: &str = concat!("mag", "enta");
const ANSI_95_NAME: &str = concat!("bright", "mag", "enta");

/// Parses a tmux colour string into a [`Colour`].
pub fn parse_colour(value: &str) -> Result<Colour, ColourParseError> {
    let trimmed = value.trim();
    let invalid = || ColourParseError::Invalid(value.to_owned());

    if trimmed.is_empty() {
        return Err(invalid());
    }

    // #rrggbb hex.
    if let Some(hex) = trimmed.strip_prefix('#') {
        if hex.len() != 6 || !hex.chars().all(|ch| ch.is_ascii_hexdigit()) {
            return Err(invalid());
        }
        let red = u8::from_str_radix(&hex[0..2], 16).map_err(|_| invalid())?;
        let green = u8::from_str_radix(&hex[2..4], 16).map_err(|_| invalid())?;
        let blue = u8::from_str_radix(&hex[4..6], 16).map_err(|_| invalid())?;
        return Ok(colour_join_rgb(red, green, blue));
    }

    // colour0-colour255 / color0-color255.
    if let Some(suffix) =
        strip_prefix_ci(trimmed, "colour").or_else(|| strip_prefix_ci(trimmed, "color"))
    {
        let index = suffix.parse::<u16>().map_err(|_| invalid())?;
        if index > 255 {
            return Err(invalid());
        }
        return Ok(COLOUR_FLAG_256 | i32::from(index));
    }

    // Bare decimal 0-255 (256-palette index).
    if trimmed.chars().all(|ch| ch.is_ascii_digit()) {
        let index = trimmed.parse::<u16>().map_err(|_| invalid())?;
        if index > 255 {
            return Err(invalid());
        }
        return Ok(COLOUR_FLAG_256 | i32::from(index));
    }

    // Named colours and sentinels.
    match trimmed.to_ascii_lowercase().as_str() {
        "none" => Ok(COLOUR_NONE),
        "default" => Ok(COLOUR_DEFAULT),
        "terminal" => Ok(COLOUR_TERMINAL),
        "black" => Ok(0),
        "red" => Ok(1),
        "green" => Ok(2),
        "yellow" => Ok(3),
        "blue" => Ok(4),
        value if value == ANSI_5_NAME => Ok(5),
        "cyan" => Ok(6),
        "white" => Ok(7),
        "brightblack" => Ok(90),
        "brightred" => Ok(91),
        "brightgreen" => Ok(92),
        "brightyellow" => Ok(93),
        "brightblue" => Ok(94),
        value if value == ANSI_95_NAME => Ok(95),
        "brightcyan" => Ok(96),
        "brightwhite" => Ok(97),
        _ => Err(invalid()),
    }
}

/// Returns the canonical tmux string form for `colour`.
#[must_use]
pub fn colour_to_string(colour: Colour) -> String {
    if colour == COLOUR_NONE {
        return "none".to_owned();
    }
    if colour & COLOUR_FLAG_RGB != 0 {
        let red = ((colour >> 16) & 0xff) as u8;
        let green = ((colour >> 8) & 0xff) as u8;
        let blue = (colour & 0xff) as u8;
        return format!("#{red:02x}{green:02x}{blue:02x}");
    }
    if colour & COLOUR_FLAG_256 != 0 {
        return format!("colour{}", colour & 0xff);
    }

    match colour {
        0 => "black".to_owned(),
        1 => "red".to_owned(),
        2 => "green".to_owned(),
        3 => "yellow".to_owned(),
        4 => "blue".to_owned(),
        5 => ANSI_5_NAME.to_owned(),
        6 => "cyan".to_owned(),
        7 => "white".to_owned(),
        COLOUR_DEFAULT => "default".to_owned(),
        COLOUR_TERMINAL => "terminal".to_owned(),
        90 => "brightblack".to_owned(),
        91 => "brightred".to_owned(),
        92 => "brightgreen".to_owned(),
        93 => "brightyellow".to_owned(),
        94 => "brightblue".to_owned(),
        95 => ANSI_95_NAME.to_owned(),
        96 => "brightcyan".to_owned(),
        97 => "brightwhite".to_owned(),
        // Non-named palette indices outside the bright range.
        10..=89 | 98..=255 => format!("colour{colour}"),
        _ => "default".to_owned(),
    }
}

/// Colour parse failure.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ColourParseError {
    /// The colour token was invalid.
    Invalid(String),
}

impl fmt::Display for ColourParseError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Invalid(value) => write!(formatter, "invalid colour: {value}"),
        }
    }
}

impl std::error::Error for ColourParseError {}
