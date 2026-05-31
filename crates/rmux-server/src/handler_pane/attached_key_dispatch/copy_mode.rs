use rmux_core::command_parser::{CommandArgument, ParsedCommands};

pub(super) struct DirectCopyModeCommand {
    pub(super) command: String,
    pub(super) args: Vec<String>,
    pub(super) repeat_count: usize,
}

pub(super) fn direct_copy_mode_command(commands: &ParsedCommands) -> Option<DirectCopyModeCommand> {
    if !commands.assignments().is_empty() {
        return None;
    }
    let [command] = commands.commands() else {
        return None;
    };
    if !matches!(command.name(), "send" | "send-keys") {
        return None;
    }

    let mut args = command.arguments().iter();
    let mut copy_mode_command = false;
    let mut repeat_count = 1;
    let mut command_args = Vec::new();
    while let Some(argument) = args.next() {
        let value = argument.as_string()?;
        match value {
            "--" => {
                command_args.extend(copy_mode_argument_strings(args)?);
                break;
            }
            "-X" => copy_mode_command = true,
            "-N" => {
                repeat_count = args.next()?.as_string()?.parse::<usize>().ok()?.max(1);
            }
            value if value.starts_with("-N") && value.len() > 2 => {
                repeat_count = value[2..].parse::<usize>().ok()?.max(1);
            }
            value if value.starts_with('-') => return None,
            value => {
                command_args.push(value.to_owned());
                command_args.extend(copy_mode_argument_strings(args)?);
                break;
            }
        }
    }

    if !copy_mode_command {
        return None;
    }
    let command = command_args.first()?.clone();
    Some(DirectCopyModeCommand {
        command,
        args: command_args.into_iter().skip(1).collect(),
        repeat_count,
    })
}

fn copy_mode_argument_strings<'a>(
    args: impl Iterator<Item = &'a CommandArgument>,
) -> Option<Vec<String>> {
    args.map(|argument| argument.as_string().map(str::to_owned))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn direct_copy_mode_command_accepts_send_alias() {
        use rmux_core::command_parser::CommandParser;

        let parsed = CommandParser::new()
            .parse_one_group("send -N3 -X cancel")
            .unwrap();
        let command = direct_copy_mode_command(&parsed).unwrap();

        assert_eq!(command.command, "cancel");
        assert_eq!(command.args, Vec::<String>::new());
        assert_eq!(command.repeat_count, 3);
    }
}
