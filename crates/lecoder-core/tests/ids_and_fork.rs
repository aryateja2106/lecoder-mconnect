//! Resumable/forkable session id generation and fork lineage.

use lecoder_core::{fork_session, new_session, SessionId, SessionIdGen};
use lecoder_proto::SessionState;

#[test]
fn ids_are_unique_within_same_millisecond() {
    let gen = SessionIdGen::new();
    let mut seen = std::collections::HashSet::new();
    for _ in 0..1000 {
        let id = gen.next(1_700_000_000_000); // same timestamp every time
        assert!(seen.insert(id.to_string()), "id collision within same ms");
    }
}

#[test]
fn ids_are_unique_across_fresh_generators_with_same_timestamp() {
    let first = SessionIdGen::new().next(1_700_000_000_000);
    let second = SessionIdGen::new().next(1_700_000_000_000);
    assert_ne!(first, second, "fresh generators must not reuse the same id");
}

#[test]
fn ids_are_time_sortable() {
    let gen = SessionIdGen::new();
    let earlier = gen.next(1_000);
    let later = gen.next(2_000);
    assert!(earlier < later, "later timestamp must sort after earlier");
    // lexicographic == chronological because of fixed-width hex prefix
    assert!(earlier.as_str() < later.as_str());
}

#[test]
fn id_round_trips_through_string_for_resume() {
    let gen = SessionIdGen::new();
    let id = gen.next(1_700_000_000_000);
    let restored = SessionId::from_string(id.to_string());
    assert_eq!(id, restored);
}

#[test]
fn new_session_starts_active_with_no_parent() {
    let gen = SessionIdGen::new();
    let id = gen.next(42);
    let rec = new_session(&id, Some("work".into()), 42.0);
    assert_eq!(rec.id, id.to_string());
    assert_eq!(rec.state, SessionState::Active);
    assert_eq!(rec.parent_session_id, None);
    assert_eq!(rec.forked_from_line, None);
}

#[test]
fn fork_creates_new_id_linking_parent_at_line() {
    let gen = SessionIdGen::new();
    let parent_id = gen.next(100);
    let parent = new_session(&parent_id, Some("base".into()), 100.0);

    let child_id = gen.next(200);
    let child = fork_session(&parent, &child_id, 1234, 200.0);

    assert_ne!(child.id, parent.id);
    assert_eq!(child.parent_session_id.as_deref(), Some(parent.id.as_str()));
    assert_eq!(child.forked_from_line, Some(1234));
    assert_eq!(child.state, SessionState::Active);
}

#[test]
fn fork_chain_preserves_ancestry() {
    let gen = SessionIdGen::new();
    let g0 = new_session(&gen.next(1), Some("root".into()), 1.0);
    let g1 = fork_session(&g0, &gen.next(2), 10, 2.0);
    let g2 = fork_session(&g1, &gen.next(3), 20, 3.0);

    assert_eq!(g1.parent_session_id.as_deref(), Some(g0.id.as_str()));
    assert_eq!(g2.parent_session_id.as_deref(), Some(g1.id.as_str()));
    assert_ne!(g0.id, g2.id);
}
