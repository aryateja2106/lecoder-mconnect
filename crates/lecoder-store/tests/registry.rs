//! Filesystem registry: atomic writes, corruption tolerance, agent log, scrollback wiring.

mod common;
use common::TempDir;
use lecoder_proto::{AgentStatus, SessionState};
use lecoder_store::{AgentRecord, ScrollbackLog, SessionRecord, Store};

fn session(id: &str, state: SessionState) -> SessionRecord {
    SessionRecord {
        id: id.to_string(),
        name: Some(format!("name-{id}")),
        state,
        created_at: 1.0,
        last_activity: 2.0,
        parent_session_id: None,
        forked_from_line: None,
    }
}

#[test]
fn write_then_read_roundtrip() {
    let dir = TempDir::new();
    let store = Store::new(dir.path());
    let rec = session("s1", SessionState::Active);
    store.write_session(&rec).unwrap();
    let back = store.read_session("s1").unwrap();
    assert_eq!(back, rec);
}

#[test]
fn rejects_path_like_session_ids_at_store_boundary() {
    let dir = TempDir::new();
    let store = Store::new(dir.path());

    for bad in ["", "../escape", "nested/id", r"nested\id", ".", "..", "/absolute"] {
        let rec = session(bad, SessionState::Active);
        assert!(store.write_session(&rec).is_err(), "write accepted bad id {bad:?}");
        assert!(store.read_session(bad).is_err(), "read accepted bad id {bad:?}");
        assert!(store.append_agent(bad, &AgentRecord {
            id: "a1".into(),
            preset: "shell".into(),
            status: AgentStatus::Running,
            rmux_session_name: "lc-bad-shell".into(),
            pid: None,
            exit_code: None,
        }).is_err(), "append accepted bad id {bad:?}");
        assert!(store.save_scrollback(bad, &ScrollbackLog::new(10)).is_err(), "scrollback save accepted bad id {bad:?}");
        assert!(store.load_scrollback(bad, 10).is_err(), "scrollback load accepted bad id {bad:?}");
    }

    assert!(!dir.path().join("escape").exists(), "path traversal wrote outside sessions root");
}

#[test]
fn write_auto_creates_missing_dirs() {
    let dir = TempDir::new();
    // point at a not-yet-existing nested root
    let store = Store::new(dir.path().join("deep").join("lecoder"));
    store.write_session(&session("s1", SessionState::Idle)).unwrap();
    assert!(store.read_session("s1").is_ok());
}

#[test]
fn scan_returns_valid_and_skips_corrupt_entry() {
    let dir = TempDir::new();
    let store = Store::new(dir.path());
    store.write_session(&session("good1", SessionState::Active)).unwrap();
    store.write_session(&session("good2", SessionState::Idle)).unwrap();

    // Corrupt a third session dir by hand.
    let bad_dir = dir.path().join("sessions").join("bad");
    std::fs::create_dir_all(&bad_dir).unwrap();
    std::fs::write(bad_dir.join("session.json"), b"{ this is not valid json").unwrap();

    // And a stray non-dir file in sessions/.
    std::fs::write(dir.path().join("sessions").join(".DS_Store"), b"junk").unwrap();

    let mut ids: Vec<String> = store.scan_sessions().into_iter().map(|s| s.id).collect();
    ids.sort();
    assert_eq!(ids, vec!["good1".to_string(), "good2".to_string()]);
}

#[test]
fn scan_missing_sessions_dir_is_empty() {
    let dir = TempDir::new();
    let store = Store::new(dir.path());
    assert!(store.scan_sessions().is_empty());
}

#[test]
fn atomic_write_leaves_no_tmp_leftover() {
    let dir = TempDir::new();
    let store = Store::new(dir.path());
    store.write_session(&session("s1", SessionState::Active)).unwrap();
    let session_dir = dir.path().join("sessions").join("s1");
    let leftovers: Vec<_> = std::fs::read_dir(&session_dir)
        .unwrap()
        .flatten()
        .map(|e| e.file_name().to_string_lossy().to_string())
        .filter(|n| n.contains(".tmp"))
        .collect();
    assert!(leftovers.is_empty(), "unexpected tmp leftovers: {leftovers:?}");
}

#[test]
fn overwrite_replaces_previous_record() {
    let dir = TempDir::new();
    let store = Store::new(dir.path());
    store.write_session(&session("s1", SessionState::Active)).unwrap();
    let mut updated = session("s1", SessionState::Terminated);
    updated.last_activity = 999.0;
    store.write_session(&updated).unwrap();
    let back = store.read_session("s1").unwrap();
    assert_eq!(back.state, SessionState::Terminated);
    assert_eq!(back.last_activity, 999.0);
}

#[test]
fn agents_append_and_read_last_write_wins() {
    let dir = TempDir::new();
    let store = Store::new(dir.path());
    store.write_session(&session("s1", SessionState::Active)).unwrap();

    let a_creating = AgentRecord {
        id: "a1".into(),
        preset: "claude".into(),
        status: AgentStatus::Creating,
        rmux_session_name: "lc-s1-claude".into(),
        pid: None,
        exit_code: None,
    };
    store.append_agent("s1", &a_creating).unwrap();

    let mut a_running = a_creating.clone();
    a_running.status = AgentStatus::Running;
    a_running.pid = Some(4242);
    store.append_agent("s1", &a_running).unwrap();

    let agents = store.read_agents("s1");
    assert_eq!(agents.len(), 1, "same id collapses to last write");
    assert_eq!(agents[0].status, AgentStatus::Running);
    assert_eq!(agents[0].pid, Some(4242));
}

#[test]
fn agents_read_skips_corrupt_lines() {
    let dir = TempDir::new();
    let store = Store::new(dir.path());
    store.write_session(&session("s1", SessionState::Active)).unwrap();
    let good = AgentRecord {
        id: "a1".into(),
        preset: "shell".into(),
        status: AgentStatus::Running,
        rmux_session_name: "lc-s1-shell".into(),
        pid: Some(1),
        exit_code: None,
    };
    store.append_agent("s1", &good).unwrap();
    // hand-append a garbage line
    let path = dir.path().join("sessions").join("s1").join("agents.jsonl");
    use std::io::Write;
    let mut f = std::fs::OpenOptions::new().append(true).open(&path).unwrap();
    f.write_all(b"NOT JSON\n").unwrap();

    let agents = store.read_agents("s1");
    assert_eq!(agents.len(), 1);
    assert_eq!(agents[0].id, "a1");
}

#[test]
fn scrollback_save_and_load_via_store() {
    let dir = TempDir::new();
    let store = Store::new(dir.path());
    store.write_session(&session("s1", SessionState::Active)).unwrap();
    let mut log = ScrollbackLog::new(1000);
    for i in 0..5 {
        log.push_line(format!("out{i}"));
    }
    store.save_scrollback("s1", &log).unwrap();
    let reloaded = store.load_scrollback("s1", 1000).unwrap();
    assert_eq!(reloaded.total_lines(), 5);
    assert_eq!(reloaded.slice(0, 10).lines.len(), 5);
}
