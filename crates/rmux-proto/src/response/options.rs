use serde::{Deserialize, Serialize};

use super::CommandOutput;
use crate::{
    HookLifecycle, HookName, OptionName, OptionScopeSelector, ScopeSelector, SetOptionMode,
};

/// Response payload for `set-option`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SetOptionResponse {
    /// The applied scope.
    pub scope: ScopeSelector,
    /// The mutated option.
    pub option: OptionName,
    /// The mutation mode applied by the server.
    pub mode: SetOptionMode,
}

/// Response payload for string-based `set-option`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SetOptionByNameResponse {
    /// The applied scope.
    pub scope: OptionScopeSelector,
    /// The canonical option name.
    pub name: String,
    /// The mutation mode applied by the server.
    pub mode: SetOptionMode,
}

/// Response payload for `set-environment`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SetEnvironmentResponse {
    /// The applied scope.
    pub scope: ScopeSelector,
    /// The environment variable name that was mutated.
    pub name: String,
}

/// Response payload for `set-hook`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SetHookResponse {
    /// The applied scope.
    pub scope: ScopeSelector,
    /// The registered hook.
    pub hook: HookName,
    /// The registered lifecycle.
    pub lifecycle: HookLifecycle,
}

/// Response payload for `show-options`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ShowOptionsResponse {
    /// The selected option scope.
    pub scope: OptionScopeSelector,
    /// The pre-rendered stdout bytes for the CLI.
    pub output: CommandOutput,
}

impl ShowOptionsResponse {
    /// Returns the reusable stdout payload for the show command.
    #[must_use]
    pub fn command_output(&self) -> &CommandOutput {
        &self.output
    }
}

/// Response payload for `show-environment`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ShowEnvironmentResponse {
    /// The selected environment scope.
    pub scope: ScopeSelector,
    /// The pre-rendered stdout bytes for the CLI.
    pub output: CommandOutput,
}

impl ShowEnvironmentResponse {
    /// Returns the reusable stdout payload for the show command.
    #[must_use]
    pub fn command_output(&self) -> &CommandOutput {
        &self.output
    }
}

/// Response payload for `show-hooks`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ShowHooksResponse {
    /// The selected hook scope.
    pub scope: ScopeSelector,
    /// The pre-rendered stdout bytes for the CLI.
    pub output: CommandOutput,
}

impl ShowHooksResponse {
    /// Returns the reusable stdout payload for the show command.
    #[must_use]
    pub fn command_output(&self) -> &CommandOutput {
        &self.output
    }
}
