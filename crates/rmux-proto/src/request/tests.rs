use super::SetOptionRequest;
use crate::{OptionName, RmuxError, ScopeSelector, SessionName, SetOptionMode};

#[test]
fn set_option_rejects_append_for_non_terminal_features() {
    let request = SetOptionRequest {
        scope: ScopeSelector::Global,
        option: OptionName::Status,
        value: "off".to_owned(),
        mode: SetOptionMode::Append,
    };

    assert_eq!(
        request.validate(),
        Err(RmuxError::InvalidSetOption(
            "status is not an array option".to_owned()
        ))
    );
}

#[test]
fn set_option_rejects_session_scoped_default_terminal() {
    let request = SetOptionRequest {
        scope: ScopeSelector::Session(SessionName::new("alpha").expect("valid session name")),
        option: OptionName::DefaultTerminal,
        value: "tmux-256color".to_owned(),
        mode: SetOptionMode::Replace,
    };

    assert_eq!(
        request.validate(),
        Err(RmuxError::InvalidSetOption(
            "default-terminal is only supported at global scope".to_owned()
        ))
    );
}

#[test]
fn set_option_rejects_session_scoped_terminal_features() {
    let request = SetOptionRequest {
        scope: ScopeSelector::Session(SessionName::new("alpha").expect("valid session name")),
        option: OptionName::TerminalFeatures,
        value: "xterm".to_owned(),
        mode: SetOptionMode::Replace,
    };

    assert_eq!(
        request.validate(),
        Err(RmuxError::InvalidSetOption(
            "terminal-features is only supported at global scope".to_owned()
        ))
    );
}

#[test]
fn set_option_accepts_global_terminal_features_append() {
    let request = SetOptionRequest {
        scope: ScopeSelector::Global,
        option: OptionName::TerminalFeatures,
        value: "xterm".to_owned(),
        mode: SetOptionMode::Append,
    };

    assert_eq!(request.validate(), Ok(()));
}

#[test]
fn set_option_accepts_global_default_terminal_replace() {
    let request = SetOptionRequest {
        scope: ScopeSelector::Global,
        option: OptionName::DefaultTerminal,
        value: "tmux-256color".to_owned(),
        mode: SetOptionMode::Replace,
    };

    assert_eq!(request.validate(), Ok(()));
}
