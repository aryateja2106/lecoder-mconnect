use clap::Args;

#[derive(Debug, Clone, Args)]
pub(crate) struct ListCommandsArgs {
    #[arg(short = 'F', allow_hyphen_values = true)]
    pub(crate) format: Option<String>,
    #[arg(allow_hyphen_values = true)]
    pub(crate) command: Option<String>,
}
