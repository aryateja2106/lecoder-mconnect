//! Scrollback ring-buffer behavior — the spine of the reconnect guarantee.

mod common;
use common::TempDir;
use lecoder_store::ScrollbackLog;

#[test]
fn appends_assign_monotonic_absolute_numbers() {
    let mut log = ScrollbackLog::new(100);
    log.push_line("a");
    log.push_line("b");
    log.push_line("c");
    assert_eq!(log.total_lines(), 3);
    assert_eq!(log.first_retained_line(), 0);
    let s = log.slice(0, 10);
    assert_eq!(s.lines, vec!["a", "b", "c"]);
    assert_eq!(s.from_line, 0);
}

#[test]
fn capped_drops_oldest_but_numbers_keep_climbing() {
    let mut log = ScrollbackLog::new(3);
    for i in 0..10 {
        log.push_line(format!("line{i}"));
    }
    assert_eq!(log.total_lines(), 10); // absolute, not retained
    assert_eq!(log.retained_len(), 3);
    assert_eq!(log.first_retained_line(), 7);
    let s = log.slice(7, 100);
    assert_eq!(s.lines, vec!["line7", "line8", "line9"]);
    assert_eq!(s.from_line, 7);
    assert!(!s.truncated);
}

#[test]
fn slice_from_line_returns_correct_window() {
    let mut log = ScrollbackLog::new(1000);
    for i in 0..200 {
        log.push_line(format!("L{i}"));
    }
    let s = log.slice(50, 30);
    assert_eq!(s.from_line, 50);
    assert_eq!(s.lines.len(), 30);
    assert_eq!(s.lines[0], "L50");
    assert_eq!(s.lines[29], "L79");
}

#[test]
fn slice_past_end_is_empty_no_panic() {
    let mut log = ScrollbackLog::new(100);
    log.push_line("only");
    let s = log.slice(9999, 10);
    assert!(s.lines.is_empty());
    // total_lines still correct for pagination
    assert_eq!(log.total_lines(), 1);
}

#[test]
fn slice_below_window_clamps_and_flags_truncated() {
    let mut log = ScrollbackLog::new(3);
    for i in 0..10 {
        log.push_line(format!("L{i}"));
    }
    // request from 0, but only 7..10 retained
    let s = log.slice(0, 100);
    assert!(s.truncated);
    assert_eq!(s.from_line, 7);
    assert_eq!(s.lines, vec!["L7", "L8", "L9"]);
}

#[test]
fn slice_handles_usize_max_without_panic() {
    let mut log = ScrollbackLog::new(10);
    log.push_line("x");
    let s = log.slice(0, u64::MAX);
    assert_eq!(s.lines, vec!["x"]);
}

#[test]
fn append_str_splits_lines_and_buffers_partial() {
    let mut log = ScrollbackLog::new(100);
    log.append_str("hello\nwor");
    assert_eq!(log.total_lines(), 1); // "hello" committed, "wor" pending
    log.append_str("ld\n");
    assert_eq!(log.total_lines(), 2);
    let s = log.slice(0, 10);
    assert_eq!(s.lines, vec!["hello", "world"]);
}

#[test]
fn append_str_strips_trailing_cr() {
    let mut log = ScrollbackLog::new(100);
    log.append_str("a\r\nb\r\n");
    let s = log.slice(0, 10);
    assert_eq!(s.lines, vec!["a", "b"]);
}

#[test]
fn flush_pending_emits_final_partial_line() {
    let mut log = ScrollbackLog::new(100);
    log.append_str("no newline here");
    assert_eq!(log.total_lines(), 0);
    let n = log.flush_pending();
    assert_eq!(n, Some(0));
    assert_eq!(log.total_lines(), 1);
    assert_eq!(log.slice(0, 1).lines, vec!["no newline here"]);
    assert_eq!(log.flush_pending(), None); // nothing left
}

#[test]
fn persist_and_reload_preserves_absolute_numbering() {
    let dir = TempDir::new();
    let path = dir.path().join("scrollback.jsonl");
    let mut log = ScrollbackLog::new(3);
    for i in 0..10 {
        log.push_line(format!("L{i}"));
    }
    log.save(&path).unwrap();

    let reloaded = ScrollbackLog::load(3, &path).unwrap();
    assert_eq!(reloaded.total_lines(), 10);
    assert_eq!(reloaded.first_retained_line(), 7);
    let s = reloaded.slice(7, 10);
    assert_eq!(s.from_line, 7);
    assert_eq!(s.lines, vec!["L7", "L8", "L9"]);
}

#[test]
fn repeated_save_preserves_older_lines_already_on_disk() {
    let dir = TempDir::new();
    let path = dir.path().join("scrollback.jsonl");
    let mut log = ScrollbackLog::new(3);

    for i in 0..3 {
        log.push_line(format!("L{i}"));
    }
    log.save(&path).unwrap();

    for i in 3..6 {
        log.push_line(format!("L{i}"));
    }
    assert_eq!(log.slice(0, 10).lines, vec!["L3", "L4", "L5"]);
    log.save(&path).unwrap();

    let persisted = std::fs::read_to_string(&path).unwrap();
    assert!(persisted.contains("\"line\":0"), "older persisted line was dropped");
    assert!(persisted.contains("\"line\":5"), "newer retained line was not persisted");

    let reloaded = ScrollbackLog::load(3, &path).unwrap();
    assert_eq!(reloaded.total_lines(), 6);
    assert_eq!(reloaded.first_retained_line(), 3);
    assert_eq!(reloaded.slice(3, 10).lines, vec!["L3", "L4", "L5"]);
}

#[test]
fn from_jsonl_skips_corrupt_lines() {
    let jsonl = "{\"line\":0,\"data\":\"good0\"}\nGARBAGE NOT JSON\n{\"line\":1,\"data\":\"good1\"}\n";
    let log = ScrollbackLog::from_jsonl(100, jsonl);
    assert_eq!(log.total_lines(), 2);
    assert_eq!(log.slice(0, 10).lines, vec!["good0", "good1"]);
}

#[test]
fn load_missing_file_is_empty() {
    let dir = TempDir::new();
    let log = ScrollbackLog::load(100, &dir.path().join("does-not-exist.jsonl")).unwrap();
    assert_eq!(log.total_lines(), 0);
}
