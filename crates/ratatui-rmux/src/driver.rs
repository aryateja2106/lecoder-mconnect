//! Async driver that owns pane event I/O and state mutation.
//!
//! `PaneDriver` is the only public type in `ratatui-rmux` that awaits
//! SDK calls, observes time, or subscribes to streams. It wraps an
//! `rmux_sdk::Pane` handle plus an owned [`PaneState`] and exposes
//! explicit `async` methods for the host to step:
//!
//! * [`PaneDriver::refresh`] captures a fresh `PaneSnapshot` from the
//!   daemon and folds it into the owned state.
//! * [`PaneDriver::apply_event`] folds an externally-observed
//!   [`PaneEvent`] (typically from a host event loop) into the state
//!   without performing I/O.
//! * [`PaneDriver::apply_output_chunk`] folds one
//!   [`PaneOutputChunk`] from the host's output stream — including
//!   `Lag` notices — into the state.
//!
//! The driver does **not** internally spawn background tasks, schedule
//! refresh timers, own a tokio runtime, or call `Instant::now()`.
//! Hosts decide when to drive the loop. This keeps every state
//! mutation explicit and lets non-tokio frontends — including pure
//! tests — exercise the same code path without forcing an executor.
//!
//! `state.rs`'s render-time invariants depend on this contract:
//! every change a widget can see must already be folded into the
//! [`PaneState`] before [`crate::widget::PaneWidget`]'s `render` runs.

use rmux_sdk::{Pane, PaneEvent, PaneOutputChunk, PaneSnapshot, Result};

use crate::state::PaneState;

/// Async owner of a single pane's event I/O and projected state.
#[derive(Debug)]
pub struct PaneDriver {
    pane: Pane,
    state: PaneState,
}

impl PaneDriver {
    /// Builds a driver around `pane`, starting from an empty state.
    #[must_use]
    pub fn new(pane: Pane) -> Self {
        Self {
            pane,
            state: PaneState::default(),
        }
    }

    /// Builds a driver around `pane`, starting from the supplied initial state.
    #[must_use]
    pub fn with_state(pane: Pane, state: PaneState) -> Self {
        Self { pane, state }
    }

    /// Returns the borrowed pane handle.
    #[must_use]
    pub fn pane(&self) -> &Pane {
        &self.pane
    }

    /// Returns the projected state. Widgets render from this borrow.
    #[must_use]
    pub fn state(&self) -> &PaneState {
        &self.state
    }

    /// Returns the projected state by clone, suitable for handing to a
    /// sync widget tree without holding a borrow across an async call.
    #[must_use]
    pub fn state_snapshot(&self) -> PaneState {
        self.state.clone()
    }

    /// Mutable access to the projected state. Provided so hosts can
    /// reset the projection (`*driver.state_mut() = PaneState::default()`)
    /// or stage diagnostic transitions in tests; production code
    /// should drive state through the explicit fold methods below.
    pub fn state_mut(&mut self) -> &mut PaneState {
        &mut self.state
    }

    /// Captures a fresh `PaneSnapshot` from the daemon and folds it
    /// into the projected state.
    ///
    /// This is the only async I/O entry point on the driver. Callers
    /// drive the cadence — there is no internal timer.
    pub async fn refresh(&mut self) -> Result<&PaneState> {
        let snapshot = self.pane.snapshot().await?;
        self.apply_snapshot(snapshot);
        Ok(&self.state)
    }

    /// Folds an already-captured [`PaneSnapshot`] into the projected state.
    pub fn apply_snapshot(&mut self, snapshot: PaneSnapshot) {
        self.state.set_snapshot(snapshot);
    }

    /// Folds a [`PaneEvent`] observed by the host into the projected state.
    ///
    /// The driver does not own the event loop because hosts already do.
    /// `apply_event` is the explicit hook hosts use to feed observed
    /// events back into the projected state without giving up control
    /// of the loop or the cancellation logic.
    pub fn apply_event(&mut self, event: &PaneEvent) {
        self.state.apply_event(event);
    }

    /// Folds a [`PaneOutputChunk`] into the projected state.
    ///
    /// Output bytes are widget-irrelevant — they are surfaced through
    /// [`Pane::output_stream`] and consumed by host loops directly. The
    /// driver only records `Lag` notices into the state so widgets can
    /// surface a sticky lag indicator.
    pub fn apply_output_chunk(&mut self, chunk: &PaneOutputChunk) {
        if let PaneOutputChunk::Lag(notice) = chunk {
            self.state.record_lag_notice(notice.clone());
        }
    }

    /// Resets any sticky lag indicator. Useful after the host knows it
    /// has caught up to the daemon's resume sequence.
    pub fn clear_lag(&mut self) {
        self.state.clear_lag();
    }
}
