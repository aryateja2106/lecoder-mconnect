use std::path::PathBuf;
use std::process::Stdio;

use crate::terminal::shell_tokio_command;
use rmux_proto::RmuxError;
use tokio::io::AsyncWriteExt;

use super::args::{
    ensure_max_positional, ensure_no_extra_args, parse_flagged_args, parse_positionals,
};
use super::text::{normalize_positions, owner_positions};
use super::types::{
    ClearPolicy, CopyBufferTarget, CopyModeCommandOutcome, CopyModePipeCommand, CopyModeTransfer,
    CopyPosition, ModeKeys, SelectionMode,
};
use super::CopyModeState;

impl CopyModeState {
    pub(super) fn transfer_selection(
        &mut self,
        args: &[String],
        append: bool,
        cancel: bool,
        clear_selection: bool,
    ) -> Result<CopyModeCommandOutcome, RmuxError> {
        let data = self.current_selection_bytes();
        let outcome = CopyModeCommandOutcome {
            cancel,
            transfer: Some(CopyModeTransfer {
                data,
                buffer_target: Some(if append {
                    CopyBufferTarget::Top
                } else {
                    CopyBufferTarget::New(None)
                }),
                append,
                pipe_command: None,
            }),
        };
        if clear_selection {
            self.selection = None;
        }
        ensure_no_extra_args("append-selection", args)?;
        Ok(self.finish_policy(outcome, ClearPolicy::Always))
    }

    pub(super) fn transfer_copy_selection(
        &mut self,
        args: &[String],
        cancel: bool,
        clear: ClearPolicy,
    ) -> Result<CopyModeCommandOutcome, RmuxError> {
        let parsed = parse_flagged_args(args, "CP")?;
        ensure_max_positional("copy-selection", &parsed.positionals, 1)?;
        let data = self.current_selection_bytes();
        let buffer_target = if parsed.flags.contains(&'P') {
            None
        } else {
            Some(CopyBufferTarget::New(
                parsed
                    .positionals
                    .first()
                    .cloned()
                    .filter(|value| !value.is_empty()),
            ))
        };
        let outcome = CopyModeCommandOutcome {
            cancel,
            transfer: Some(CopyModeTransfer {
                data,
                buffer_target,
                append: false,
                pipe_command: None,
            }),
        };
        if clear != ClearPolicy::Never {
            self.selection = None;
        }
        Ok(self.finish_policy(outcome, clear))
    }

    pub(super) fn transfer_copy_pipe(
        &mut self,
        args: &[String],
        cancel: bool,
        clear: ClearPolicy,
    ) -> Result<CopyModeCommandOutcome, RmuxError> {
        let parsed = parse_flagged_args(args, "CP")?;
        ensure_max_positional("copy-pipe", &parsed.positionals, 2)?;
        let data = self.current_selection_bytes();
        let buffer_target = if parsed.flags.contains(&'P') {
            None
        } else {
            Some(CopyBufferTarget::New(
                parsed
                    .positionals
                    .get(1)
                    .cloned()
                    .filter(|value| !value.is_empty()),
            ))
        };
        let outcome = CopyModeCommandOutcome {
            cancel,
            transfer: Some(CopyModeTransfer {
                data,
                buffer_target,
                append: false,
                pipe_command: Some(copy_pipe_command(&parsed.positionals)),
            }),
        };
        if clear != ClearPolicy::Never {
            self.selection = None;
        }
        Ok(self.finish_policy(outcome, clear))
    }

    pub(super) fn transfer_pipe(
        &mut self,
        args: &[String],
        cancel: bool,
        clear: ClearPolicy,
    ) -> Result<CopyModeCommandOutcome, RmuxError> {
        let positionals = parse_positionals(args)?;
        ensure_max_positional("pipe", &positionals, 1)?;
        let data = self.current_selection_bytes();
        let outcome = CopyModeCommandOutcome {
            cancel,
            transfer: Some(CopyModeTransfer {
                data,
                buffer_target: None,
                append: false,
                pipe_command: explicit_pipe_command(&positionals),
            }),
        };
        if clear != ClearPolicy::Never {
            self.selection = None;
        }
        Ok(self.finish_policy(outcome, clear))
    }

    pub(super) fn transfer_line(
        &mut self,
        args: &[String],
        pipe: bool,
        cancel: bool,
    ) -> Result<CopyModeCommandOutcome, RmuxError> {
        let parsed = parse_flagged_args(args, "CP")?;
        ensure_max_positional("copy-line", &parsed.positionals, if pipe { 2 } else { 1 })?;
        let data = self.current_line_transfer_bytes();
        let buffer_target = if pipe {
            if parsed.flags.contains(&'P') {
                None
            } else {
                Some(CopyBufferTarget::New(
                    parsed
                        .positionals
                        .get(1)
                        .cloned()
                        .filter(|value| !value.is_empty()),
                ))
            }
        } else {
            Some(CopyBufferTarget::New(
                parsed
                    .positionals
                    .first()
                    .cloned()
                    .filter(|value| !value.is_empty()),
            ))
        };
        let outcome = CopyModeCommandOutcome {
            cancel,
            transfer: Some(CopyModeTransfer {
                data,
                buffer_target,
                append: false,
                pipe_command: if pipe {
                    Some(copy_pipe_command(&parsed.positionals))
                } else {
                    None
                },
            }),
        };
        Ok(self.finish_policy(outcome, ClearPolicy::Always))
    }

    pub(super) fn transfer_end_of_line(
        &mut self,
        args: &[String],
        pipe: bool,
        cancel: bool,
    ) -> Result<CopyModeCommandOutcome, RmuxError> {
        let parsed = parse_flagged_args(args, "CP")?;
        ensure_max_positional(
            "copy-end-of-line",
            &parsed.positionals,
            if pipe { 2 } else { 1 },
        )?;
        let data = self.current_end_of_line_transfer_bytes();
        let buffer_target = if pipe {
            if parsed.flags.contains(&'P') {
                None
            } else {
                Some(CopyBufferTarget::New(
                    parsed
                        .positionals
                        .get(1)
                        .cloned()
                        .filter(|value| !value.is_empty()),
                ))
            }
        } else {
            Some(CopyBufferTarget::New(
                parsed
                    .positionals
                    .first()
                    .cloned()
                    .filter(|value| !value.is_empty()),
            ))
        };
        let outcome = CopyModeCommandOutcome {
            cancel,
            transfer: Some(CopyModeTransfer {
                data,
                buffer_target,
                append: false,
                pipe_command: if pipe {
                    Some(copy_pipe_command(&parsed.positionals))
                } else {
                    None
                },
            }),
        };
        Ok(self.finish_policy(outcome, ClearPolicy::Always))
    }

    fn current_selection_bytes(&self) -> Vec<u8> {
        self.extract_selection()
            .map(|text| text.into_bytes())
            .unwrap_or_default()
    }

    fn current_line_transfer_bytes(&self) -> Vec<u8> {
        let text = self.full_line_text(self.cursor.y, true);
        if text.is_empty() {
            b"\n".to_vec()
        } else {
            format!("{text}\n").into_bytes()
        }
    }

    fn current_end_of_line_transfer_bytes(&self) -> Vec<u8> {
        let line = self.line(self.cursor.y);
        let start = line.owning_cell_x(self.cursor.x).unwrap_or(0);
        let end = self.line_end_x(self.cursor.y);
        let text = self.extract_line_range(&line, start, end, true);
        format!("{text}\n").into_bytes()
    }

    fn extract_selection(&self) -> Option<String> {
        let selection = self.selection_snapshot()?;
        let (start, end) = normalize_positions(selection.anchor, selection.end);
        if selection.mode == SelectionMode::Char && !self.rectangle {
            return Some(match self.mode_keys {
                ModeKeys::Vi => self.extract_char_selection_inclusive(start, end),
                ModeKeys::Emacs => self.extract_char_selection_exclusive(start, end),
            });
        }
        let mut lines = Vec::new();
        let rect_min_x = start.x.min(end.x);
        let rect_max_x = start.x.max(end.x);
        for y in start.y..=end.y {
            let line = self.line(y);
            let text = match selection.mode {
                SelectionMode::Line => self.full_line_text(y, true),
                SelectionMode::Char | SelectionMode::Word if self.rectangle => {
                    self.extract_line_range(&line, rect_min_x, rect_max_x, false)
                }
                SelectionMode::Char | SelectionMode::Word => {
                    let range_start = if y == start.y { start.x } else { 0 };
                    let range_end = if y == end.y {
                        end.x
                    } else {
                        self.line_end_x(y)
                    };
                    self.extract_line_range(
                        &line,
                        range_start,
                        range_end,
                        y != start.y || y != end.y,
                    )
                }
            };
            lines.push(text);
        }
        Some(lines.join("\n"))
    }

    fn extract_char_selection_exclusive(&self, start: CopyPosition, end: CopyPosition) -> String {
        if start == end {
            return String::new();
        }
        let mut lines = Vec::new();
        for y in start.y..=end.y {
            let line = self.line(y);
            let range_start = if y == start.y { start.x } else { 0 };
            let Some(range_end) = (if y == end.y {
                self.exclusive_char_line_end(end)
            } else {
                Some(self.line_end_x(y))
            }) else {
                lines.push(String::new());
                continue;
            };
            if range_end < range_start {
                lines.push(String::new());
                continue;
            }
            lines.push(self.extract_line_range(
                &line,
                range_start,
                range_end,
                y != start.y || y != end.y,
            ));
        }
        lines.join("\n")
    }

    fn extract_char_selection_inclusive(&self, start: CopyPosition, end: CopyPosition) -> String {
        let mut lines = Vec::new();
        for y in start.y..=end.y {
            let line = self.line(y);
            let range_start = if y == start.y { start.x } else { 0 };
            let range_end = if y == end.y {
                end.x
            } else {
                self.line_end_x(y)
            };
            if range_end < range_start {
                lines.push(String::new());
                continue;
            }
            lines.push(self.extract_line_range(
                &line,
                range_start,
                range_end,
                y != start.y || y != end.y,
            ));
        }
        lines.join("\n")
    }

    fn exclusive_char_line_end(&self, end: CopyPosition) -> Option<u32> {
        let line = self.line(end.y);
        let owner = line.owning_cell_x(end.x).unwrap_or(end.x);
        owner_positions(&line).into_iter().rfind(|x| *x < owner)
    }
}

fn copy_pipe_command(positionals: &[String]) -> CopyModePipeCommand {
    explicit_pipe_command(positionals).unwrap_or(CopyModePipeCommand::CopyCommandOption)
}

fn explicit_pipe_command(positionals: &[String]) -> Option<CopyModePipeCommand> {
    positionals
        .first()
        .cloned()
        .filter(|value| !value.is_empty())
        .map(CopyModePipeCommand::Explicit)
}

pub(crate) async fn run_pipe_command(
    shell: &str,
    command: &str,
    working_directory: Option<&PathBuf>,
    data: &[u8],
) -> Result<(), RmuxError> {
    if command.is_empty() {
        return Ok(());
    }

    let cwd = working_directory
        .map(PathBuf::as_path)
        .unwrap_or_else(|| std::path::Path::new("."));
    let mut child = shell_tokio_command(std::path::Path::new(shell), cwd, command);
    child.stdin(Stdio::piped());
    child.kill_on_drop(true);
    if let Some(directory) = working_directory {
        child.current_dir(directory);
    }
    let mut child = child.spawn().map_err(|error| {
        RmuxError::Server(format!("failed to spawn pipe command '{command}': {error}"))
    })?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(data).await.map_err(|error| {
            RmuxError::Server(format!("failed to write selection to '{command}': {error}"))
        })?;
        stdin.shutdown().await.map_err(|error| {
            RmuxError::Server(format!("failed to close stdin for '{command}': {error}"))
        })?;
    }
    let status = child.wait().await.map_err(|error| {
        RmuxError::Server(format!(
            "failed to wait for pipe command '{command}': {error}"
        ))
    })?;
    if status.success() {
        Ok(())
    } else {
        Err(RmuxError::Server(format!(
            "pipe command '{command}' exited with status {status}"
        )))
    }
}

#[cfg(test)]
mod tests {
    use super::run_pipe_command;
    use std::time::{Duration, Instant};

    #[tokio::test(flavor = "current_thread")]
    async fn pipe_command_wait_does_not_block_the_runtime() {
        let (shell, command) = slow_shell_command();
        let start = Instant::now();
        let pipe = run_pipe_command(&shell, command, None, b"");
        tokio::pin!(pipe);

        tokio::select! {
            result = &mut pipe => panic!("pipe command completed before the runtime liveness probe: {result:?}"),
            _ = tokio::time::sleep(Duration::from_millis(50)) => {}
        }

        assert!(
            start.elapsed() < Duration::from_millis(250),
            "Tokio timer was starved while waiting for copy-pipe helper"
        );
        pipe.await.expect("slow pipe command should finish");
    }

    #[cfg(windows)]
    fn slow_shell_command() -> (String, &'static str) {
        (
            std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_owned()),
            "ping -n 2 127.0.0.1 >NUL",
        )
    }

    #[cfg(unix)]
    fn slow_shell_command() -> (String, &'static str) {
        ("/bin/sh".to_owned(), "sleep 0.3")
    }
}
