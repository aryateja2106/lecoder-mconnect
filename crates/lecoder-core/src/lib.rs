//! LeCoder MConnect orchestration core.
//!
//! Slice-1 scope here is the pure, deterministic spine: the session lifecycle state machine
//! and resumable/forkable session IDs. The async `RmuxBridge`, `EventBus`, and per-agent pump
//! (which consume `rmux-sdk`) arrive in a later phase and are intentionally not here yet, so
//! this crate stays free of rmux and trivially unit-testable.
#![forbid(unsafe_code)]

pub mod id;
pub mod lifecycle;
pub mod session;

pub use id::{SessionId, SessionIdGen};
pub use lifecycle::{LifecycleEvent, SessionLifecycle, TransitionError};
pub use session::{fork_session, new_session};
