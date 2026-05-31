use rmux_proto::{PaneTarget, RmuxError, SessionName, WindowTarget};

pub(super) fn invalid_window_target(session_name: &SessionName, window_index: u32) -> RmuxError {
    invalid_window_target_with_reason(
        session_name,
        window_index,
        "window index does not exist in session",
    )
}

pub(super) fn invalid_window_target_with_reason(
    session_name: &SessionName,
    window_index: u32,
    reason: &str,
) -> RmuxError {
    RmuxError::invalid_target(
        WindowTarget::with_window(session_name.clone(), window_index).to_string(),
        reason,
    )
}

pub(super) fn invalid_pane_target(
    session_name: &SessionName,
    window_index: u32,
    pane_index: u32,
    reason: &str,
) -> RmuxError {
    RmuxError::invalid_target(
        PaneTarget::with_window(session_name.clone(), window_index, pane_index).to_string(),
        reason,
    )
}
