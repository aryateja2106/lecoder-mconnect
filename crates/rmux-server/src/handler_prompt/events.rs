use super::{
    ClientPromptState, PromptAction, PromptFinalizeKind, PromptHistoryStore, PromptInputEvent,
    PromptKind, PROMPT_FLAG_BSPACE_EXIT, PROMPT_FLAG_INCREMENTAL, PROMPT_FLAG_KEY,
    PROMPT_FLAG_NUMERIC, PROMPT_FLAG_SINGLE,
};

pub(super) fn process_prompt_event(
    prompt: &mut ClientPromptState,
    event: PromptInputEvent,
    history: &mut PromptHistoryStore,
    separators: &str,
    history_limit: usize,
) -> PromptAction {
    if (prompt.flags & PROMPT_FLAG_KEY) != 0 {
        return event
            .key_string()
            .and_then(|value| prompt.submit_response(value))
            .map(|finalize| PromptAction {
                refresh: true,
                dispatch: None,
                finalize: Some(finalize),
            })
            .unwrap_or_else(PromptAction::none);
    }

    if (prompt.flags & PROMPT_FLAG_NUMERIC) != 0 {
        return match event {
            PromptInputEvent::Char(ch) if ch.is_ascii_digit() => {
                prompt.push_char(ch);
                PromptAction {
                    refresh: true,
                    dispatch: None,
                    finalize: None,
                }
            }
            PromptInputEvent::Backspace if prompt.delete_left() => PromptAction {
                refresh: true,
                dispatch: None,
                finalize: None,
            },
            PromptInputEvent::Escape
            | PromptInputEvent::Ctrl('c')
            | PromptInputEvent::Ctrl('g') => PromptAction {
                refresh: true,
                dispatch: None,
                finalize: Some(PromptFinalizeKind::Cancel),
            },
            _ => PromptAction {
                refresh: true,
                dispatch: None,
                finalize: prompt.submit_response(prompt.buffer_string()),
            },
        };
    }

    if (prompt.flags & PROMPT_FLAG_SINGLE) != 0 {
        let submitted = match event {
            PromptInputEvent::Char(ch) => Some(ch.to_string()),
            PromptInputEvent::Enter => Some("\r".to_owned()),
            PromptInputEvent::Backspace => Some("\u{7f}".to_owned()),
            PromptInputEvent::Ctrl('c')
            | PromptInputEvent::Ctrl('g')
            | PromptInputEvent::Escape => {
                return PromptAction {
                    refresh: true,
                    dispatch: None,
                    finalize: Some(PromptFinalizeKind::Cancel),
                };
            }
            PromptInputEvent::Ctrl(ch) => Some(ctrl_input_string(ch)),
            PromptInputEvent::KeyName(_) => None,
            _ => None,
        };
        let Some(submitted) = submitted else {
            return PromptAction::none();
        };

        prompt.buffer = submitted.clone();
        prompt.cursor = prompt.buffer.chars().count();
        let finalize = match &prompt.kind {
            PromptKind::Confirm {
                confirm_key,
                default_yes,
                ..
            } => PromptFinalizeKind::Confirm {
                accepted: submitted_has_char(&submitted, *confirm_key)
                    || (*default_yes && submitted_has_char(&submitted, '\r')),
            },
            PromptKind::Command { .. } => prompt
                .submit_response(submitted)
                .unwrap_or(PromptFinalizeKind::Cancel),
        };
        return PromptAction {
            refresh: true,
            dispatch: None,
            finalize: Some(finalize),
        };
    }

    let mut action = PromptAction::none();
    match event {
        PromptInputEvent::Char(ch) => {
            prompt.push_char(ch);
            action.refresh = true;
        }
        PromptInputEvent::Enter => {
            if !prompt.buffer.is_empty() {
                history.push(prompt.prompt_type, &prompt.buffer, history_limit);
            }
            if (prompt.flags & PROMPT_FLAG_INCREMENTAL) != 0 {
                action.refresh = true;
                action.finalize = Some(PromptFinalizeKind::Cancel);
                return action;
            }

            let response = prompt.buffer_string();
            action.refresh = true;
            action.finalize = match &prompt.kind {
                PromptKind::Confirm {
                    confirm_key,
                    default_yes,
                    ..
                } => Some(PromptFinalizeKind::Confirm {
                    accepted: submitted_has_char(&response, *confirm_key)
                        || (*default_yes && response.is_empty()),
                }),
                PromptKind::Command { .. } => prompt.submit_response(response),
            };
        }
        PromptInputEvent::Escape | PromptInputEvent::Ctrl('c') | PromptInputEvent::Ctrl('g') => {
            action.refresh = true;
            action.finalize = Some(PromptFinalizeKind::Cancel);
        }
        PromptInputEvent::Tab => {}
        PromptInputEvent::Backspace => {
            if prompt.buffer.is_empty() && (prompt.flags & PROMPT_FLAG_BSPACE_EXIT) != 0 {
                action.refresh = true;
                action.finalize = Some(PromptFinalizeKind::Cancel);
            } else if prompt.delete_left() {
                action.refresh = true;
            }
        }
        PromptInputEvent::Delete => {
            if prompt.delete_at_cursor() {
                action.refresh = true;
            }
        }
        PromptInputEvent::Left | PromptInputEvent::Ctrl('b') => {
            action.refresh = prompt.move_left();
        }
        PromptInputEvent::Right | PromptInputEvent::Ctrl('f') => {
            action.refresh = prompt.move_right();
        }
        PromptInputEvent::Home | PromptInputEvent::Ctrl('a') => {
            action.refresh = prompt.move_home();
        }
        PromptInputEvent::End | PromptInputEvent::Ctrl('e') => {
            action.refresh = prompt.move_end();
        }
        PromptInputEvent::Up | PromptInputEvent::Ctrl('p') => {
            if prompt.history_index == 0 {
                prompt.pre_history_buffer = Some(prompt.buffer.clone());
            }
            if let Some(history_value) = history.up(prompt.prompt_type, &mut prompt.history_index) {
                prompt.set_history(history_value);
                action.refresh = true;
            }
        }
        PromptInputEvent::Down | PromptInputEvent::Ctrl('n') => {
            if let Some(history_value) = history.down(prompt.prompt_type, &mut prompt.history_index)
            {
                if prompt.history_index == 0 {
                    let restored = prompt.pre_history_buffer.take().unwrap_or(history_value);
                    prompt.set_history(restored);
                } else {
                    prompt.set_history(history_value);
                }
                action.refresh = true;
            }
        }
        PromptInputEvent::Ctrl('u') => {
            action.refresh = prompt.clear_buffer();
        }
        PromptInputEvent::Ctrl('k') => {
            action.refresh = prompt.delete_to_end();
        }
        PromptInputEvent::Ctrl('w') => {
            action.refresh = prompt.delete_word_left(separators);
        }
        PromptInputEvent::Ctrl('y') => {
            action.refresh = prompt.paste_saved();
        }
        PromptInputEvent::Ctrl('r') | PromptInputEvent::Ctrl('s')
            if (prompt.flags & PROMPT_FLAG_INCREMENTAL) != 0 =>
        {
            let prefix = if prompt.buffer.is_empty() {
                '='
            } else if matches!(event, PromptInputEvent::Ctrl('r')) {
                '-'
            } else {
                '+'
            };
            if prompt.buffer.is_empty() && !prompt.last_input.is_empty() {
                prompt.buffer = prompt.last_input.clone();
                prompt.cursor = prompt.buffer.chars().count();
                action.refresh = true;
            }
            let mut value = String::new();
            value.push(prefix);
            value.push_str(&prompt.buffer);
            action.dispatch = prompt.current_command_dispatch(vec![value]);
        }
        PromptInputEvent::Ctrl(_) | PromptInputEvent::KeyName(_) => {}
    }

    if (prompt.flags & PROMPT_FLAG_INCREMENTAL) != 0
        && action.refresh
        && action.finalize.is_none()
        && action.dispatch.is_none()
    {
        action.dispatch = prompt.current_command_dispatch(vec![format!("={}", prompt.buffer)]);
    }

    action
}

fn ctrl_input_string(ch: char) -> String {
    let value = char::from((ch as u8) & 0x1f);
    value.to_string()
}

fn submitted_has_char(value: &str, ch: char) -> bool {
    value.chars().next().is_some_and(|current| current == ch)
}

#[cfg(test)]
#[path = "events/tests.rs"]
mod tests;
