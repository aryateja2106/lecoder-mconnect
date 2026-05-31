//! Resumable / forkable session identifiers.
//!
//! IDs are time-sortable and collision-free: a fixed-width hex encoding of a millisecond
//! timestamp prefix plus a monotonic per-generator counter, so lexicographic order matches
//! creation order and they grep cleanly in `~/.lecoder/sessions/`. The timestamp is passed
//! in (never read from the wall clock here) so generation stays deterministic and testable.

use std::sync::atomic::{AtomicU32, Ordering};

static GLOBAL_SEQ: AtomicU32 = AtomicU32::new(0);

/// A stable session identifier (resume by string equality; fork links via the record).
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct SessionId(String);

impl SessionId {
    /// Wrap an existing id string (e.g. read back from disk for resume).
    pub fn from_string(s: impl Into<String>) -> Self {
        Self(s.into())
    }

    /// The id as a string slice.
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for SessionId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl From<SessionId> for String {
    fn from(id: SessionId) -> String {
        id.0
    }
}

/// Generates time-sortable, unique session ids.
#[derive(Debug, Default)]
pub struct SessionIdGen;

impl SessionIdGen {
    /// Create a fresh generator.
    pub fn new() -> Self {
        Self::default()
    }

    /// Produce the next id for the given timestamp (epoch milliseconds).
    ///
    /// Format: `{ms:013x}-{pid:08x}-{seq:08x}`. The 13-hex-digit ms prefix is sortable through
    /// the year ~10889; the process id and global counter avoid collisions across fresh
    /// generators and practical daemon restarts in the same millisecond.
    pub fn next(&self, now_ms: u64) -> SessionId {
        let pid = std::process::id();
        let seq = GLOBAL_SEQ.fetch_add(1, Ordering::Relaxed);
        SessionId(format!("{now_ms:013x}-{pid:08x}-{seq:08x}"))
    }
}
