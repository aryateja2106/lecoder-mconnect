//! In-memory pane state owned by the [`crate::driver::PaneDriver`].
//!
//! `PaneState` is a deterministic, sync, plain-data projection of the
//! daemon's view of one pane. It carries an `rmux_sdk::PaneSnapshot` and
//! a small set of derived flags. The state is intentionally `Clone` so
//! the async driver can hand a snapshot to a sync widget caller without
//! forcing a reference dance across `await` points.
//!
//! The widget reads `PaneState` and only `PaneState`. Anything that
//! requires I/O — fresh snapshots, lag notices, exit reasons — is
//! folded into this struct *before* the widget renders.

use rmux_sdk::{
    PaneDisconnectReason, PaneEvent, PaneExitReason, PaneId, PaneLagNotice, PaneSnapshot,
};

/// Captured projection of one pane that a [`crate::widget::PaneWidget`]
/// can render synchronously.
///
/// `PaneState` stays plain-data and `Clone`. Drivers update an owned
/// instance and hand a snapshot to the widget; the widget never touches
/// the live driver state directly.
#[derive(Debug, Default, Clone, PartialEq, Eq, Hash)]
pub struct PaneState {
    /// Daemon-supplied pane identity, when known.
    pub pane_id: Option<PaneId>,
    /// Most recently captured pane grid.
    pub snapshot: PaneSnapshot,
    /// Lifecycle indicator. Set by [`PaneState::apply_event`] when the
    /// driver observes a [`PaneEvent::Close`], [`PaneEvent::Exit`], or
    /// [`PaneEvent::Disconnect`] notice.
    pub lifecycle: PaneLifecycle,
    /// Whether the daemon has reported the pane is paused (`%pause`) and
    /// has not yet emitted a matching `%continue`.
    pub paused: bool,
    /// Whether the SDK observed a sticky [`PaneEvent::Lag`] for this
    /// pane. Cleared by [`PaneState::clear_lag`] or
    /// [`PaneState::record_lag_notice`] paired with later progress.
    pub lagging: bool,
    /// Latest detailed lag notice surfaced by an output stream.
    /// `None` until [`PaneState::record_lag_notice`] is called.
    pub last_lag_notice: Option<PaneLagNotice>,
    /// Counts every applied snapshot revision change. Hosts can use it
    /// to detect "did the driver get any progress?" without comparing
    /// `PaneSnapshot::revision` directly.
    pub generation: u64,
}

/// Captured lifecycle state for a [`PaneState`].
#[derive(Debug, Default, Clone, PartialEq, Eq, Hash)]
#[non_exhaustive]
pub enum PaneLifecycle {
    /// The pane is live as far as the driver knows.
    #[default]
    Live,
    /// The driver observed [`PaneEvent::Close`] for this pane.
    Closed,
    /// The driver observed [`PaneEvent::Exit`] for the control session.
    Exited(PaneExitReason),
    /// The driver observed [`PaneEvent::Disconnect`].
    Disconnected(PaneDisconnectReason),
}

impl PaneLifecycle {
    /// Returns whether the pane is still considered live.
    #[must_use]
    pub fn is_live(&self) -> bool {
        matches!(self, Self::Live)
    }
}

impl PaneState {
    /// Builds a state from an already-captured snapshot.
    #[must_use]
    pub fn from_snapshot(snapshot: PaneSnapshot) -> Self {
        Self {
            pane_id: None,
            snapshot,
            lifecycle: PaneLifecycle::Live,
            paused: false,
            lagging: false,
            last_lag_notice: None,
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

    /// Replaces the captured snapshot. Bumps [`PaneState::generation`]
    /// when the new revision differs from the previous revision.
    pub fn set_snapshot(&mut self, snapshot: PaneSnapshot) {
        let advanced = snapshot.revision != self.snapshot.revision;
        self.snapshot = snapshot;
        if advanced {
            self.generation = self.generation.saturating_add(1);
        }
    }

    /// Records the daemon-supplied pane identity.
    pub fn set_pane_id(&mut self, pane_id: PaneId) {
        self.pane_id = Some(pane_id);
    }

    /// Clears any sticky lag notice.
    pub fn clear_lag(&mut self) {
        self.lagging = false;
        self.last_lag_notice = None;
    }

    /// Records a detailed lag notice surfaced by a [`PaneOutputStream`].
    ///
    /// [`PaneOutputStream`]: rmux_sdk::PaneOutputStream
    pub fn record_lag_notice(&mut self, notice: PaneLagNotice) {
        self.lagging = true;
        self.last_lag_notice = Some(notice);
    }

    /// Folds one [`PaneEvent`] into this state.
    ///
    /// `Pause`, `Continue`, `Lag`, `Disconnect`, `Exit`, and `Close`
    /// mutate the lifecycle/lag/pause fields. Output-bearing variants
    /// are ignored here because they belong on the byte stream rather
    /// than the projected widget state; consumers that want per-event
    /// behaviour observe the original event stream alongside the
    /// state. The function never blocks and never performs I/O.
    pub fn apply_event(&mut self, event: &PaneEvent) {
        match event {
            PaneEvent::Pause { .. } => {
                self.paused = true;
            }
            PaneEvent::Continue { .. } => {
                self.paused = false;
            }
            PaneEvent::Lag { .. } => {
                self.lagging = true;
            }
            PaneEvent::Disconnect { reason, .. } => {
                self.lifecycle = PaneLifecycle::Disconnected(reason.clone());
            }
            PaneEvent::Exit { reason } => {
                self.lifecycle = PaneLifecycle::Exited(reason.clone());
            }
            PaneEvent::Close { .. } => {
                self.lifecycle = PaneLifecycle::Closed;
            }
            _ => {}
        }
    }
}
