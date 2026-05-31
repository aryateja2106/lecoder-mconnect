use rmux_proto::{Request, ResolveTargetRequest, ResolveTargetType, Response};

use crate::{connection::Connection, ClientError};

impl Connection {
    /// Resolves tmux-style raw target text against live server state.
    pub fn resolve_target(
        &mut self,
        target: Option<String>,
        target_type: ResolveTargetType,
        window_index: bool,
        prefer_unattached: bool,
    ) -> Result<Response, ClientError> {
        self.roundtrip(&Request::ResolveTarget(ResolveTargetRequest {
            target,
            target_type,
            window_index,
            prefer_unattached,
        }))
    }
}
