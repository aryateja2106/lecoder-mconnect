use serde::{Deserialize, Serialize};

use super::{PaneAttributes, PaneColor, PaneGlyph};

/// One captured pane cell.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PaneCell {
    /// Captured glyph payload and display-width metadata.
    #[serde(default)]
    pub glyph: PaneGlyph,
    /// Cell attribute bitset.
    #[serde(default)]
    pub attributes: PaneAttributes,
    /// Foreground color.
    #[serde(default)]
    pub foreground: PaneColor,
    /// Background color.
    #[serde(default)]
    pub background: PaneColor,
    /// Underline color.
    #[serde(default)]
    pub underline: PaneColor,
}

impl PaneCell {
    /// Creates a cell with the given glyph and default style.
    #[must_use]
    pub fn new(glyph: PaneGlyph) -> Self {
        Self {
            glyph,
            ..Self::default()
        }
    }

    /// Creates a blank, non-padding cell with default style.
    #[must_use]
    pub fn blank() -> Self {
        Self::new(PaneGlyph::blank())
    }

    /// Creates a padding cell for the trailing column of a wide glyph.
    #[must_use]
    pub fn padding() -> Self {
        Self::new(PaneGlyph::padding())
    }

    /// Returns whether this cell is wide-glyph padding.
    #[must_use]
    pub const fn is_padding(&self) -> bool {
        self.glyph.is_padding()
    }

    /// Returns the stored glyph text payload.
    #[must_use]
    pub fn text(&self) -> &str {
        &self.glyph.text
    }
}

impl Default for PaneCell {
    fn default() -> Self {
        Self {
            glyph: PaneGlyph::blank(),
            attributes: PaneAttributes::EMPTY,
            foreground: PaneColor::Default,
            background: PaneColor::Default,
            underline: PaneColor::Default,
        }
    }
}
