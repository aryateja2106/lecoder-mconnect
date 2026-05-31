//! SDK type vocabulary.
//!
//! Identity newtypes are defined exactly once in `rmux-proto`. This module
//! re-exports the four authoritative identity types (`SessionName`,
//! `SessionId`, `WindowId`, `PaneId`) so SDK users never have to depend on
//! `rmux-core`, `rmux-server`, `rmux-client`, or `rmux-pty` to obtain
//! them. The SDK does not redeclare these newtypes; `rmux-proto` is the
//! single public home for the identity vocabulary.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

pub use rmux_proto::{PaneId, SessionId, SessionName, WindowId};

/// Selects the daemon endpoint resolution strategy used by the SDK.
///
/// `Default` defers to SDK runtime discovery, falling through to platform
/// defaults resolved through the existing RMUX IPC/OS layer when no SDK
/// environment override is accepted. The explicit variants carry
/// caller-supplied paths/names and bypass the auto-discovery allowlist while
/// still preserving the daemon's own permission and symlink checks.
///
/// Marked `#[non_exhaustive]` because additional transports (such as TCP
/// or test-harness in-memory pipes) are anticipated in later steps and
/// must be addable without breaking downstream pattern matches.
#[derive(Debug, Default, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[non_exhaustive]
pub enum RmuxEndpoint {
    /// Resolve through SDK discovery, falling through to the platform default.
    #[default]
    Default,
    /// Use an explicit Unix domain socket path.
    UnixSocket(PathBuf),
    /// Use an explicit Windows named pipe identifier.
    WindowsPipe(String),
}

impl RmuxEndpoint {
    /// Returns `true` when this endpoint defers to platform default
    /// resolution.
    #[must_use]
    pub fn is_default(&self) -> bool {
        matches!(self, Self::Default)
    }
}

/// Terminal geometry carried by SDK value objects.
///
/// This is an inert DTO. Converting it to the protocol type does not inspect
/// the caller's terminal or normalize zero dimensions.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TerminalSizeSpec {
    /// Requested terminal columns.
    pub cols: u16,
    /// Requested terminal rows.
    pub rows: u16,
}

impl TerminalSizeSpec {
    /// Creates a terminal-size DTO from explicit column and row counts.
    #[must_use]
    pub const fn new(cols: u16, rows: u16) -> Self {
        Self { cols, rows }
    }
}

impl From<TerminalSizeSpec> for rmux_proto::TerminalSize {
    fn from(value: TerminalSizeSpec) -> Self {
        Self {
            cols: value.cols,
            rows: value.rows,
        }
    }
}

impl From<rmux_proto::TerminalSize> for TerminalSizeSpec {
    fn from(value: rmux_proto::TerminalSize) -> Self {
        Self {
            cols: value.cols,
            rows: value.rows,
        }
    }
}

/// Exact window selector used by SDK DTOs.
///
/// This type stores already-structured target components. It deliberately
/// performs no tmux target parsing or server-side lookup.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct WindowRef {
    /// Exact session name component.
    pub session_name: SessionName,
    /// Exact window index component.
    pub window_index: u32,
}

impl WindowRef {
    /// Creates a window selector from explicit target components.
    #[must_use]
    pub fn new(session_name: SessionName, window_index: u32) -> Self {
        Self {
            session_name,
            window_index,
        }
    }

    /// Creates a selector for window index `0` in the given session.
    #[must_use]
    pub fn first(session_name: SessionName) -> Self {
        Self::new(session_name, 0)
    }

    /// Converts this selector to the matching protocol target DTO.
    #[must_use]
    pub fn to_proto(&self) -> rmux_proto::WindowTarget {
        rmux_proto::WindowTarget::with_window(self.session_name.clone(), self.window_index)
    }
}

impl From<WindowRef> for rmux_proto::WindowTarget {
    fn from(value: WindowRef) -> Self {
        Self::with_window(value.session_name, value.window_index)
    }
}

impl From<rmux_proto::WindowTarget> for WindowRef {
    fn from(value: rmux_proto::WindowTarget) -> Self {
        Self {
            session_name: value.session_name().clone(),
            window_index: value.window_index(),
        }
    }
}

impl From<&WindowRef> for rmux_proto::WindowTarget {
    fn from(value: &WindowRef) -> Self {
        value.to_proto()
    }
}

/// Exact pane selector used by SDK DTOs.
///
/// This type stores already-structured target components. It deliberately
/// performs no tmux target parsing or server-side lookup.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PaneRef {
    /// Exact session name component.
    pub session_name: SessionName,
    /// Exact window index component.
    pub window_index: u32,
    /// Exact pane index component.
    pub pane_index: u32,
}

impl PaneRef {
    /// Creates a pane selector from explicit target components.
    #[must_use]
    pub fn new(session_name: SessionName, window_index: u32, pane_index: u32) -> Self {
        Self {
            session_name,
            window_index,
            pane_index,
        }
    }

    /// Creates a selector in window index `0`.
    #[must_use]
    pub fn in_first_window(session_name: SessionName, pane_index: u32) -> Self {
        Self::new(session_name, 0, pane_index)
    }

    /// Converts this selector to the matching protocol target DTO.
    #[must_use]
    pub fn to_proto(&self) -> rmux_proto::PaneTarget {
        rmux_proto::PaneTarget::with_window(
            self.session_name.clone(),
            self.window_index,
            self.pane_index,
        )
    }
}

impl From<PaneRef> for rmux_proto::PaneTarget {
    fn from(value: PaneRef) -> Self {
        Self::with_window(value.session_name, value.window_index, value.pane_index)
    }
}

impl From<rmux_proto::PaneTarget> for PaneRef {
    fn from(value: rmux_proto::PaneTarget) -> Self {
        Self {
            session_name: value.session_name().clone(),
            window_index: value.window_index(),
            pane_index: value.pane_index(),
        }
    }
}

impl From<&PaneRef> for rmux_proto::PaneTarget {
    fn from(value: &PaneRef) -> Self {
        value.to_proto()
    }
}

/// Exact target selector used by SDK DTOs that accept multiple target forms.
///
/// The enum stores structured components only; it does not parse tmux target
/// strings or resolve ambiguous targets.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TargetRef {
    /// Exact session target.
    Session(SessionName),
    /// Exact window target.
    Window(WindowRef),
    /// Exact pane target.
    Pane(PaneRef),
}

impl From<TargetRef> for rmux_proto::Target {
    fn from(value: TargetRef) -> Self {
        match value {
            TargetRef::Session(session_name) => Self::Session(session_name),
            TargetRef::Window(target) => Self::Window(target.into()),
            TargetRef::Pane(target) => Self::Pane(target.into()),
        }
    }
}

impl From<rmux_proto::Target> for TargetRef {
    fn from(value: rmux_proto::Target) -> Self {
        match value {
            rmux_proto::Target::Session(session_name) => Self::Session(session_name),
            rmux_proto::Target::Window(target) => Self::Window(target.into()),
            rmux_proto::Target::Pane(target) => Self::Pane(target.into()),
        }
    }
}

impl From<&TargetRef> for rmux_proto::Target {
    fn from(value: &TargetRef) -> Self {
        match value {
            TargetRef::Session(session_name) => Self::Session(session_name.clone()),
            TargetRef::Window(target) => Self::Window(target.into()),
            TargetRef::Pane(target) => Self::Pane(target.into()),
        }
    }
}
