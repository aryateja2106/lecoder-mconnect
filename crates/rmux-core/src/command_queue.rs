//! tmux-style command queue data model.
//!
//! Command parsing owns parse-time expansion such as `$VAR`, `~user`,
//! `%if`, and `name=value`. The queue owns ordering, group IDs, insertion,
//! wait boundaries, and group abort decisions; command handlers own
//! execution-time expansion such as formats, target lookup, and option lookup.

use std::collections::VecDeque;

use crate::command_parser::{CommandGrouping, ParsedCommand, ParsedCommands};

/// A tmux command queue group ID.
///
/// Commands in the same group are adjacent commands from one parsed command
/// list that must be skipped together after the first execution error.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct CommandGroup(u64);

impl CommandGroup {
    /// Returns the numeric group ID.
    #[must_use]
    pub const fn get(self) -> u64 {
        self.0
    }
}

/// One parsed command plus the queue group assigned to it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct QueuedCommand {
    command: ParsedCommand,
    group: CommandGroup,
}

impl QueuedCommand {
    /// Returns the parsed command payload.
    #[must_use]
    pub const fn command(&self) -> &ParsedCommand {
        &self.command
    }

    /// Consumes this item and returns the parsed command payload.
    #[must_use]
    pub fn into_command(self) -> ParsedCommand {
        self.command
    }

    /// Returns this item's queue group.
    #[must_use]
    pub const fn group(&self) -> CommandGroup {
        self.group
    }
}

/// Result status for a fired queue command.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CommandQueueResult {
    /// The command completed and the queue may advance.
    Normal,
    /// The command failed; remaining items in the same group must be removed.
    Error,
    /// The command is waiting for an asynchronous continuation before the
    /// queue may advance.
    Wait,
}

/// Queue state for pre-parsed tmux commands.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommandQueue {
    items: VecDeque<QueuedCommand>,
    next_group: u64,
}

impl Default for CommandQueue {
    fn default() -> Self {
        Self {
            items: VecDeque::new(),
            next_group: 1,
        }
    }
}

impl CommandQueue {
    /// Creates an empty command queue.
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Builds a queue from one parsed command list.
    #[must_use]
    pub fn from_parsed(commands: ParsedCommands) -> Self {
        let mut queue = Self::new();
        queue.append_parsed(commands);
        queue
    }

    /// Returns whether the queue currently has no pending commands.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.items.is_empty()
    }

    /// Returns the number of pending commands.
    #[must_use]
    pub fn len(&self) -> usize {
        self.items.len()
    }

    /// Returns the pending commands in queue order.
    #[must_use]
    pub fn items(&self) -> &VecDeque<QueuedCommand> {
        &self.items
    }

    /// Appends a parsed command list to the back of the queue.
    pub fn append_parsed(&mut self, commands: ParsedCommands) {
        let items = self.assign_groups(commands);
        self.items.extend(items);
    }

    /// Inserts a parsed command list immediately after the command currently
    /// being executed.
    ///
    /// Callers pop the current item before firing it, so insertion after the
    /// current item is represented as prepending the newly built items before
    /// the remaining queue tail.
    pub fn insert_after_current(&mut self, commands: ParsedCommands) {
        let items = self.assign_groups(commands);
        for item in items.into_iter().rev() {
            self.items.push_front(item);
        }
    }

    /// Pops the next queue item.
    pub fn pop_front(&mut self) -> Option<QueuedCommand> {
        self.items.pop_front()
    }

    /// Removes all pending items from the same group.
    ///
    /// This matches tmux `cmdq_remove_group`: the failed item has already
    /// fired, and only later items are eligible for removal.
    pub fn remove_group(&mut self, group: CommandGroup) -> usize {
        let before = self.items.len();
        self.items.retain(|item| item.group != group);
        before - self.items.len()
    }

    fn assign_groups(&mut self, commands: ParsedCommands) -> Vec<QueuedCommand> {
        let grouping = commands.grouping();
        let mut assigned = Vec::new();
        let mut current_line = None;
        let mut current_group = None;

        for command in commands.into_commands() {
            let group = match grouping {
                CommandGrouping::OneGroup => {
                    *current_group.get_or_insert_with(|| self.next_group())
                }
                CommandGrouping::ByLine if current_line == Some(command.line()) => {
                    current_group.expect("line reuse requires an existing command group")
                }
                CommandGrouping::ByLine => {
                    current_line = Some(command.line());
                    let group = self.next_group();
                    current_group = Some(group);
                    group
                }
            };

            assigned.push(QueuedCommand { command, group });
        }

        assigned
    }

    fn next_group(&mut self) -> CommandGroup {
        let group = CommandGroup(self.next_group);
        self.next_group += 1;
        group
    }
}

#[cfg(test)]
mod tests {
    use crate::command_parser::{CommandArgument, CommandParser};

    use super::CommandQueue;

    fn queue_groups(input: &str) -> Vec<u64> {
        let parsed = CommandParser::new().parse(input).expect("commands parse");
        CommandQueue::from_parsed(parsed)
            .items()
            .iter()
            .map(|item| item.group().get())
            .collect()
    }

    #[test]
    fn same_source_line_commands_share_a_group() {
        assert_eq!(
            queue_groups("display-message first ; display-message second"),
            [1, 1]
        );
    }

    #[test]
    fn newline_separated_commands_get_distinct_groups() {
        assert_eq!(
            queue_groups("display-message first\ndisplay-message second"),
            [1, 2]
        );
    }

    #[test]
    fn argv_trailing_semicolon_commands_share_the_default_line_group() {
        let parsed = CommandParser::new()
            .parse_arguments(["display-message;", "display-message", "ok"])
            .expect("argv commands parse");
        let queue = CommandQueue::from_parsed(parsed);
        let groups = queue
            .items()
            .iter()
            .map(|item| item.group().get())
            .collect::<Vec<_>>();

        assert_eq!(groups, [1, 1]);
    }

    #[test]
    fn one_group_string_mode_collapses_multiline_commands() {
        let parsed = CommandParser::new()
            .parse_one_group("display-message first\ndisplay-message second")
            .expect("commands parse");
        let groups = CommandQueue::from_parsed(parsed)
            .items()
            .iter()
            .map(|item| item.group().get())
            .collect::<Vec<_>>();

        assert_eq!(groups, [1, 1]);
    }

    #[test]
    fn brace_arguments_remain_preparsed_command_lists() {
        let parsed = CommandParser::new()
            .parse("if-shell -F 1 { display-message yes ; list-sessions }")
            .expect("commands parse");
        let queue = CommandQueue::from_parsed(parsed);
        let arguments = queue.items()[0].command().arguments();
        let nested = match &arguments[2] {
            CommandArgument::Commands(nested) => nested,
            CommandArgument::String(value) => panic!("expected parsed command list, got {value}"),
        };
        let names = nested
            .commands()
            .iter()
            .map(|command| command.name())
            .collect::<Vec<_>>();

        assert_eq!(names, ["display-message", "list-sessions"]);
    }

    #[test]
    fn one_group_mode_propagates_into_brace_command_lists() {
        let parsed = CommandParser::new()
            .parse_one_group("if-shell -F 1 { display-message yes\nlist-sessions }")
            .expect("commands parse");
        let queue = CommandQueue::from_parsed(parsed);
        let arguments = queue.items()[0].command().arguments();
        let nested = match &arguments[2] {
            CommandArgument::Commands(nested) => nested.clone(),
            CommandArgument::String(value) => panic!("expected parsed command list, got {value}"),
        };
        let groups = CommandQueue::from_parsed(nested)
            .items()
            .iter()
            .map(|item| item.group().get())
            .collect::<Vec<_>>();

        assert_eq!(groups, [1, 1]);
    }

    #[test]
    fn insert_after_current_preserves_inserted_order_and_fresh_groups() {
        let parser = CommandParser::new();
        let parsed = parser
            .parse("display-message parent ; display-message tail")
            .expect("commands parse");
        let mut queue = CommandQueue::from_parsed(parsed);
        let current = queue.pop_front().expect("current command");

        queue.insert_after_current(
            parser
                .parse("display-message inserted-one\ndisplay-message inserted-two")
                .expect("inserted commands parse"),
        );

        let queued = queue
            .items()
            .iter()
            .map(|item| {
                (
                    item.command().arguments()[0]
                        .as_string()
                        .expect("display-message argument")
                        .to_owned(),
                    item.group().get(),
                )
            })
            .collect::<Vec<_>>();

        assert_eq!(
            queued,
            [
                ("inserted-one".to_owned(), 2),
                ("inserted-two".to_owned(), 3),
                ("tail".to_owned(), current.group().get()),
            ]
        );
    }

    #[test]
    fn remove_group_removes_noncontiguous_later_members() {
        let parser = CommandParser::new();
        let parsed = parser
            .parse("display-message first ; display-message skipped")
            .expect("commands parse");
        let mut queue = CommandQueue::from_parsed(parsed);
        let failed = queue.pop_front().expect("failed command");

        queue.insert_after_current(
            parser
                .parse("display-message inserted")
                .expect("inserted command parses"),
        );

        assert_eq!(queue.remove_group(failed.group()), 1);
        assert_eq!(queue.len(), 1);
        assert_eq!(
            queue.items()[0].command().arguments()[0].as_string(),
            Some("inserted")
        );
    }

    #[test]
    fn alias_expansion_uses_string_mode_and_inherits_source_line() {
        let parsed = CommandParser::new()
            .with_command_alias("q=display-message one\ndisplay-message two")
            .expect("valid alias")
            .parse("q\ndisplay-message kept")
            .expect("commands parse");
        let queue = CommandQueue::from_parsed(parsed);
        let groups = queue
            .items()
            .iter()
            .map(|item| item.group().get())
            .collect::<Vec<_>>();

        assert_eq!(groups, [1, 1, 2]);
    }

    #[test]
    fn remove_group_preserves_commands_from_later_lines() {
        let parsed = CommandParser::new()
            .parse("display-message first ; display-message skipped\ndisplay-message kept")
            .expect("commands parse");
        let mut queue = CommandQueue::from_parsed(parsed);
        let failed = queue.pop_front().expect("first command");

        assert_eq!(queue.remove_group(failed.group()), 1);
        assert_eq!(queue.len(), 1);
        assert_eq!(
            queue.items()[0].command().arguments()[0].as_string(),
            Some("kept")
        );
    }
}
