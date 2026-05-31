//! Pane-split direction for the ergonomic high-level SDK.
//!
//! Names describe **where the new pane appears** relative to the active one.
//! This deliberately avoids the historical `Horizontal`/`Vertical` labels,
//! which depend on whether you mean the divider-line orientation or the
//! pane arrangement (tmux uses the latter; readers of source code often
//! assume the former). `Right`/`Left`/`Up`/`Down` admits exactly one
//! reading.
//!
//! The four directions map to the rmux daemon's two-axis split plus the
//! tmux `-b` flag — see [`SplitDirection::axis`] and
//! [`SplitDirection::before`].

/// Direction of a `Pane::split` call.
///
/// Named by **where the new pane lands** relative to the pane being split.
/// Internally each variant decomposes into an axis and an insertion side
/// (after / before the target), matching the tmux `split-window` model.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[non_exhaustive]
pub enum SplitDirection {
    /// New pane to the right of the active pane (vertical divider line).
    Right,
    /// New pane to the left of the active pane (vertical divider line).
    ///
    /// Equivalent to tmux `split-window -h -b`.
    Left,
    /// New pane below the active pane (horizontal divider line).
    Down,
    /// New pane above the active pane (horizontal divider line).
    ///
    /// Equivalent to tmux `split-window -v -b`.
    Up,
}

impl SplitDirection {
    /// Returns the daemon-side axis of this split direction.
    ///
    /// `Right`/`Left` split the horizontal axis (panes end up side by side);
    /// `Up`/`Down` split the vertical axis (panes end up stacked).
    pub(crate) fn axis(self) -> rmux_proto::SplitDirection {
        match self {
            Self::Right | Self::Left => rmux_proto::SplitDirection::Horizontal,
            Self::Up | Self::Down => rmux_proto::SplitDirection::Vertical,
        }
    }

    /// Returns `true` when the new pane is inserted *before* the active
    /// pane on the chosen axis (matches the tmux `-b` flag).
    pub(crate) fn before(self) -> bool {
        matches!(self, Self::Left | Self::Up)
    }
}

#[cfg(test)]
mod tests {
    use super::SplitDirection;

    #[test]
    fn right_and_down_insert_after() {
        assert!(!SplitDirection::Right.before());
        assert!(!SplitDirection::Down.before());
    }

    #[test]
    fn left_and_up_insert_before() {
        assert!(SplitDirection::Left.before());
        assert!(SplitDirection::Up.before());
    }

    #[test]
    fn horizontal_directions_share_an_axis() {
        assert_eq!(SplitDirection::Right.axis(), SplitDirection::Left.axis());
    }

    #[test]
    fn vertical_directions_share_an_axis() {
        assert_eq!(SplitDirection::Up.axis(), SplitDirection::Down.axis());
    }

    #[test]
    fn horizontal_and_vertical_axes_differ() {
        assert_ne!(SplitDirection::Right.axis(), SplitDirection::Down.axis());
    }
}
