//! In-memory pane state consumed by [`crate::PaneWidget`].

use crate::PaneSnapshot;

/// Captured projection of one pane that can be rendered synchronously.
#[derive(Debug, Default, Clone, PartialEq, Eq, Hash)]
pub struct PaneState {
    /// Most recently captured pane grid.
    pub snapshot: PaneSnapshot,
    /// Counts every applied snapshot revision change.
    pub generation: u64,
}

impl PaneState {
    /// Builds a state from an already-captured snapshot.
    #[must_use]
    pub const fn from_snapshot(snapshot: PaneSnapshot) -> Self {
        Self {
            snapshot,
            generation: 0,
        }
    }

    /// Returns the visible width of the captured snapshot.
    #[must_use]
    pub fn cols(&self) -> u16 {
        self.snapshot.cols
    }

    /// Returns the visible height of the captured snapshot.
    #[must_use]
    pub fn rows(&self) -> u16 {
        self.snapshot.rows
    }

    /// Returns the snapshot revision the state currently represents.
    #[must_use]
    pub fn revision(&self) -> u64 {
        self.snapshot.revision
    }

    /// Replaces the captured snapshot and bumps generation on revision changes.
    pub fn set_snapshot(&mut self, snapshot: PaneSnapshot) {
        let advanced = snapshot.revision != self.snapshot.revision;
        self.snapshot = snapshot;
        if advanced {
            self.generation = self.generation.saturating_add(1);
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{PaneCell, PaneCursor, PaneSnapshot, PaneState};

    #[test]
    fn set_snapshot_bumps_generation_only_on_revision_change() {
        let first = PaneSnapshot::new(1, 1, vec![PaneCell::blank()], PaneCursor::default())
            .expect("valid")
            .with_revision(1);
        let second = PaneSnapshot::new(1, 1, vec![PaneCell::blank()], PaneCursor::default())
            .expect("valid")
            .with_revision(2);

        let mut state = PaneState::from_snapshot(first.clone());
        state.set_snapshot(first);
        assert_eq!(state.generation, 0);

        state.set_snapshot(second);
        assert_eq!(state.generation, 1);
    }
}
