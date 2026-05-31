use std::path::PathBuf;

use clap::{ArgAction, ArgGroup, Args};
use rmux_proto::{Target, WaitForMode};

use super::{parse_target, parse_target_spec, TargetSpec};

#[derive(Debug, Clone, Args)]
pub(crate) struct RunShellArgs {
    #[arg(short = 'b', action = ArgAction::SetTrue)]
    pub(crate) background: bool,
    #[arg(short = 'C', action = ArgAction::SetTrue)]
    pub(crate) as_commands: bool,
    #[arg(short = 'E', action = ArgAction::SetTrue)]
    pub(crate) show_stderr: bool,
    #[arg(short = 'd')]
    pub(crate) delay_seconds: Option<f64>,
    #[arg(short = 'c')]
    pub(crate) start_directory: Option<PathBuf>,
    #[arg(short = 't', value_parser = parse_target_spec)]
    pub(crate) target: Option<TargetSpec>,
    #[arg(allow_hyphen_values = true, trailing_var_arg = true)]
    pub(crate) command: Vec<String>,
}

#[derive(Debug, Clone, Args)]
pub(crate) struct SourceFileArgs {
    #[arg(short = 'F', action = ArgAction::SetTrue)]
    pub(crate) expand_paths: bool,
    #[arg(short = 'n', action = ArgAction::SetTrue)]
    pub(crate) parse_only: bool,
    #[arg(short = 'q', action = ArgAction::SetTrue)]
    pub(crate) quiet: bool,
    #[arg(short = 'v', action = ArgAction::SetTrue)]
    pub(crate) verbose: bool,
    #[arg(short = 't', value_parser = parse_target_spec)]
    pub(crate) target: Option<TargetSpec>,
    #[arg(required = true, allow_hyphen_values = true)]
    pub(crate) paths: Vec<String>,
}

#[derive(Debug, Clone, Args)]
pub(crate) struct IfShellArgs {
    #[arg(short = 'b', action = ArgAction::SetTrue)]
    pub(crate) background: bool,
    #[arg(short = 'F', action = ArgAction::SetTrue)]
    pub(crate) format_mode: bool,
    #[arg(short = 't', value_parser = parse_target)]
    pub(crate) target: Option<Target>,
    #[arg(allow_hyphen_values = true)]
    pub(crate) condition: String,
    #[arg(allow_hyphen_values = true)]
    pub(crate) then_command: String,
    #[arg(allow_hyphen_values = true)]
    pub(crate) else_command: Option<String>,
}

#[derive(Debug, Clone, Args)]
#[command(group(
    ArgGroup::new("mode")
        .required(false)
        .multiple(false)
        .args(["signal", "lock", "unlock"])
))]
pub(crate) struct WaitForArgs {
    #[arg(short = 'S', action = ArgAction::SetTrue, group = "mode")]
    pub(crate) signal: bool,
    #[arg(short = 'L', action = ArgAction::SetTrue, group = "mode")]
    pub(crate) lock: bool,
    #[arg(short = 'U', action = ArgAction::SetTrue, group = "mode")]
    pub(crate) unlock: bool,
    #[arg(allow_hyphen_values = true)]
    pub(crate) channel: String,
}

impl WaitForArgs {
    pub(crate) fn mode(&self) -> WaitForMode {
        if self.signal {
            WaitForMode::Signal
        } else if self.lock {
            WaitForMode::Lock
        } else if self.unlock {
            WaitForMode::Unlock
        } else {
            WaitForMode::Wait
        }
    }
}
