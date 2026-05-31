use rmux_proto::PaneTarget;

use super::RequestHandler;

/// Probes the bytes rmux writes toward a pane.
///
/// This is intentionally a server-side test spy. The attached-input tests assert
/// RMUX's encoded write contract; shell redirection would add unrelated PTY and
/// prompt-readiness races to those assertions.
pub(in crate::handler) struct RawPaneInputProbe {
    target: PaneTarget,
}

impl RawPaneInputProbe {
    pub(in crate::handler) async fn start(
        handler: &RequestHandler,
        session_name: &rmux_proto::SessionName,
        label: &str,
        expected_len: usize,
    ) -> Self {
        let _ = (label, expected_len);
        let target = PaneTarget::new(session_name.clone(), 0);
        let state = handler.state.lock().await;
        state.start_pane_input_capture_for_test(&target);
        Self { target }
    }

    pub(in crate::handler) async fn finish(
        &self,
        handler: &RequestHandler,
        session_name: &rmux_proto::SessionName,
    ) {
        let _ = (handler, session_name);
    }

    pub(in crate::handler) async fn assert_contents(
        self,
        handler: &RequestHandler,
        expected: &[u8],
    ) {
        let state = handler.state.lock().await;
        assert_eq!(
            state.pane_input_capture_for_test(&self.target),
            Some(expected.to_vec())
        );
    }
}
