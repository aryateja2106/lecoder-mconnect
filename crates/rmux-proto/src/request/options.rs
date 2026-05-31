use serde::{Deserialize, Serialize};

use crate::{
    HookLifecycle, HookName, OptionName, OptionScopeSelector, ScopeSelector, SetOptionMode,
};

/// The supported `set-environment` mutation modes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SetEnvironmentMode {
    /// Store or replace a concrete value.
    Set,
    /// Leave a tombstone entry in place of a value.
    Clear,
    /// Remove the entry entirely.
    Unset,
}

/// Request payload for `set-option`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SetOptionRequest {
    /// The selected mutation scope.
    pub scope: ScopeSelector,
    /// The supported option name.
    pub option: OptionName,
    /// The raw option value.
    pub value: String,
    /// Whether the mutation replaces or appends.
    pub mode: SetOptionMode,
}

/// Request payload for `set-option` using an open option name.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SetOptionByNameRequest {
    /// The selected mutation scope.
    pub scope: OptionScopeSelector,
    /// The raw option name, including optional array index syntax.
    pub name: String,
    /// The raw option value. `None` applies tmux-style toggle or unset semantics.
    pub value: Option<String>,
    /// Whether the mutation replaces or appends.
    pub mode: SetOptionMode,
    /// Rejects the mutation when the target entry is already explicitly set.
    pub only_if_unset: bool,
    /// Removes the targeted option entry instead of setting it.
    pub unset: bool,
    /// Unsets pane-local overrides beneath a targeted window before unsetting it.
    pub unset_pane_overrides: bool,
}

/// Request payload for `set-environment`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SetEnvironmentRequest {
    /// The selected mutation scope.
    pub scope: ScopeSelector,
    /// The environment variable name.
    pub name: String,
    /// The environment variable value.
    pub value: String,
    /// Optional tmux-style mutation mode. `None` preserves legacy set semantics.
    #[serde(default)]
    pub mode: Option<SetEnvironmentMode>,
    /// Whether the stored entry should be hidden from normal display and child inheritance.
    #[serde(default)]
    pub hidden: bool,
    /// Whether the value should be format-expanded before storage.
    #[serde(default)]
    pub format: bool,
}

/// Request payload for `set-hook`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SetHookRequest {
    /// The selected mutation scope.
    pub scope: ScopeSelector,
    /// The supported hook name.
    pub hook: HookName,
    /// The shell command string executed by the server.
    pub command: String,
    /// The hook lifecycle semantics.
    pub lifecycle: HookLifecycle,
}

/// Extended request payload for `set-hook`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SetHookMutationRequest {
    /// The selected mutation scope.
    pub scope: ScopeSelector,
    /// The supported hook name.
    pub hook: HookName,
    /// The optional shell command string executed by the server.
    pub command: Option<String>,
    /// The hook lifecycle semantics.
    pub lifecycle: HookLifecycle,
    /// Whether the mutation should append to the next free array slot.
    pub append: bool,
    /// Whether the mutation should remove the hook instead of setting it.
    pub unset: bool,
    /// Whether the hook should fire immediately without storing the mutation.
    pub run_immediately: bool,
    /// The optional explicit array index.
    pub index: Option<u32>,
}
