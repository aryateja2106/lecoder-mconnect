//! Inert pane event DTOs for SDK consumers.
//!
//! This module is the public SDK home for the tmux-compatible control-mode
//! pane event vocabulary. The [`types`] submodule defines the
//! [`PaneEvent`] enum and its leaf payloads; the parent
//! crate re-exports the public surface unchanged so SDK users import every
//! variant through `rmux_sdk` without ever depending on `rmux-core`,
//! `rmux-server`, `rmux-client`, or `rmux-pty`.
//!
//! The events here are *inert* DTOs. The SDK does not subscribe to,
//! resequence, or emit these events; the `rmux-server` control-mode
//! plumbing in `crates/rmux-server/src/control.rs` is the authoritative
//! producer, and the daemon-side ordering rules documented on
//! [`PaneEvent`] match that producer's behaviour.

pub mod render;
pub mod streams;
pub mod types;

pub use render::{PaneRenderStream, RenderUpdate};
pub use streams::{
    PaneLagNotice, PaneLineItem, PaneLineStream, PaneOutputChunk, PaneOutputStart,
    PaneOutputStream, PaneRecentOutput,
};
pub use types::{
    PaneCommandStatus, PaneCommandSummary, PaneDisconnectReason, PaneEvent, PaneExitReason,
    PaneNotification, PanePermissionScope,
};
