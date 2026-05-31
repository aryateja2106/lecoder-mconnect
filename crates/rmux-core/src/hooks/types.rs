use rmux_proto::{HookLifecycle, HookName};

/// The global root used by a hook inventory query.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HookGlobalRoot {
    /// Session-scoped hooks stored at the global session root.
    Session,
    /// Window- and pane-scoped hooks stored at the global window root.
    Window,
}

/// Indexed mutation options for `set-hook`.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct HookSetOptions {
    /// Whether the new command should be appended to the next free array slot.
    pub append: bool,
    /// The explicit array index to replace, when present.
    pub index: Option<u32>,
}

/// A rendered hook binding snapshot.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HookBindingView {
    pub(super) hook: HookName,
    pub(super) index: u32,
    pub(super) command: String,
    pub(super) lifecycle: HookLifecycle,
}

impl HookBindingView {
    /// Returns the bound hook name.
    #[must_use]
    pub const fn hook(&self) -> HookName {
        self.hook
    }

    /// Returns the bound array index.
    #[must_use]
    pub const fn index(&self) -> u32 {
        self.index
    }

    /// Returns the stored command string.
    #[must_use]
    pub fn command(&self) -> &str {
        &self.command
    }

    /// Returns the stored lifecycle.
    #[must_use]
    pub const fn lifecycle(&self) -> HookLifecycle {
        self.lifecycle
    }
}

/// The command payload emitted when a hook dispatches.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HookDispatch {
    pub(super) command: String,
    pub(super) lifecycle: HookLifecycle,
}

impl HookDispatch {
    /// Returns the exact shell command that should be executed.
    #[must_use]
    pub fn command(&self) -> &str {
        &self.command
    }

    /// Returns the lifecycle of the dispatched hook.
    #[must_use]
    pub const fn lifecycle(&self) -> HookLifecycle {
        self.lifecycle
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum HookClass {
    Session,
    Window,
    Pane,
}
