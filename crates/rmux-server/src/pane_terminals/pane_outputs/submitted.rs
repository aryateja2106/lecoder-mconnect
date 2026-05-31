use std::collections::HashMap;

use rmux_core::PaneId;
use rmux_proto::{PaneTarget, RmuxError, SessionName};

use crate::pane_terminal_lookup::pane_id_for_target;

use super::super::HandlerState;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(in crate::pane_terminals) struct AttachedSubmittedLine {
    absolute_y: usize,
    text: String,
}

impl HandlerState {
    pub(crate) fn record_attached_submitted_text(
        &mut self,
        target: &PaneTarget,
        bytes: &[u8],
    ) -> Result<(), RmuxError> {
        let runtime_session_name =
            self.runtime_session_name_for_window(target.session_name(), target.window_index());
        let pane_id = pane_id_for_target(
            &self.sessions,
            target.session_name(),
            target.window_index(),
            target.pane_index(),
        )?;
        let text = String::from_utf8_lossy(bytes).into_owned();
        if text.is_empty() {
            self.clear_attached_submitted_line(&runtime_session_name, pane_id);
            return Ok(());
        }

        let Some(transcript) = self
            .transcripts
            .get(&runtime_session_name)
            .and_then(|panes| panes.get(&pane_id))
            .cloned()
        else {
            return Ok(());
        };
        let absolute_y = transcript
            .lock()
            .expect("pane transcript mutex must not be poisoned")
            .clone_screen()
            .cursor_absolute_y();
        self.attached_submitted_rows
            .entry(runtime_session_name)
            .or_default()
            .insert(pane_id, AttachedSubmittedLine { absolute_y, text });
        Ok(())
    }

    pub(crate) fn strip_attached_submitted_line(
        &mut self,
        runtime_session_name: &SessionName,
        pane_id: PaneId,
    ) -> Result<bool, RmuxError> {
        let Some(submitted_line) = self
            .attached_submitted_rows
            .get(runtime_session_name)
            .and_then(|panes| panes.get(&pane_id))
            .cloned()
        else {
            return Ok(false);
        };
        let Some(transcript) = self
            .transcripts
            .get(runtime_session_name)
            .and_then(|panes| panes.get(&pane_id))
            .cloned()
        else {
            self.clear_attached_submitted_line(runtime_session_name, pane_id);
            return Ok(false);
        };
        let removed = transcript
            .lock()
            .expect("pane transcript mutex must not be poisoned")
            .delete_attached_submitted_line(submitted_line.absolute_y, &submitted_line.text);
        if removed {
            self.clear_attached_submitted_line(runtime_session_name, pane_id);
        }
        Ok(removed)
    }

    pub(in crate::pane_terminals) fn clear_attached_submitted_line(
        &mut self,
        session_name: &SessionName,
        pane_id: PaneId,
    ) {
        if let Some(panes) = self.attached_submitted_rows.get_mut(session_name) {
            let _ = panes.remove(&pane_id);
            if panes.is_empty() {
                let _ = self.attached_submitted_rows.remove(session_name);
            }
        }
    }

    pub(super) fn take_attached_submitted_line(
        &mut self,
        session_name: &SessionName,
        pane_id: PaneId,
    ) -> Option<AttachedSubmittedLine> {
        let submitted_line = self
            .attached_submitted_rows
            .get_mut(session_name)
            .and_then(|panes| panes.remove(&pane_id));
        if self
            .attached_submitted_rows
            .get(session_name)
            .is_some_and(HashMap::is_empty)
        {
            let _ = self.attached_submitted_rows.remove(session_name);
        }
        submitted_line
    }
}

#[cfg(test)]
mod tests {
    use rmux_core::{GridRenderOptions, PaneId, ScreenCaptureRange};
    use rmux_proto::{SessionName, TerminalSize};

    use super::{AttachedSubmittedLine, HandlerState};
    use crate::pane_transcript::PaneTranscript;

    #[test]
    fn strip_attached_submitted_line_retries_until_echo_is_visible() {
        let session_name = SessionName::new("alpha").expect("valid session");
        let pane_id = PaneId::new(1);
        let transcript = PaneTranscript::shared(2_000, TerminalSize { cols: 80, rows: 24 });
        let mut state = HandlerState::default();
        state
            .transcripts
            .entry(session_name.clone())
            .or_default()
            .insert(pane_id, transcript.clone());
        state
            .attached_submitted_rows
            .entry(session_name.clone())
            .or_default()
            .insert(
                pane_id,
                AttachedSubmittedLine {
                    absolute_y: 0,
                    text: "exit".to_owned(),
                },
            );

        assert!(!state
            .strip_attached_submitted_line(&session_name, pane_id)
            .expect("strip before echo"));
        assert!(state
            .attached_submitted_rows
            .get(&session_name)
            .is_some_and(|panes| panes.contains_key(&pane_id)));

        transcript
            .lock()
            .expect("pane transcript mutex must not be poisoned")
            .append_bytes(b"PROMPT> exit\r\n");

        assert!(state
            .strip_attached_submitted_line(&session_name, pane_id)
            .expect("strip after echo"));
        assert!(!state
            .attached_submitted_rows
            .get(&session_name)
            .is_some_and(|panes| panes.contains_key(&pane_id)));
        let capture = transcript
            .lock()
            .expect("pane transcript mutex must not be poisoned")
            .capture_main(ScreenCaptureRange::default(), GridRenderOptions::default());
        assert!(
            !String::from_utf8_lossy(&capture).contains("PROMPT> exit"),
            "submitted line should be removed from transcript"
        );
    }
}
