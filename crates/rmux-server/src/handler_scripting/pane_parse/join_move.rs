use rmux_proto::{
    JoinPaneRequest, MovePaneRequest, PaneSplitSize, Request, RmuxError, SplitDirection,
};

use super::super::parse_pane_target;
use super::super::tokens::CommandTokens;
use super::super::values::{missing_argument, parse_percentage, parse_u32};

pub(in crate::handler::scripting_support) fn parse_join_pane(
    mut args: CommandTokens,
) -> Result<Request, RmuxError> {
    parse_join_or_move_pane(&mut args, "join-pane", false)
}

pub(in crate::handler::scripting_support) fn parse_move_pane(
    mut args: CommandTokens,
) -> Result<Request, RmuxError> {
    parse_join_or_move_pane(&mut args, "move-pane", true)
}

fn parse_join_or_move_pane(
    args: &mut CommandTokens,
    command: &str,
    as_move: bool,
) -> Result<Request, RmuxError> {
    let mut detached = false;
    let mut before = false;
    let mut full_size = false;
    let mut direction = SplitDirection::Vertical;
    let mut direction_set = false;
    let mut size = None;
    let mut source = None;
    let mut target = None;

    while let Some(token) = args.peek() {
        match token {
            "--" => {
                let _ = args.optional();
                break;
            }
            "-b" => {
                let _ = args.optional();
                before = true;
            }
            "-d" => {
                let _ = args.optional();
                detached = true;
            }
            "-f" => {
                let _ = args.optional();
                full_size = true;
            }
            "-h" => {
                let _ = args.optional();
                if direction_set {
                    return Err(RmuxError::Server(format!(
                        "{command} accepts only one of -h or -v"
                    )));
                }
                direction = SplitDirection::Horizontal;
                direction_set = true;
            }
            "-l" => {
                let _ = args.optional();
                if size.is_some() {
                    return Err(RmuxError::Server(format!(
                        "{command} accepts only one of -l or -p"
                    )));
                }
                size = Some(parse_pane_split_size(
                    command,
                    "-l",
                    &args.required("-l size")?,
                )?);
            }
            "-p" => {
                let _ = args.optional();
                if size.is_some() {
                    return Err(RmuxError::Server(format!(
                        "{command} accepts only one of -l or -p"
                    )));
                }
                size = Some(PaneSplitSize::Percentage(parse_percentage(
                    command,
                    "-p",
                    &args.required("-p percentage")?,
                )?));
            }
            "-v" => {
                let _ = args.optional();
                if direction_set {
                    return Err(RmuxError::Server(format!(
                        "{command} accepts only one of -h or -v"
                    )));
                }
                direction = SplitDirection::Vertical;
                direction_set = true;
            }
            "-s" => {
                let _ = args.optional();
                source = Some(parse_pane_target(command, args.required("-s target")?)?);
            }
            "-t" => {
                let _ = args.optional();
                target = Some(parse_pane_target(command, args.required("-t target")?)?);
            }
            _ => break,
        }
    }
    args.no_extra(command)?;

    let request = JoinPaneRequest {
        source: source.ok_or_else(|| missing_argument(command, "-s target"))?,
        target: target.ok_or_else(|| missing_argument(command, "-t target"))?,
        direction,
        detached,
        before,
        full_size,
        size,
    };

    if as_move {
        Ok(Request::MovePane(MovePaneRequest {
            source: request.source,
            target: request.target,
            direction: request.direction,
            detached: request.detached,
            before: request.before,
            full_size: request.full_size,
            size: request.size,
        }))
    } else {
        Ok(Request::JoinPane(request))
    }
}

fn parse_pane_split_size(
    command: &str,
    flag: &str,
    value: &str,
) -> Result<PaneSplitSize, RmuxError> {
    if let Some(percentage) = value.strip_suffix('%') {
        return Ok(PaneSplitSize::Percentage(parse_percentage(
            command, flag, percentage,
        )?));
    }

    Ok(PaneSplitSize::Absolute(parse_u32(command, flag, value)?))
}
