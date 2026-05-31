use rmux_core::{key_string_lookup_key, KeyCode, KEYC_MASK_KEY};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(in super::super) enum PromptInputEvent {
    Char(char),
    Enter,
    Escape,
    Tab,
    Backspace,
    Delete,
    Left,
    Right,
    Up,
    Down,
    Home,
    End,
    Ctrl(char),
    KeyName(String),
}

impl PromptInputEvent {
    pub(super) fn key_string(&self) -> Option<String> {
        match self {
            Self::Char(ch) => Some(ch.to_string()),
            Self::Enter => Some("Enter".to_owned()),
            Self::Escape => Some("Escape".to_owned()),
            Self::Tab => Some("Tab".to_owned()),
            Self::Backspace => Some("BSpace".to_owned()),
            Self::Delete => Some("DC".to_owned()),
            Self::Left => Some("Left".to_owned()),
            Self::Right => Some("Right".to_owned()),
            Self::Up => Some("Up".to_owned()),
            Self::Down => Some("Down".to_owned()),
            Self::Home => Some("Home".to_owned()),
            Self::End => Some("End".to_owned()),
            Self::Ctrl(ch) => Some(format!("C-{ch}")),
            Self::KeyName(name) => Some(name.clone()),
        }
    }
}

pub(in super::super) fn decode_prompt_key(key: KeyCode) -> PromptInputEvent {
    let name = key_string_lookup_key(key & KEYC_MASK_KEY, false).to_owned();
    match name.as_str() {
        "Left" => PromptInputEvent::Left,
        "Right" => PromptInputEvent::Right,
        "Up" => PromptInputEvent::Up,
        "Down" => PromptInputEvent::Down,
        "Home" => PromptInputEvent::Home,
        "End" => PromptInputEvent::End,
        "DC" => PromptInputEvent::Delete,
        "Enter" => PromptInputEvent::Enter,
        "BSpace" => PromptInputEvent::Backspace,
        "Escape" => PromptInputEvent::Escape,
        _ => PromptInputEvent::KeyName(name),
    }
}
