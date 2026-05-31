//! Protocol hook names and lifecycle payloads.

use std::fmt;

use serde::{Deserialize, Serialize};

/// Supported hook names for `set-hook`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum HookName {
    /// The `client-attached` hook.
    ClientAttached,
    /// The `client-detached` hook.
    ClientDetached,
    /// The `client-session-changed` hook.
    ClientSessionChanged,
    /// The `session-created` hook.
    SessionCreated,
    /// The `session-closed` hook.
    SessionClosed,
    /// The `session-renamed` hook.
    SessionRenamed,
    /// The `session-window-changed` hook.
    SessionWindowChanged,
    /// The `window-linked` hook.
    WindowLinked,
    /// The `window-unlinked` hook.
    WindowUnlinked,
    /// The `window-renamed` hook.
    WindowRenamed,
    /// The `window-layout-changed` hook.
    WindowLayoutChanged,
    /// The `window-pane-changed` hook.
    WindowPaneChanged,
    /// The `pane-exited` hook.
    PaneExited,
    /// The `pane-mode-changed` hook.
    PaneModeChanged,
    /// The `paste-buffer-changed` hook.
    PasteBufferChanged,
    /// The `paste-buffer-deleted` hook.
    PasteBufferDeleted,
    /// The `after-select-window` hook.
    AfterSelectWindow,
    /// The `after-select-pane` hook.
    AfterSelectPane,
    /// The `after-send-keys` hook.
    AfterSendKeys,
    /// The `after-set-option` hook.
    AfterSetOption,
    /// The `after-bind-key` hook.
    AfterBindKey,
    /// The `after-capture-pane` hook.
    AfterCapturePane,
    /// The `after-copy-mode` hook.
    AfterCopyMode,
    /// The `after-display-message` hook.
    AfterDisplayMessage,
    /// The `after-display-panes` hook.
    AfterDisplayPanes,
    /// The `after-kill-pane` hook.
    AfterKillPane,
    /// The `after-list-buffers` hook.
    AfterListBuffers,
    /// The `after-list-clients` hook.
    AfterListClients,
    /// The `after-list-keys` hook.
    AfterListKeys,
    /// The `after-list-panes` hook.
    AfterListPanes,
    /// The `after-list-sessions` hook.
    AfterListSessions,
    /// The `after-list-windows` hook.
    AfterListWindows,
    /// The `after-load-buffer` hook.
    AfterLoadBuffer,
    /// The `after-lock-server` hook.
    AfterLockServer,
    /// The `after-new-session` hook.
    AfterNewSession,
    /// The `after-new-window` hook.
    AfterNewWindow,
    /// The `after-paste-buffer` hook.
    AfterPasteBuffer,
    /// The `after-pipe-pane` hook.
    AfterPipePane,
    /// The `after-queue` hook.
    AfterQueue,
    /// The `after-refresh-client` hook.
    AfterRefreshClient,
    /// The `after-rename-session` hook.
    AfterRenameSession,
    /// The `after-rename-window` hook.
    AfterRenameWindow,
    /// The `after-resize-pane` hook.
    AfterResizePane,
    /// The `after-resize-window` hook.
    AfterResizeWindow,
    /// The `after-save-buffer` hook.
    AfterSaveBuffer,
    /// The `after-select-layout` hook.
    AfterSelectLayout,
    /// The `after-set-buffer` hook.
    AfterSetBuffer,
    /// The `after-set-environment` hook.
    AfterSetEnvironment,
    /// The `after-set-hook` hook.
    AfterSetHook,
    /// The `after-show-environment` hook.
    AfterShowEnvironment,
    /// The `after-show-messages` hook.
    AfterShowMessages,
    /// The `after-show-options` hook.
    AfterShowOptions,
    /// The `after-split-window` hook.
    AfterSplitWindow,
    /// The `after-unbind-key` hook.
    AfterUnbindKey,
    /// The `alert-activity` hook.
    AlertActivity,
    /// The `alert-bell` hook.
    AlertBell,
    /// The `alert-silence` hook.
    AlertSilence,
    /// The `client-active` hook.
    ClientActive,
    /// The `client-focus-in` hook.
    ClientFocusIn,
    /// The `client-focus-out` hook.
    ClientFocusOut,
    /// The `client-resized` hook.
    ClientResized,
    /// The `client-light-theme` hook.
    ClientLightTheme,
    /// The `client-dark-theme` hook.
    ClientDarkTheme,
    /// The `command-error` hook.
    CommandError,
    /// The `pane-died` hook.
    PaneDied,
    /// The `pane-focus-in` hook.
    PaneFocusIn,
    /// The `pane-focus-out` hook.
    PaneFocusOut,
    /// The `pane-set-clipboard` hook.
    PaneSetClipboard,
    /// The `pane-title-changed` hook.
    PaneTitleChanged,
    /// The `window-resized` hook.
    WindowResized,
}

impl HookName {
    /// Returns the tmux-visible hook name.
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::ClientAttached => "client-attached",
            Self::ClientDetached => "client-detached",
            Self::ClientSessionChanged => "client-session-changed",
            Self::SessionCreated => "session-created",
            Self::SessionClosed => "session-closed",
            Self::SessionRenamed => "session-renamed",
            Self::SessionWindowChanged => "session-window-changed",
            Self::WindowLinked => "window-linked",
            Self::WindowUnlinked => "window-unlinked",
            Self::WindowRenamed => "window-renamed",
            Self::WindowLayoutChanged => "window-layout-changed",
            Self::WindowPaneChanged => "window-pane-changed",
            Self::PaneExited => "pane-exited",
            Self::PaneModeChanged => "pane-mode-changed",
            Self::PasteBufferChanged => "paste-buffer-changed",
            Self::PasteBufferDeleted => "paste-buffer-deleted",
            Self::AfterSelectWindow => "after-select-window",
            Self::AfterSelectPane => "after-select-pane",
            Self::AfterSendKeys => "after-send-keys",
            Self::AfterSetOption => "after-set-option",
            Self::AfterBindKey => "after-bind-key",
            Self::AfterCapturePane => "after-capture-pane",
            Self::AfterCopyMode => "after-copy-mode",
            Self::AfterDisplayMessage => "after-display-message",
            Self::AfterDisplayPanes => "after-display-panes",
            Self::AfterKillPane => "after-kill-pane",
            Self::AfterListBuffers => "after-list-buffers",
            Self::AfterListClients => "after-list-clients",
            Self::AfterListKeys => "after-list-keys",
            Self::AfterListPanes => "after-list-panes",
            Self::AfterListSessions => "after-list-sessions",
            Self::AfterListWindows => "after-list-windows",
            Self::AfterLoadBuffer => "after-load-buffer",
            Self::AfterLockServer => "after-lock-server",
            Self::AfterNewSession => "after-new-session",
            Self::AfterNewWindow => "after-new-window",
            Self::AfterPasteBuffer => "after-paste-buffer",
            Self::AfterPipePane => "after-pipe-pane",
            Self::AfterQueue => "after-queue",
            Self::AfterRefreshClient => "after-refresh-client",
            Self::AfterRenameSession => "after-rename-session",
            Self::AfterRenameWindow => "after-rename-window",
            Self::AfterResizePane => "after-resize-pane",
            Self::AfterResizeWindow => "after-resize-window",
            Self::AfterSaveBuffer => "after-save-buffer",
            Self::AfterSelectLayout => "after-select-layout",
            Self::AfterSetBuffer => "after-set-buffer",
            Self::AfterSetEnvironment => "after-set-environment",
            Self::AfterSetHook => "after-set-hook",
            Self::AfterShowEnvironment => "after-show-environment",
            Self::AfterShowMessages => "after-show-messages",
            Self::AfterShowOptions => "after-show-options",
            Self::AfterSplitWindow => "after-split-window",
            Self::AfterUnbindKey => "after-unbind-key",
            Self::AlertActivity => "alert-activity",
            Self::AlertBell => "alert-bell",
            Self::AlertSilence => "alert-silence",
            Self::ClientActive => "client-active",
            Self::ClientFocusIn => "client-focus-in",
            Self::ClientFocusOut => "client-focus-out",
            Self::ClientResized => "client-resized",
            Self::ClientLightTheme => "client-light-theme",
            Self::ClientDarkTheme => "client-dark-theme",
            Self::CommandError => "command-error",
            Self::PaneDied => "pane-died",
            Self::PaneFocusIn => "pane-focus-in",
            Self::PaneFocusOut => "pane-focus-out",
            Self::PaneSetClipboard => "pane-set-clipboard",
            Self::PaneTitleChanged => "pane-title-changed",
            Self::WindowResized => "window-resized",
        }
    }

    /// Parses a tmux-visible hook name.
    #[must_use]
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(value: &str) -> Option<Self> {
        Some(match value {
            "client-attached" => Self::ClientAttached,
            "client-detached" => Self::ClientDetached,
            "client-session-changed" => Self::ClientSessionChanged,
            "session-created" => Self::SessionCreated,
            "session-closed" => Self::SessionClosed,
            "session-renamed" => Self::SessionRenamed,
            "session-window-changed" => Self::SessionWindowChanged,
            "window-linked" => Self::WindowLinked,
            "window-unlinked" => Self::WindowUnlinked,
            "window-renamed" => Self::WindowRenamed,
            "window-layout-changed" => Self::WindowLayoutChanged,
            "window-pane-changed" => Self::WindowPaneChanged,
            "pane-exited" => Self::PaneExited,
            "pane-mode-changed" => Self::PaneModeChanged,
            "paste-buffer-changed" => Self::PasteBufferChanged,
            "paste-buffer-deleted" => Self::PasteBufferDeleted,
            "after-select-window" => Self::AfterSelectWindow,
            "after-select-pane" => Self::AfterSelectPane,
            "after-send-keys" => Self::AfterSendKeys,
            "after-set-option" => Self::AfterSetOption,
            "after-bind-key" => Self::AfterBindKey,
            "after-capture-pane" => Self::AfterCapturePane,
            "after-copy-mode" => Self::AfterCopyMode,
            "after-display-message" => Self::AfterDisplayMessage,
            "after-display-panes" => Self::AfterDisplayPanes,
            "after-kill-pane" => Self::AfterKillPane,
            "after-list-buffers" => Self::AfterListBuffers,
            "after-list-clients" => Self::AfterListClients,
            "after-list-keys" => Self::AfterListKeys,
            "after-list-panes" => Self::AfterListPanes,
            "after-list-sessions" => Self::AfterListSessions,
            "after-list-windows" => Self::AfterListWindows,
            "after-load-buffer" => Self::AfterLoadBuffer,
            "after-lock-server" => Self::AfterLockServer,
            "after-new-session" => Self::AfterNewSession,
            "after-new-window" => Self::AfterNewWindow,
            "after-paste-buffer" => Self::AfterPasteBuffer,
            "after-pipe-pane" => Self::AfterPipePane,
            "after-queue" => Self::AfterQueue,
            "after-refresh-client" => Self::AfterRefreshClient,
            "after-rename-session" => Self::AfterRenameSession,
            "after-rename-window" => Self::AfterRenameWindow,
            "after-resize-pane" => Self::AfterResizePane,
            "after-resize-window" => Self::AfterResizeWindow,
            "after-save-buffer" => Self::AfterSaveBuffer,
            "after-select-layout" => Self::AfterSelectLayout,
            "after-set-buffer" => Self::AfterSetBuffer,
            "after-set-environment" => Self::AfterSetEnvironment,
            "after-set-hook" => Self::AfterSetHook,
            "after-show-environment" => Self::AfterShowEnvironment,
            "after-show-messages" => Self::AfterShowMessages,
            "after-show-options" => Self::AfterShowOptions,
            "after-split-window" => Self::AfterSplitWindow,
            "after-unbind-key" => Self::AfterUnbindKey,
            "alert-activity" => Self::AlertActivity,
            "alert-bell" => Self::AlertBell,
            "alert-silence" => Self::AlertSilence,
            "client-active" => Self::ClientActive,
            "client-focus-in" => Self::ClientFocusIn,
            "client-focus-out" => Self::ClientFocusOut,
            "client-resized" => Self::ClientResized,
            "client-light-theme" => Self::ClientLightTheme,
            "client-dark-theme" => Self::ClientDarkTheme,
            "command-error" => Self::CommandError,
            "pane-died" => Self::PaneDied,
            "pane-focus-in" => Self::PaneFocusIn,
            "pane-focus-out" => Self::PaneFocusOut,
            "pane-set-clipboard" => Self::PaneSetClipboard,
            "pane-title-changed" => Self::PaneTitleChanged,
            "window-resized" => Self::WindowResized,
            _ => return None,
        })
    }

    /// Parses a tmux-visible hook name.
    #[must_use]
    pub fn from_str_opt(value: &str) -> Option<Self> {
        Self::from_str(value)
    }
}

impl std::str::FromStr for HookName {
    type Err = ();

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        Self::from_str_opt(value).ok_or(())
    }
}

impl fmt::Display for HookName {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

/// Hook lifecycle semantics carried on the wire.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum HookLifecycle {
    /// A hook that survives repeated dispatch.
    Persistent,
    /// A hook that is removed after one dispatch.
    OneShot,
}
