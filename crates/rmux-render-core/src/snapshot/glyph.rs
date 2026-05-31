use serde::{Deserialize, Serialize};

/// Captured glyph payload for one grid cell.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PaneGlyph {
    /// Stored text payload.
    #[serde(default = "default_glyph_text")]
    pub text: String,
    /// Display width recorded by the terminal grid.
    #[serde(default = "default_glyph_width")]
    pub width: u8,
    /// Whether this is padding for a preceding wide glyph.
    #[serde(default)]
    pub padding: bool,
}

impl PaneGlyph {
    /// Creates a non-padding glyph from already-recorded text and width.
    #[must_use]
    pub fn new(text: impl Into<String>, width: u8) -> Self {
        Self {
            text: text.into(),
            width,
            padding: false,
        }
    }

    /// Creates a blank, single-width glyph.
    #[must_use]
    pub fn blank() -> Self {
        Self {
            text: " ".to_owned(),
            width: 1,
            padding: false,
        }
    }

    /// Creates a padding marker for the trailing column of a wide glyph.
    #[must_use]
    pub fn padding() -> Self {
        Self {
            text: " ".to_owned(),
            width: 0,
            padding: true,
        }
    }

    /// Returns whether this glyph is a padding marker.
    #[must_use]
    pub const fn is_padding(&self) -> bool {
        self.padding
    }
}

impl Default for PaneGlyph {
    fn default() -> Self {
        Self::blank()
    }
}

fn default_glyph_text() -> String {
    " ".to_owned()
}

const fn default_glyph_width() -> u8 {
    1
}
