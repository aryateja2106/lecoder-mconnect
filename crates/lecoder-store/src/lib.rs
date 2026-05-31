//! Filesystem-for-everything state for LeCoder MConnect.
//!
//! Holds the durable session registry, agent metadata, and scrollback under a root
//! directory (default `~/.lecoder`, overridable for tests). All records are plain files
//! (JSON / JSONL) so they are git-friendly, inspectable, crash-safe (append-only), and
//! CRDT-portable later. No rmux dependency; no wall-clock reads (timestamps are passed in).
//!
//! NOTE: records are stored as JSON for now (dependency-lean / offline-safe). The plan
//! calls for TOML for `session.*`; switching the serializer later is a localized change.
#![forbid(unsafe_code)]

use std::path::{Component, Path, PathBuf};

use lecoder_proto::{AgentStatus, SessionState};
use serde::{Deserialize, Serialize};

pub mod scrollback;
pub use scrollback::{ScrollbackLog, ScrollbackSlice};

/// Durable session record (one per session dir).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SessionRecord {
    /// Stable session id (ULID/UUID string).
    pub id: String,
    /// Optional human-friendly name.
    #[serde(default)]
    pub name: Option<String>,
    /// Lifecycle state.
    pub state: SessionState,
    /// Creation time (epoch ms), supplied by the caller.
    pub created_at: f64,
    /// Last-activity time (epoch ms), supplied by the caller.
    pub last_activity: f64,
    /// Parent session id, if this session was forked.
    #[serde(default)]
    pub parent_session_id: Option<String>,
    /// Parent scrollback line this session forked from, if forked.
    #[serde(default)]
    pub forked_from_line: Option<u64>,
}

/// Durable agent record (appended to the session's `agents.jsonl`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AgentRecord {
    /// Stable agent id.
    pub id: String,
    /// Preset the agent was created from.
    pub preset: String,
    /// Current status.
    pub status: AgentStatus,
    /// rmux session name backing this agent.
    pub rmux_session_name: String,
    /// OS process id, if known.
    #[serde(default)]
    pub pid: Option<u32>,
    /// Process exit code, once exited.
    #[serde(default)]
    pub exit_code: Option<i32>,
}

/// Root handle over the on-disk state tree.
#[derive(Debug, Clone)]
pub struct Store {
    root: PathBuf,
}

impl Store {
    /// Open (or implicitly create on first write) a store rooted at `root`.
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    /// The root directory.
    pub fn root(&self) -> &Path {
        &self.root
    }

    fn session_dir(&self, id: &str) -> std::io::Result<PathBuf> {
        validate_session_id(id)?;
        Ok(self.root.join("sessions").join(id))
    }

    fn session_file(&self, id: &str) -> std::io::Result<PathBuf> {
        Ok(self.session_dir(id)?.join("session.json"))
    }

    fn agents_file(&self, id: &str) -> std::io::Result<PathBuf> {
        Ok(self.session_dir(id)?.join("agents.jsonl"))
    }

    fn scrollback_file(&self, id: &str) -> std::io::Result<PathBuf> {
        Ok(self.session_dir(id)?.join("scrollback.jsonl"))
    }

    /// Write (create or overwrite) a session record atomically.
    pub fn write_session(&self, rec: &SessionRecord) -> std::io::Result<()> {
        let bytes = serde_json::to_vec_pretty(rec).map_err(json_io)?;
        atomic_write(&self.session_file(&rec.id)?, &bytes)
    }

    /// Read a session record by id.
    pub fn read_session(&self, id: &str) -> std::io::Result<SessionRecord> {
        let bytes = std::fs::read(self.session_file(id)?)?;
        serde_json::from_slice(&bytes).map_err(json_io)
    }

    /// Scan all session records, skipping any that are missing or corrupt.
    ///
    /// Corruption tolerance: a garbage `session.json` is logged-and-skipped, never fatal —
    /// the registry must survive a partially-written crash.
    pub fn scan_sessions(&self) -> Vec<SessionRecord> {
        let sessions_dir = self.root.join("sessions");
        let Ok(entries) = std::fs::read_dir(&sessions_dir) else {
            return Vec::new();
        };
        let mut out = Vec::new();
        for entry in entries.flatten() {
            if !entry.path().is_dir() {
                continue; // ignore stray files like .DS_Store
            }
            let file = entry.path().join("session.json");
            let Ok(bytes) = std::fs::read(&file) else { continue };
            match serde_json::from_slice::<SessionRecord>(&bytes) {
                Ok(rec) => out.push(rec),
                Err(_) => continue, // skip corrupt entry, not fatal
            }
        }
        out
    }

    /// Append an agent record to the session's agent log.
    pub fn append_agent(&self, session_id: &str, rec: &AgentRecord) -> std::io::Result<()> {
        let path = self.agents_file(session_id)?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut line = serde_json::to_string(rec).map_err(json_io)?;
        line.push('\n');
        append_bytes(&path, line.as_bytes())
    }

    /// Read all agent records for a session (last write wins per id), skipping corrupt lines.
    pub fn read_agents(&self, session_id: &str) -> Vec<AgentRecord> {
        let Ok(path) = self.agents_file(session_id) else {
            return Vec::new();
        };
        let Ok(content) = std::fs::read_to_string(path) else {
            return Vec::new();
        };
        let mut by_id: Vec<AgentRecord> = Vec::new();
        for line in content.lines().filter(|l| !l.trim().is_empty()) {
            if let Ok(rec) = serde_json::from_str::<AgentRecord>(line) {
                if let Some(existing) = by_id.iter_mut().find(|r| r.id == rec.id) {
                    *existing = rec;
                } else {
                    by_id.push(rec);
                }
            }
        }
        by_id
    }

    /// Persist a scrollback log for a session.
    pub fn save_scrollback(&self, session_id: &str, log: &ScrollbackLog) -> std::io::Result<()> {
        log.save(&self.scrollback_file(session_id)?)
    }

    /// Load a session's scrollback (empty if absent), retaining at most `cap` lines.
    pub fn load_scrollback(&self, session_id: &str, cap: usize) -> std::io::Result<ScrollbackLog> {
        ScrollbackLog::load(cap, &self.scrollback_file(session_id)?)
    }
}

/// Atomically write `bytes` to `path`: ensure the parent dir exists, write a temp file,
/// then rename over the target. A crash mid-write leaves the original intact.
pub fn atomic_write(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp = tmp_sibling(path);
    std::fs::write(&tmp, bytes)?;
    std::fs::rename(&tmp, path)?;
    Ok(())
}

/// Append `bytes` to `path`, creating it if necessary.
fn append_bytes(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    use std::io::Write;
    let mut f = std::fs::OpenOptions::new().create(true).append(true).open(path)?;
    f.write_all(bytes)
}

/// Build a temp sibling path unique to this process for atomic writes.
fn tmp_sibling(path: &Path) -> PathBuf {
    let pid = std::process::id();
    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("tmp");
    path.with_file_name(format!(".{name}.{pid}.tmp"))
}

fn validate_session_id(id: &str) -> std::io::Result<()> {
    let invalid = id.is_empty()
        || id.contains('/')
        || id.contains('\\')
        || Path::new(id).is_absolute()
        || !matches!(Path::new(id).components().next(), Some(Component::Normal(_)))
        || Path::new(id).components().count() != 1;

    if invalid {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "session id must be a single safe path segment",
        ));
    }
    Ok(())
}

fn json_io(e: serde_json::Error) -> std::io::Error {
    std::io::Error::new(std::io::ErrorKind::InvalidData, e)
}
