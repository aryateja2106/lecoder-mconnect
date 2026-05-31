//! Optional conversions between SDK and `crossterm` key vocabularies.
//!
//! The conversion is intentionally lossy in the SDK direction: keys
//! that the SDK has no canonical variant for surface as
//! [`super::KeyConversionError::UnsupportedKeyCode`] rather than
//! silently mapping to an unrelated SDK variant.

use super::{KeyCode, KeyConversionError, KeyEvent, KeyModifiers};
use crossterm::event::{
    KeyCode as CtKeyCode, KeyEvent as CtKeyEvent, KeyEventKind as CtKeyEventKind,
    KeyModifiers as CtKeyModifiers,
};

impl From<KeyModifiers> for CtKeyModifiers {
    fn from(value: KeyModifiers) -> Self {
        let mut out = CtKeyModifiers::NONE;
        if value.contains(KeyModifiers::SHIFT) {
            out |= CtKeyModifiers::SHIFT;
        }
        if value.contains(KeyModifiers::CONTROL) {
            out |= CtKeyModifiers::CONTROL;
        }
        if value.contains(KeyModifiers::ALT) {
            out |= CtKeyModifiers::ALT;
        }
        if value.contains(KeyModifiers::SUPER) {
            out |= CtKeyModifiers::SUPER;
        }
        if value.contains(KeyModifiers::HYPER) {
            out |= CtKeyModifiers::HYPER;
        }
        if value.contains(KeyModifiers::META) {
            out |= CtKeyModifiers::META;
        }
        out
    }
}

impl From<CtKeyModifiers> for KeyModifiers {
    fn from(value: CtKeyModifiers) -> Self {
        let mut out = KeyModifiers::NONE;
        if value.contains(CtKeyModifiers::SHIFT) {
            out = out | KeyModifiers::SHIFT;
        }
        if value.contains(CtKeyModifiers::CONTROL) {
            out = out | KeyModifiers::CONTROL;
        }
        if value.contains(CtKeyModifiers::ALT) {
            out = out | KeyModifiers::ALT;
        }
        if value.contains(CtKeyModifiers::SUPER) {
            out = out | KeyModifiers::SUPER;
        }
        if value.contains(CtKeyModifiers::HYPER) {
            out = out | KeyModifiers::HYPER;
        }
        if value.contains(CtKeyModifiers::META) {
            out = out | KeyModifiers::META;
        }
        out
    }
}

impl From<KeyCode> for CtKeyCode {
    fn from(value: KeyCode) -> Self {
        match value {
            KeyCode::Char(ch) => CtKeyCode::Char(ch),
            KeyCode::F(n) => CtKeyCode::F(n),
            KeyCode::Backspace => CtKeyCode::Backspace,
            KeyCode::Enter => CtKeyCode::Enter,
            KeyCode::Left => CtKeyCode::Left,
            KeyCode::Right => CtKeyCode::Right,
            KeyCode::Up => CtKeyCode::Up,
            KeyCode::Down => CtKeyCode::Down,
            KeyCode::Home => CtKeyCode::Home,
            KeyCode::End => CtKeyCode::End,
            KeyCode::PageUp => CtKeyCode::PageUp,
            KeyCode::PageDown => CtKeyCode::PageDown,
            KeyCode::Tab => CtKeyCode::Tab,
            KeyCode::BackTab => CtKeyCode::BackTab,
            KeyCode::Delete => CtKeyCode::Delete,
            KeyCode::Insert => CtKeyCode::Insert,
            KeyCode::Esc => CtKeyCode::Esc,
        }
    }
}

impl TryFrom<CtKeyCode> for KeyCode {
    type Error = KeyConversionError;

    fn try_from(value: CtKeyCode) -> Result<Self, Self::Error> {
        match value {
            CtKeyCode::Char(ch) => Ok(KeyCode::Char(ch)),
            CtKeyCode::F(n) => Ok(KeyCode::F(n)),
            CtKeyCode::Backspace => Ok(KeyCode::Backspace),
            CtKeyCode::Enter => Ok(KeyCode::Enter),
            CtKeyCode::Left => Ok(KeyCode::Left),
            CtKeyCode::Right => Ok(KeyCode::Right),
            CtKeyCode::Up => Ok(KeyCode::Up),
            CtKeyCode::Down => Ok(KeyCode::Down),
            CtKeyCode::Home => Ok(KeyCode::Home),
            CtKeyCode::End => Ok(KeyCode::End),
            CtKeyCode::PageUp => Ok(KeyCode::PageUp),
            CtKeyCode::PageDown => Ok(KeyCode::PageDown),
            CtKeyCode::Tab => Ok(KeyCode::Tab),
            CtKeyCode::BackTab => Ok(KeyCode::BackTab),
            CtKeyCode::Delete => Ok(KeyCode::Delete),
            CtKeyCode::Insert => Ok(KeyCode::Insert),
            CtKeyCode::Esc => Ok(KeyCode::Esc),
            CtKeyCode::Null => Err(KeyConversionError::UnsupportedKeyCode("Null")),
            CtKeyCode::CapsLock => Err(KeyConversionError::UnsupportedKeyCode("CapsLock")),
            CtKeyCode::ScrollLock => Err(KeyConversionError::UnsupportedKeyCode("ScrollLock")),
            CtKeyCode::NumLock => Err(KeyConversionError::UnsupportedKeyCode("NumLock")),
            CtKeyCode::PrintScreen => Err(KeyConversionError::UnsupportedKeyCode("PrintScreen")),
            CtKeyCode::Pause => Err(KeyConversionError::UnsupportedKeyCode("Pause")),
            CtKeyCode::Menu => Err(KeyConversionError::UnsupportedKeyCode("Menu")),
            CtKeyCode::KeypadBegin => Err(KeyConversionError::UnsupportedKeyCode("KeypadBegin")),
            CtKeyCode::Media(_) => Err(KeyConversionError::UnsupportedKeyCode("Media")),
            CtKeyCode::Modifier(_) => Err(KeyConversionError::UnsupportedKeyCode("Modifier")),
        }
    }
}

impl TryFrom<CtKeyEvent> for KeyEvent {
    type Error = KeyConversionError;

    fn try_from(value: CtKeyEvent) -> Result<Self, Self::Error> {
        if !matches!(value.kind, CtKeyEventKind::Press) {
            return Err(KeyConversionError::NonPressEvent);
        }
        Ok(KeyEvent {
            code: KeyCode::try_from(value.code)?,
            modifiers: KeyModifiers::from(value.modifiers),
        })
    }
}

impl From<KeyEvent> for CtKeyEvent {
    fn from(value: KeyEvent) -> Self {
        CtKeyEvent::new(value.code.into(), value.modifiers.into())
    }
}
