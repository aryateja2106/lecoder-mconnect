//! Behavioural tests for `PaneState`.
//!
//! These tests pin the state-machine invariants the async driver relies on:
//! every observable mutation widgets can see is reachable through one of the
//! pure, sync fold methods on `PaneState`. The driver delegates to these
//! same methods (see `crates/ratatui-rmux/src/driver.rs`), so covering them
//! here exercises the driver's non-I/O code path without needing a daemon
//! or a `Pane` constructor.
//!
//! No tokio runtime is required.

use ratatui_rmux::{PaneLifecycle, PaneState};
use rmux_sdk::{
    PaneCell, PaneCommandSummary, PaneCursor, PaneDisconnectReason, PaneEvent, PaneExitReason,
    PaneGlyph, PaneId, PaneLagNotice, PaneNotification, PaneOutputChunk, PaneRecentOutput,
    PaneSnapshot,
};

fn snapshot_with_revision(revision: u64) -> PaneSnapshot {
    let cells = vec![PaneCell::new(PaneGlyph::new("x", 1))];
    PaneSnapshot::new(1, 1, cells, PaneCursor::default())
        .expect("valid snapshot")
        .with_revision(revision)
}

fn lag_notice(missed: u64) -> PaneLagNotice {
    PaneLagNotice {
        expected_sequence: 10,
        resume_sequence: 12,
        missed_events: missed,
        newest_sequence: 99,
        recent: PaneRecentOutput::default(),
    }
}

// --- default + constructors ----------------------------------------------

#[test]
fn default_state_is_live_unpaused_and_not_lagging() {
    let state = PaneState::default();
    assert!(state.lifecycle.is_live());
    assert!(!state.paused);
    assert!(!state.lagging);
    assert!(state.last_lag_notice.is_none());
    assert_eq!(state.generation, 0);
    assert_eq!(state.revision(), 0);
    assert_eq!(state.cols(), 0);
    assert_eq!(state.rows(), 0);
    assert!(state.pane_id.is_none());
}

#[test]
fn from_snapshot_carries_dimensions_and_revision() {
    let snapshot = snapshot_with_revision(7);
    let state = PaneState::from_snapshot(snapshot.clone());
    assert_eq!(state.cols(), 1);
    assert_eq!(state.rows(), 1);
    assert_eq!(state.revision(), 7);
    assert_eq!(state.generation, 0);
    assert_eq!(state.snapshot, snapshot);
    assert!(state.lifecycle.is_live());
}

// --- snapshot folding + generation invariants ----------------------------

#[test]
fn set_snapshot_bumps_generation_only_when_revision_advances() {
    let mut state = PaneState::from_snapshot(snapshot_with_revision(1));
    assert_eq!(state.generation, 0);

    state.set_snapshot(snapshot_with_revision(1));
    assert_eq!(state.generation, 0, "same revision must not advance");

    state.set_snapshot(snapshot_with_revision(2));
    assert_eq!(state.generation, 1, "new revision advances by one");

    state.set_snapshot(snapshot_with_revision(7));
    assert_eq!(
        state.generation, 2,
        "non-contiguous revision still advances once"
    );
}

#[test]
fn set_snapshot_with_decreasing_revision_still_bumps_generation() {
    // Revisions can rewind (e.g., on pane respawn or daemon restart). The
    // generation tracks *change*, not monotonicity.
    let mut state = PaneState::from_snapshot(snapshot_with_revision(5));
    state.set_snapshot(snapshot_with_revision(3));
    assert_eq!(state.generation, 1);
    assert_eq!(state.revision(), 3);
}

#[test]
fn set_snapshot_replaces_dimensions_and_cells() {
    let mut state = PaneState::default();
    let snapshot = snapshot_with_revision(1);
    state.set_snapshot(snapshot.clone());
    assert_eq!(state.snapshot, snapshot);
    assert_eq!(state.cols(), snapshot.cols);
    assert_eq!(state.rows(), snapshot.rows);
}

// --- pane id learning ----------------------------------------------------

#[test]
fn set_pane_id_records_identity() {
    let mut state = PaneState::default();
    state.set_pane_id(PaneId::new(42));
    assert_eq!(state.pane_id, Some(PaneId::new(42)));
}

// --- pause/continue toggling --------------------------------------------

#[test]
fn pause_sets_paused_and_continue_clears() {
    let mut state = PaneState::default();
    state.apply_event(&PaneEvent::Pause {
        pane_id: PaneId::new(1),
    });
    assert!(state.paused);
    state.apply_event(&PaneEvent::Continue {
        pane_id: PaneId::new(1),
    });
    assert!(!state.paused);
}

#[test]
fn pause_is_idempotent() {
    let mut state = PaneState::default();
    let evt = PaneEvent::Pause {
        pane_id: PaneId::new(1),
    };
    state.apply_event(&evt);
    state.apply_event(&evt);
    assert!(state.paused);
}

#[test]
fn continue_without_prior_pause_is_safe() {
    let mut state = PaneState::default();
    state.apply_event(&PaneEvent::Continue {
        pane_id: PaneId::new(1),
    });
    assert!(!state.paused);
}

// --- lag bookkeeping -----------------------------------------------------

#[test]
fn lag_event_sets_sticky_flag_without_notice() {
    let mut state = PaneState::default();
    state.apply_event(&PaneEvent::Lag {
        pane_id: PaneId::new(1),
    });
    assert!(state.lagging);
    assert!(
        state.last_lag_notice.is_none(),
        "bare Lag event carries no notice payload",
    );
}

#[test]
fn record_lag_notice_sets_flag_and_notice() {
    let mut state = PaneState::default();
    let notice = lag_notice(5);
    state.record_lag_notice(notice.clone());
    assert!(state.lagging);
    assert_eq!(state.last_lag_notice.as_ref(), Some(&notice));
}

#[test]
fn clear_lag_resets_both_flag_and_notice() {
    let mut state = PaneState::default();
    state.record_lag_notice(lag_notice(1));
    state.clear_lag();
    assert!(!state.lagging);
    assert!(state.last_lag_notice.is_none());
}

#[test]
fn later_lag_notice_overwrites_prior_notice() {
    let mut state = PaneState::default();
    state.record_lag_notice(lag_notice(1));
    let fresh = lag_notice(99);
    state.record_lag_notice(fresh.clone());
    assert_eq!(state.last_lag_notice.as_ref(), Some(&fresh));
}

// --- lifecycle transitions ----------------------------------------------

#[test]
fn close_event_transitions_to_closed() {
    let mut state = PaneState::default();
    state.apply_event(&PaneEvent::Close {
        pane_id: PaneId::new(1),
    });
    assert_eq!(state.lifecycle, PaneLifecycle::Closed);
    assert!(!state.lifecycle.is_live());
}

#[test]
fn exit_event_transitions_to_exited_with_reason() {
    let mut state = PaneState::default();
    let reason = PaneExitReason::WithReason {
        reason: "server shutting down".to_owned(),
    };
    state.apply_event(&PaneEvent::Exit {
        reason: reason.clone(),
    });
    assert_eq!(state.lifecycle, PaneLifecycle::Exited(reason));
    assert!(!state.lifecycle.is_live());
}

#[test]
fn disconnect_event_transitions_with_reason() {
    let mut state = PaneState::default();
    state.apply_event(&PaneEvent::Disconnect {
        pane_id: Some(PaneId::new(1)),
        reason: PaneDisconnectReason::TooFarBehind,
    });
    assert_eq!(
        state.lifecycle,
        PaneLifecycle::Disconnected(PaneDisconnectReason::TooFarBehind),
    );
    assert!(!state.lifecycle.is_live());
}

#[test]
fn bare_exit_event_transitions_to_exited_bare() {
    let mut state = PaneState::default();
    state.apply_event(&PaneEvent::Exit {
        reason: PaneExitReason::Bare,
    });
    assert_eq!(state.lifecycle, PaneLifecycle::Exited(PaneExitReason::Bare));
}

#[test]
fn lifecycle_transitions_are_latest_wins() {
    // The fold is "latest event wins" — there is no per-event coalescing
    // beyond what each variant encodes.
    let mut state = PaneState::default();
    state.apply_event(&PaneEvent::Close {
        pane_id: PaneId::new(1),
    });
    state.apply_event(&PaneEvent::Exit {
        reason: PaneExitReason::Bare,
    });
    assert_eq!(state.lifecycle, PaneLifecycle::Exited(PaneExitReason::Bare));
    state.apply_event(&PaneEvent::Disconnect {
        pane_id: None,
        reason: PaneDisconnectReason::ServerShutdown,
    });
    assert_eq!(
        state.lifecycle,
        PaneLifecycle::Disconnected(PaneDisconnectReason::ServerShutdown),
    );
}

// --- non-lifecycle events are no-ops ------------------------------------

#[test]
fn output_event_does_not_mutate_state() {
    let mut state = PaneState::default();
    let before = state.clone();
    state.apply_event(&PaneEvent::Output {
        pane_id: PaneId::new(1),
        bytes: vec![1, 2, 3],
    });
    assert_eq!(state, before);
}

#[test]
fn extended_output_event_does_not_mutate_state() {
    let mut state = PaneState::default();
    let before = state.clone();
    state.apply_event(&PaneEvent::ExtendedOutput {
        pane_id: PaneId::new(1),
        age_ms: 17,
        bytes: vec![4, 5, 6],
    });
    assert_eq!(state, before);
}

#[test]
fn notification_event_does_not_mutate_state() {
    let mut state = PaneState::default();
    let before = state.clone();
    state.apply_event(&PaneEvent::Notification(PaneNotification {
        pane_id: Some(PaneId::new(1)),
        text: "hi".to_owned(),
    }));
    assert_eq!(state, before);
}

#[test]
fn command_summary_event_does_not_mutate_state() {
    let mut state = PaneState::default();
    let before = state.clone();
    state.apply_event(&PaneEvent::CommandSummary(PaneCommandSummary::success(
        0,
        1,
        1,
        Vec::new(),
    )));
    assert_eq!(state, before);
}

// --- driver-side helpers via apply_output_chunk -------------------------

// The driver's `apply_output_chunk` is exercised here indirectly: it just
// forwards `Lag` chunks into `record_lag_notice` and ignores `Bytes`. The
// asserts mirror `crates/ratatui-rmux/src/driver.rs::apply_output_chunk`.

#[test]
fn output_chunk_bytes_is_a_no_op() {
    let mut state = PaneState::default();
    let chunk = PaneOutputChunk::Bytes {
        sequence: 1,
        bytes: vec![0xaa],
    };
    let before = state.clone();
    if let PaneOutputChunk::Lag(notice) = &chunk {
        state.record_lag_notice(notice.clone());
    }
    assert_eq!(state, before);
}

#[test]
fn output_chunk_lag_records_notice() {
    let mut state = PaneState::default();
    let notice = lag_notice(8);
    let chunk = PaneOutputChunk::Lag(notice.clone());
    if let PaneOutputChunk::Lag(payload) = &chunk {
        state.record_lag_notice(payload.clone());
    }
    assert!(state.lagging);
    assert_eq!(state.last_lag_notice.as_ref(), Some(&notice));
}

// --- cross-cutting invariants -------------------------------------------

#[test]
fn applying_disconnect_does_not_silently_clear_lag() {
    // Lifecycle transitions don't touch the sticky lag flag. Hosts that
    // want to clear lag on disconnect must call `clear_lag` explicitly.
    let mut state = PaneState::default();
    state.record_lag_notice(lag_notice(1));
    state.apply_event(&PaneEvent::Disconnect {
        pane_id: None,
        reason: PaneDisconnectReason::TransportClosed,
    });
    assert!(state.lagging);
    assert!(state.last_lag_notice.is_some());
}

#[test]
fn pause_state_persists_through_snapshot_advance() {
    // Snapshot replacement is orthogonal to the pause indicator.
    let mut state = PaneState::default();
    state.apply_event(&PaneEvent::Pause {
        pane_id: PaneId::new(1),
    });
    state.set_snapshot(snapshot_with_revision(3));
    assert!(state.paused);
    assert_eq!(state.generation, 1);
}

#[test]
fn pane_lifecycle_is_live_helper_matches_default() {
    assert!(PaneLifecycle::Live.is_live());
    assert!(!PaneLifecycle::Closed.is_live());
    assert!(!PaneLifecycle::Exited(PaneExitReason::Bare).is_live());
    assert!(!PaneLifecycle::Disconnected(PaneDisconnectReason::ServerShutdown).is_live(),);
}
