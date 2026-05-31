use clap::{ArgAction, ArgGroup, Args};

use super::{parse_target_spec, TargetSpec};

#[derive(Debug, Clone, Args)]
#[command(group(
    ArgGroup::new("buffer_action")
        .required(true)
        .multiple(false)
        .args(["content", "new_name"])
))]
pub(crate) struct SetBufferArgs {
    #[arg(short = 'a', action = ArgAction::SetTrue)]
    pub(crate) append: bool,
    #[arg(short = 'b')]
    pub(crate) name: Option<String>,
    #[arg(short = 'n')]
    pub(crate) new_name: Option<String>,
    #[arg(short = 'w', action = ArgAction::SetTrue)]
    pub(crate) set_clipboard: bool,
    #[arg()]
    pub(crate) content: Option<String>,
}

#[derive(Debug, Clone, Args)]
pub(crate) struct ShowBufferArgs {
    #[arg(short = 'b')]
    pub(crate) name: Option<String>,
}

#[derive(Debug, Clone, Args)]
pub(crate) struct PasteBufferArgs {
    #[arg(short = 'b')]
    pub(crate) name: Option<String>,
    #[arg(short = 't', value_parser = parse_target_spec)]
    pub(crate) target: Option<TargetSpec>,
    #[arg(short = 'd', action = ArgAction::SetTrue)]
    pub(crate) delete_after: bool,
    #[arg(short = 'p', action = ArgAction::SetTrue)]
    pub(crate) bracketed: bool,
    #[arg(short = 'r', action = ArgAction::SetTrue)]
    pub(crate) linefeed: bool,
    #[arg(short = 'S', action = ArgAction::SetTrue)]
    pub(crate) raw: bool,
    #[arg(short = 's', allow_hyphen_values = true)]
    pub(crate) separator: Option<String>,
}

#[derive(Debug, Clone, Args)]
pub(crate) struct DeleteBufferArgs {
    #[arg(short = 'b')]
    pub(crate) name: Option<String>,
}

#[derive(Debug, Clone, Args)]
pub(crate) struct LoadBufferArgs {
    #[arg(short = 'b')]
    pub(crate) name: Option<String>,
    #[arg(short = 'w', action = ArgAction::SetTrue)]
    pub(crate) set_clipboard: bool,
    #[arg(allow_hyphen_values = true)]
    pub(crate) path: String,
}

#[derive(Debug, Clone, Args)]
pub(crate) struct SaveBufferArgs {
    #[arg(short = 'b')]
    pub(crate) name: Option<String>,
    #[arg(short = 'a', action = ArgAction::SetTrue)]
    pub(crate) append: bool,
    #[arg(allow_hyphen_values = true)]
    pub(crate) path: String,
}

#[derive(Debug, Clone, Args)]
pub(crate) struct ListBuffersArgs {
    #[arg(short = 'F')]
    pub(crate) format: Option<String>,
    #[arg(short = 'f')]
    pub(crate) filter: Option<String>,
    #[arg(short = 'O')]
    pub(crate) sort_order: Option<String>,
    #[arg(short = 'r', action = ArgAction::SetTrue)]
    pub(crate) reversed: bool,
}
