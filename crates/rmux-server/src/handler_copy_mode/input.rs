use crate::copy_mode::ModeKeys;

use super::super::prompt_support::PromptInputEvent;
use super::search::AttachedCopyModeSearchDirection;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum AttachedCopyModeInputAction {
    Command(&'static str),
    Search(AttachedCopyModeSearchDirection),
    Ignore,
}

pub(super) fn attached_copy_mode_input_action(
    mode_keys: ModeKeys,
    event: &PromptInputEvent,
) -> AttachedCopyModeInputAction {
    if mode_keys == ModeKeys::Vi {
        match event {
            PromptInputEvent::Char('/') => {
                return AttachedCopyModeInputAction::Search(
                    AttachedCopyModeSearchDirection::Forward,
                );
            }
            PromptInputEvent::KeyName(name) if name == "/" => {
                return AttachedCopyModeInputAction::Search(
                    AttachedCopyModeSearchDirection::Forward,
                );
            }
            PromptInputEvent::Char('?') => {
                return AttachedCopyModeInputAction::Search(
                    AttachedCopyModeSearchDirection::Backward,
                );
            }
            PromptInputEvent::KeyName(name) if name == "?" => {
                return AttachedCopyModeInputAction::Search(
                    AttachedCopyModeSearchDirection::Backward,
                );
            }
            PromptInputEvent::Char('n') => {
                return AttachedCopyModeInputAction::Command("search-again");
            }
            PromptInputEvent::KeyName(name) if name == "n" => {
                return AttachedCopyModeInputAction::Command("search-again");
            }
            PromptInputEvent::Char('N') => {
                return AttachedCopyModeInputAction::Command("search-reverse");
            }
            PromptInputEvent::KeyName(name) if name == "N" => {
                return AttachedCopyModeInputAction::Command("search-reverse");
            }
            PromptInputEvent::Enter => {
                return AttachedCopyModeInputAction::Command("copy-selection-and-cancel");
            }
            _ => {}
        }
    }

    let command = match event {
        PromptInputEvent::Char(' ') => "begin-selection",
        PromptInputEvent::KeyName(name) if name == "Space" || name == " " => "begin-selection",
        PromptInputEvent::Enter => "copy-selection-no-clear",
        PromptInputEvent::Right => "cursor-right",
        PromptInputEvent::Left => "cursor-left",
        PromptInputEvent::Down => "cursor-down",
        PromptInputEvent::Up => "cursor-up",
        PromptInputEvent::Char('q') => "cancel",
        PromptInputEvent::Escape if mode_keys == ModeKeys::Vi => "cancel-or-clear-selection",
        PromptInputEvent::Escape => "cancel",
        PromptInputEvent::KeyName(name) if name == "q" => "cancel",
        _ => return AttachedCopyModeInputAction::Ignore,
    };
    AttachedCopyModeInputAction::Command(command)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn emacs_arrow_keys_route_to_copy_mode_motion_commands() {
        assert_eq!(
            attached_copy_mode_input_action(ModeKeys::Emacs, &PromptInputEvent::Right),
            AttachedCopyModeInputAction::Command("cursor-right")
        );
        assert_eq!(
            attached_copy_mode_input_action(ModeKeys::Emacs, &PromptInputEvent::Left),
            AttachedCopyModeInputAction::Command("cursor-left")
        );
        assert_eq!(
            attached_copy_mode_input_action(ModeKeys::Emacs, &PromptInputEvent::Down),
            AttachedCopyModeInputAction::Command("cursor-down")
        );
        assert_eq!(
            attached_copy_mode_input_action(ModeKeys::Emacs, &PromptInputEvent::Up),
            AttachedCopyModeInputAction::Command("cursor-up")
        );
    }

    #[test]
    fn vi_search_keys_still_start_copy_mode_search() {
        assert_eq!(
            attached_copy_mode_input_action(ModeKeys::Vi, &PromptInputEvent::Char('/')),
            AttachedCopyModeInputAction::Search(AttachedCopyModeSearchDirection::Forward)
        );
        assert_eq!(
            attached_copy_mode_input_action(ModeKeys::Vi, &PromptInputEvent::Char('?')),
            AttachedCopyModeInputAction::Search(AttachedCopyModeSearchDirection::Backward)
        );
    }

    #[test]
    fn vi_search_repeat_keys_route_to_copy_mode_search_commands() {
        assert_eq!(
            attached_copy_mode_input_action(ModeKeys::Vi, &PromptInputEvent::Char('n')),
            AttachedCopyModeInputAction::Command("search-again")
        );
        assert_eq!(
            attached_copy_mode_input_action(ModeKeys::Vi, &PromptInputEvent::Char('N')),
            AttachedCopyModeInputAction::Command("search-reverse")
        );
    }

    #[test]
    fn emacs_search_repeat_keys_remain_unbound_for_this_slice() {
        assert_eq!(
            attached_copy_mode_input_action(ModeKeys::Emacs, &PromptInputEvent::Char('n')),
            AttachedCopyModeInputAction::Ignore
        );
        assert_eq!(
            attached_copy_mode_input_action(ModeKeys::Emacs, &PromptInputEvent::Char('N')),
            AttachedCopyModeInputAction::Ignore
        );
    }

    #[test]
    fn vi_enter_yanks_selection_and_exits_copy_mode() {
        assert_eq!(
            attached_copy_mode_input_action(ModeKeys::Vi, &PromptInputEvent::Enter),
            AttachedCopyModeInputAction::Command("copy-selection-and-cancel")
        );
    }

    #[test]
    fn emacs_enter_keeps_existing_no_clear_copy_binding() {
        assert_eq!(
            attached_copy_mode_input_action(ModeKeys::Emacs, &PromptInputEvent::Enter),
            AttachedCopyModeInputAction::Command("copy-selection-no-clear")
        );
    }

    #[test]
    fn escape_uses_tmux_selection_cancel_semantics() {
        assert_eq!(
            attached_copy_mode_input_action(ModeKeys::Vi, &PromptInputEvent::Escape),
            AttachedCopyModeInputAction::Command("cancel-or-clear-selection")
        );
        assert_eq!(
            attached_copy_mode_input_action(ModeKeys::Emacs, &PromptInputEvent::Escape),
            AttachedCopyModeInputAction::Command("cancel")
        );
    }
}
