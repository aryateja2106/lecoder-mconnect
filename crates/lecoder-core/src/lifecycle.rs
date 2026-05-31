//! Session lifecycle state machine over the Swift contract states: `active | idle | terminated`.
//!
//! `terminated` is absorbing. Transitions are driven by explicit events so the wall clock
//! never enters here — the caller decides when "idle elapsed" based on an injected clock.

use lecoder_proto::SessionState;

/// Events that drive a session's lifecycle.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LifecycleEvent {
    /// Input or output occurred — the session is active.
    Activity,
    /// The idle threshold elapsed with no activity.
    IdleElapsed,
    /// The agent process exited — the session is over.
    AgentExited,
}

/// Error returned when an event is not valid for the current state.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransitionError {
    /// The session has terminated and accepts no further transitions.
    Terminated,
}

impl std::fmt::Display for TransitionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TransitionError::Terminated => f.write_str("session has terminated"),
        }
    }
}

impl std::error::Error for TransitionError {}

/// A session's lifecycle state machine.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionLifecycle {
    state: SessionState,
}

impl Default for SessionLifecycle {
    fn default() -> Self {
        Self::new()
    }
}

impl SessionLifecycle {
    /// A new session starts `active`.
    pub fn new() -> Self {
        Self { state: SessionState::Active }
    }

    /// Reconstruct from a persisted state (resume).
    pub fn from_state(state: SessionState) -> Self {
        Self { state }
    }

    /// Current state.
    pub fn state(&self) -> SessionState {
        self.state
    }

    /// Whether the session has terminated.
    pub fn is_terminated(&self) -> bool {
        self.state == SessionState::Terminated
    }

    /// Apply an event, returning the new state or an error if the session is terminated.
    pub fn apply(&mut self, event: LifecycleEvent) -> Result<SessionState, TransitionError> {
        use LifecycleEvent::*;
        use SessionState::*;
        let next = match (self.state, event) {
            (Terminated, _) => return Err(TransitionError::Terminated),
            (_, AgentExited) => Terminated,
            (Active, Activity) => Active,
            (Active, IdleElapsed) => Idle,
            (Idle, Activity) => Active,
            (Idle, IdleElapsed) => Idle,
        };
        self.state = next;
        Ok(next)
    }
}
