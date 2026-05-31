//! Session construction helpers, including fork lineage.

use lecoder_proto::SessionState;
use lecoder_store::SessionRecord;

use crate::id::SessionId;

/// Build a fresh root session record.
pub fn new_session(id: &SessionId, name: Option<String>, now_ms: f64) -> SessionRecord {
    SessionRecord {
        id: id.to_string(),
        name,
        state: SessionState::Active,
        created_at: now_ms,
        last_activity: now_ms,
        parent_session_id: None,
        forked_from_line: None,
    }
}

/// Fork a child session from `parent` at scrollback line `from_line`.
///
/// The child is a brand-new active session whose lineage points back at the parent — the
/// basis for Claude-Code-style resume/branch. Copying the parent's scrollback up to
/// `from_line` is the caller's (store-level) responsibility.
pub fn fork_session(
    parent: &SessionRecord,
    child_id: &SessionId,
    from_line: u64,
    now_ms: f64,
) -> SessionRecord {
    SessionRecord {
        id: child_id.to_string(),
        name: parent.name.as_ref().map(|n| format!("{n} (fork)")),
        state: SessionState::Active,
        created_at: now_ms,
        last_activity: now_ms,
        parent_session_id: Some(parent.id.clone()),
        forked_from_line: Some(from_line),
    }
}
