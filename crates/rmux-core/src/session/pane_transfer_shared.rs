use super::target_error::invalid_window_target_with_reason;
use super::{PaneSwapOptions, Session};
use crate::{Pane, Window};
use rmux_proto::RmuxError;

pub(super) fn validate_swap_destination(
    destination_window: &Window,
    incoming_pane: &Pane,
    replaced_pane_index: u32,
) -> Result<(), RmuxError> {
    let replaced_position = destination_window
        .pane_position(replaced_pane_index)
        .expect("validated replaced pane must exist");
    destination_window.ensure_accepts_pane(incoming_pane, Some(replaced_position))
}

pub(super) fn apply_swap_between_windows(
    source_window: &mut Window,
    source: SwapPaneEntry,
    target_window: &mut Window,
    target: SwapPaneEntry,
    options: PaneSwapOptions,
) -> Result<(), RmuxError> {
    let source_active_before = source_window.active_pane_index();
    let target_active_before = target_window.active_pane_index();
    source_window.push_zoom(options.preserve_zoom);
    target_window.push_zoom(options.preserve_zoom);
    source_window.replace_pane(source.index, target.pane)?;
    target_window.replace_pane(target.index, source.pane)?;

    if !options.detached || source_active_before == source.index {
        source_window.select_pane(target.index);
    }
    if !options.detached || target_active_before == target.index {
        target_window.select_pane(source.index);
    }

    source_window.clear_last_pane_reference(source.index);
    target_window.clear_last_pane_reference(target.index);
    source_window.recalculate_geometry();
    target_window.recalculate_geometry();
    source_window.pop_zoom();
    target_window.pop_zoom();
    Ok(())
}

pub(super) struct SwapPaneEntry {
    pub(super) index: u32,
    pub(super) pane: Pane,
}

pub(super) const fn adjusted_insert_position(
    source_position: usize,
    target_position: usize,
) -> usize {
    if source_position < target_position {
        target_position
    } else {
        target_position + 1
    }
}

pub(super) const fn adjusted_insert_position_before(
    source_position: usize,
    target_position: usize,
) -> usize {
    if source_position < target_position {
        target_position.saturating_sub(1)
    } else {
        target_position
    }
}

pub(super) fn resolve_break_destination_index(
    session: &Session,
    target_window_index: Option<u32>,
    allowed_occupied_index: Option<u32>,
) -> Result<u32, RmuxError> {
    match target_window_index {
        Some(target_window_index) => {
            if session.window_at(target_window_index).is_some()
                && allowed_occupied_index != Some(target_window_index)
            {
                return Err(invalid_window_target_with_reason(
                    session.name(),
                    target_window_index,
                    "window index already exists in session",
                ));
            }

            Ok(target_window_index)
        }
        None => session.lowest_available_window_index_at_or_above(0),
    }
}
