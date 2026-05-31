use rmux_core::{KillPaneOutcome, PaneGeometry, Session, SessionStore};
use rmux_proto::{PaneTarget, RmuxError, SessionName, SplitDirection, SplitWindowTarget};

use super::super::session_not_found;

pub(super) fn preview_split(
    sessions: &SessionStore,
    target: &SplitWindowTarget,
    direction: SplitDirection,
    before: bool,
) -> Result<(u32, u32, PaneGeometry), RmuxError> {
    let session_name = split_window_session_name(target);
    let mut session = sessions
        .session(session_name)
        .ok_or_else(|| session_not_found(session_name))?
        .clone();
    let window_index = split_window_target_window_index(&session, target);
    let pane_index = match target {
        SplitWindowTarget::Session(_) => session.active_pane_index(),
        SplitWindowTarget::Pane(target) => target.pane_index(),
    };
    let new_pane_index = session.split_pane_in_window_with_direction_before(
        window_index,
        pane_index,
        direction,
        before,
    )?;
    let geometry = session
        .window_at(window_index)
        .expect("split preview target window must exist")
        .pane(new_pane_index)
        .map(|pane| pane.geometry())
        .ok_or_else(|| {
            RmuxError::Server(format!(
                "new pane geometry missing for {}:{window_index}.{new_pane_index}",
                session_name,
            ))
        })?;

    Ok((window_index, new_pane_index, geometry))
}

pub(super) fn preview_kill_pane(
    sessions: &SessionStore,
    target: &PaneTarget,
    kill_all_except: bool,
) -> Result<KillPaneOutcome, RmuxError> {
    let mut session = sessions
        .session(target.session_name())
        .ok_or_else(|| session_not_found(target.session_name()))?
        .clone();

    if kill_all_except {
        session.kill_other_panes_in_window(target.window_index(), target.pane_index())
    } else {
        session.kill_pane_in_window(target.window_index(), target.pane_index())
    }
}

pub(super) fn split_window_session_name(target: &SplitWindowTarget) -> &SessionName {
    match target {
        SplitWindowTarget::Session(session_name) => session_name,
        SplitWindowTarget::Pane(target) => target.session_name(),
    }
}

fn split_window_target_window_index(session: &Session, target: &SplitWindowTarget) -> u32 {
    match target {
        SplitWindowTarget::Session(_) => session.active_window_index(),
        SplitWindowTarget::Pane(target) => target.window_index(),
    }
}

pub(super) fn split_window_internal_direction(direction: SplitDirection) -> SplitDirection {
    match direction {
        SplitDirection::Horizontal => SplitDirection::Vertical,
        SplitDirection::Vertical => SplitDirection::Horizontal,
    }
}
