//! Session lifecycle state-machine transitions.

use lecoder_core::{LifecycleEvent, SessionLifecycle, TransitionError};
use lecoder_proto::SessionState;

#[test]
fn initial_state_is_active() {
    assert_eq!(SessionLifecycle::new().state(), SessionState::Active);
}

#[test]
fn active_to_idle_on_idle_elapsed() {
    let mut s = SessionLifecycle::new();
    assert_eq!(s.apply(LifecycleEvent::IdleElapsed).unwrap(), SessionState::Idle);
}

#[test]
fn idle_back_to_active_on_activity() {
    let mut s = SessionLifecycle::from_state(SessionState::Idle);
    assert_eq!(s.apply(LifecycleEvent::Activity).unwrap(), SessionState::Active);
}

#[test]
fn active_stays_active_on_activity() {
    let mut s = SessionLifecycle::new();
    assert_eq!(s.apply(LifecycleEvent::Activity).unwrap(), SessionState::Active);
}

#[test]
fn idle_stays_idle_on_idle_elapsed() {
    let mut s = SessionLifecycle::from_state(SessionState::Idle);
    assert_eq!(s.apply(LifecycleEvent::IdleElapsed).unwrap(), SessionState::Idle);
}

#[test]
fn agent_exit_terminates_from_active_and_idle() {
    let mut a = SessionLifecycle::new();
    assert_eq!(a.apply(LifecycleEvent::AgentExited).unwrap(), SessionState::Terminated);
    let mut i = SessionLifecycle::from_state(SessionState::Idle);
    assert_eq!(i.apply(LifecycleEvent::AgentExited).unwrap(), SessionState::Terminated);
}

#[test]
fn terminated_is_absorbing() {
    let mut s = SessionLifecycle::from_state(SessionState::Terminated);
    assert!(s.is_terminated());
    for ev in [LifecycleEvent::Activity, LifecycleEvent::IdleElapsed, LifecycleEvent::AgentExited] {
        assert_eq!(s.apply(ev), Err(TransitionError::Terminated));
        assert_eq!(s.state(), SessionState::Terminated, "state must not change after terminate");
    }
}

#[test]
fn full_transition_matrix() {
    use LifecycleEvent::*;
    use SessionState::*;
    // (from, event) -> Some(expected) for legal, None for error
    let cases = [
        (Active, Activity, Some(Active)),
        (Active, IdleElapsed, Some(Idle)),
        (Active, AgentExited, Some(Terminated)),
        (Idle, Activity, Some(Active)),
        (Idle, IdleElapsed, Some(Idle)),
        (Idle, AgentExited, Some(Terminated)),
        (Terminated, Activity, None),
        (Terminated, IdleElapsed, None),
        (Terminated, AgentExited, None),
    ];
    for (from, ev, expected) in cases {
        let mut s = SessionLifecycle::from_state(from);
        match expected {
            Some(to) => assert_eq!(s.apply(ev).unwrap(), to, "{from:?}+{ev:?}"),
            None => assert!(s.apply(ev).is_err(), "{from:?}+{ev:?} should error"),
        }
    }
}
