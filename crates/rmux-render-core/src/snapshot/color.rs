use serde::{Deserialize, Serialize};

/// Color encoding carried by a captured pane cell.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[non_exhaustive]
pub enum PaneColor {
    /// Terminal default color sentinel.
    #[default]
    Default,
    /// Explicit no-color sentinel.
    None,
    /// Terminal color sentinel.
    Terminal,
    /// Standard ANSI color value `0..=7`.
    Ansi {
        /// Standard ANSI palette index.
        index: u8,
    },
    /// Bright ANSI color value `90..=97`.
    BrightAnsi {
        /// Bright ANSI palette index.
        index: u8,
    },
    /// 256-color palette value encoded with the RMUX/tmux 256-color flag.
    Indexed {
        /// 256-color palette index.
        index: u8,
    },
    /// True-color RGB value encoded with the RMUX/tmux RGB flag.
    Rgb {
        /// Red component.
        red: u8,
        /// Green component.
        green: u8,
        /// Blue component.
        blue: u8,
    },
    /// Unknown or future raw color encoding.
    Encoded {
        /// Raw encoded color value.
        value: i32,
    },
}

impl PaneColor {
    /// Raw encoding for the terminal default color.
    pub const DEFAULT_ENCODING: i32 = 8;
    /// Raw encoding for the explicit no-color sentinel.
    pub const NONE_ENCODING: i32 = -1;
    /// Raw encoding for the terminal color sentinel.
    pub const TERMINAL_ENCODING: i32 = 9;
    /// Raw flag for 256-color palette values.
    pub const INDEXED_FLAG: i32 = 0x0100_0000;
    /// Raw flag for true-color RGB values.
    pub const RGB_FLAG: i32 = 0x0200_0000;

    /// Creates a standard ANSI color value.
    #[must_use]
    pub const fn ansi(index: u8) -> Self {
        Self::Ansi { index }
    }

    /// Creates a bright ANSI color value.
    #[must_use]
    pub const fn bright_ansi(index: u8) -> Self {
        Self::BrightAnsi { index }
    }

    /// Creates a 256-color palette value.
    #[must_use]
    pub const fn indexed(index: u8) -> Self {
        Self::Indexed { index }
    }

    /// Creates an RGB true-color value.
    #[must_use]
    pub const fn rgb(red: u8, green: u8, blue: u8) -> Self {
        Self::Rgb { red, green, blue }
    }

    /// Creates a color DTO from a raw RMUX/tmux-compatible encoding.
    #[must_use]
    pub fn from_encoded(value: i32) -> Self {
        match value {
            Self::NONE_ENCODING => Self::None,
            Self::DEFAULT_ENCODING => Self::Default,
            Self::TERMINAL_ENCODING => Self::Terminal,
            0..=7 => Self::Ansi { index: value as u8 },
            90..=97 => Self::BrightAnsi {
                index: (value - 90) as u8,
            },
            _ if value & !(Self::INDEXED_FLAG | 0xff) == 0 && value & Self::INDEXED_FLAG != 0 => {
                Self::Indexed {
                    index: (value & 0xff) as u8,
                }
            }
            _ if value & !(Self::RGB_FLAG | 0x00ff_ffff) == 0 && value & Self::RGB_FLAG != 0 => {
                Self::Rgb {
                    red: ((value >> 16) & 0xff) as u8,
                    green: ((value >> 8) & 0xff) as u8,
                    blue: (value & 0xff) as u8,
                }
            }
            _ => Self::Encoded { value },
        }
    }

    /// Returns the raw RMUX/tmux-compatible color encoding.
    #[must_use]
    pub const fn encoded(self) -> i32 {
        match self {
            Self::Default => Self::DEFAULT_ENCODING,
            Self::None => Self::NONE_ENCODING,
            Self::Terminal => Self::TERMINAL_ENCODING,
            Self::Ansi { index } => index as i32,
            Self::BrightAnsi { index } => 90 + index as i32,
            Self::Indexed { index } => Self::INDEXED_FLAG | index as i32,
            Self::Rgb { red, green, blue } => {
                Self::RGB_FLAG | ((red as i32) << 16) | ((green as i32) << 8) | blue as i32
            }
            Self::Encoded { value } => value,
        }
    }
}
