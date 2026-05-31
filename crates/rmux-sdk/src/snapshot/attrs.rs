use serde::{Deserialize, Serialize};

/// Cell attribute bits matching the RMUX/tmux grid attribute bit layout.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PaneAttributes {
    /// Raw attribute bitset.
    pub bits: u16,
}

impl PaneAttributes {
    /// Empty attribute bitset.
    pub const EMPTY: Self = Self { bits: 0 };
    /// Bold attribute bit.
    pub const BOLD: Self = Self { bits: 0x1 };
    /// tmux-compatible alias for [`Self::BOLD`].
    pub const BRIGHT: Self = Self::BOLD;
    /// Dim attribute bit.
    pub const DIM: Self = Self { bits: 0x2 };
    /// Single underline attribute bit.
    pub const UNDERLINE: Self = Self { bits: 0x4 };
    /// tmux-compatible alias for [`Self::UNDERLINE`].
    pub const UNDERSCORE: Self = Self::UNDERLINE;
    /// Blink attribute bit.
    pub const BLINK: Self = Self { bits: 0x8 };
    /// Reverse-video attribute bit.
    pub const REVERSE: Self = Self { bits: 0x10 };
    /// Hidden attribute bit.
    pub const HIDDEN: Self = Self { bits: 0x20 };
    /// Italic attribute bit.
    pub const ITALIC: Self = Self { bits: 0x40 };
    /// tmux-compatible alias for [`Self::ITALIC`].
    pub const ITALICS: Self = Self::ITALIC;
    /// ACS line-drawing charset attribute bit.
    pub const CHARSET: Self = Self { bits: 0x80 };
    /// Strikethrough attribute bit.
    pub const STRIKETHROUGH: Self = Self { bits: 0x100 };
    /// Double underline attribute bit.
    pub const DOUBLE_UNDERLINE: Self = Self { bits: 0x200 };
    /// Curly underline attribute bit.
    pub const CURLY_UNDERLINE: Self = Self { bits: 0x400 };
    /// Dotted underline attribute bit.
    pub const DOTTED_UNDERLINE: Self = Self { bits: 0x800 };
    /// Dashed underline attribute bit.
    pub const DASHED_UNDERLINE: Self = Self { bits: 0x1000 };
    /// Overline attribute bit.
    pub const OVERLINE: Self = Self { bits: 0x2000 };
    /// Explicit no-inherited-attributes bit.
    pub const NO_ATTRIBUTES: Self = Self { bits: 0x4000 };
    /// tmux-compatible alias for [`Self::NO_ATTRIBUTES`].
    pub const NOATTR: Self = Self::NO_ATTRIBUTES;
    /// All underline variant bits combined.
    pub const ALL_UNDERSCORE: Self = Self {
        bits: Self::UNDERLINE.bits
            | Self::DOUBLE_UNDERLINE.bits
            | Self::CURLY_UNDERLINE.bits
            | Self::DOTTED_UNDERLINE.bits
            | Self::DASHED_UNDERLINE.bits,
    };

    /// Creates an attribute set from raw bits.
    #[must_use]
    pub const fn from_bits(bits: u16) -> Self {
        Self { bits }
    }

    /// Returns the raw attribute bits.
    #[must_use]
    pub const fn bits(self) -> u16 {
        self.bits
    }

    /// Returns whether this bitset contains every bit in `other`.
    #[must_use]
    pub const fn contains(self, other: Self) -> bool {
        self.bits & other.bits == other.bits
    }

    /// Returns whether no attribute bits are set.
    #[must_use]
    pub const fn is_empty(self) -> bool {
        self.bits == 0
    }
}

impl std::ops::BitOr for PaneAttributes {
    type Output = Self;

    fn bitor(self, rhs: Self) -> Self::Output {
        Self {
            bits: self.bits | rhs.bits,
        }
    }
}

impl std::ops::BitOrAssign for PaneAttributes {
    fn bitor_assign(&mut self, rhs: Self) {
        self.bits |= rhs.bits;
    }
}

impl std::ops::BitAnd for PaneAttributes {
    type Output = Self;

    fn bitand(self, rhs: Self) -> Self::Output {
        Self {
            bits: self.bits & rhs.bits,
        }
    }
}
