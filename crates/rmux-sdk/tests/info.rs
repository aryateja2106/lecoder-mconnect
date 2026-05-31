//! Info-snapshot DTO roundtrip and shape checks.
//!
//! Each sticky info DTO ([`SessionInfo`](rmux_sdk::SessionInfo),
//! [`WindowInfo`](rmux_sdk::WindowInfo),
//! [`PaneInfo`](rmux_sdk::PaneInfo), and the aggregate
//! [`InfoSnapshot`](rmux_sdk::InfoSnapshot)) round-trips through both
//! `serde_json` and `bincode`. The tests pin:
//!
//! * the v1 metadata surface (`command`, `working_directory`, `tags`,
//!   `size`, generation, revision, `output_sequence`, exit state);
//! * the absence of any `env` / `environment` field on
//!   [`PaneInfo`](rmux_sdk::PaneInfo);
//! * sparse / default decoding when optional fields are elided;
//! * the lag-recovery contract documented on the `info` module — `info()`
//!   refreshes sticky state but cannot reconstruct dropped raw pane bytes.

#![allow(dead_code, clippy::extra_unused_type_parameters)]

use std::collections::hash_map::DefaultHasher;
use std::fmt::Debug;
use std::hash::{Hash, Hasher};

use serde::de::DeserializeOwned;
use serde::Serialize;

use rmux_sdk::{
    InfoSnapshot, PaneExitState, PaneId, PaneInfo, PaneProcessState, SessionId, SessionInfo,
    SessionName, TerminalSizeSpec, WindowId, WindowInfo,
};

fn assert_send<T: Send>() {}
fn assert_sync<T: Sync>() {}
fn assert_static<T: 'static>() {}
fn assert_clone<T: Clone>() {}
fn assert_eq_hash<T: Eq + Hash>() {}
fn assert_debug<T: Debug>() {}
fn assert_default<T: Default>() {}

fn _assert_bounds() {
    assert_send::<SessionInfo>();
    assert_sync::<SessionInfo>();
    assert_static::<SessionInfo>();
    assert_clone::<SessionInfo>();
    assert_eq_hash::<SessionInfo>();
    assert_debug::<SessionInfo>();

    assert_send::<WindowInfo>();
    assert_sync::<WindowInfo>();
    assert_static::<WindowInfo>();
    assert_clone::<WindowInfo>();
    assert_eq_hash::<WindowInfo>();
    assert_debug::<WindowInfo>();

    assert_send::<PaneInfo>();
    assert_sync::<PaneInfo>();
    assert_static::<PaneInfo>();
    assert_clone::<PaneInfo>();
    assert_eq_hash::<PaneInfo>();
    assert_debug::<PaneInfo>();

    assert_send::<InfoSnapshot>();
    assert_sync::<InfoSnapshot>();
    assert_static::<InfoSnapshot>();
    assert_clone::<InfoSnapshot>();
    assert_eq_hash::<InfoSnapshot>();
    assert_debug::<InfoSnapshot>();
    assert_default::<InfoSnapshot>();

    assert_send::<PaneProcessState>();
    assert_sync::<PaneProcessState>();
    assert_static::<PaneProcessState>();
    assert_clone::<PaneProcessState>();
    assert_eq_hash::<PaneProcessState>();
    assert_debug::<PaneProcessState>();
    assert_default::<PaneProcessState>();

    assert_send::<PaneExitState>();
    assert_sync::<PaneExitState>();
    assert_static::<PaneExitState>();
    assert_clone::<PaneExitState>();
    assert_eq_hash::<PaneExitState>();
    assert_debug::<PaneExitState>();
    assert_default::<PaneExitState>();
}

fn hash_of<T: Hash>(value: &T) -> u64 {
    let mut hasher = DefaultHasher::new();
    value.hash(&mut hasher);
    hasher.finish()
}

fn round_trip<T>(value: &T) -> T
where
    T: Serialize + DeserializeOwned + PartialEq + Debug + Hash,
{
    let json = serde_json::to_string(value).expect("value serializes as JSON");
    let from_json = serde_json::from_str::<T>(&json).expect("value deserializes from JSON");
    assert_eq!(&from_json, value, "JSON round trip preserves equality");
    assert_eq!(
        hash_of(&from_json),
        hash_of(value),
        "JSON round trip preserves Hash output: {json}",
    );

    let bytes = bincode::serialize(value).expect("value serializes as bincode");
    let from_bin = bincode::deserialize::<T>(&bytes).expect("value deserializes from bincode");
    assert_eq!(&from_bin, value, "bincode round trip preserves equality");
    assert_eq!(
        hash_of(&from_bin),
        hash_of(value),
        "bincode round trip preserves Hash output",
    );

    let cross = bincode::deserialize::<T>(&bincode::serialize(&from_json).expect("cross encode"))
        .expect("cross decode");
    assert_eq!(&cross, value, "cross-encoding stays stable");

    let json_again = serde_json::to_string(&from_json).expect("re-encode JSON");
    assert_eq!(json_again, json, "JSON encoding is deterministic per value");

    from_bin
}

fn populated_session() -> SessionInfo {
    SessionInfo {
        id: SessionId::new(7),
        name: SessionName::new("alpha").expect("valid session name"),
        working_directory: Some("/srv/work".to_owned()),
        size: TerminalSizeSpec::new(180, 48),
        tags: vec!["pinned".to_owned(), "scratch".to_owned()],
        generation: 42,
        revision: 9,
        attached_clients: 2,
    }
}

fn populated_window() -> WindowInfo {
    WindowInfo {
        id: WindowId::new(11),
        session_id: SessionId::new(7),
        index: 3,
        name: Some("editor".to_owned()),
        size: TerminalSizeSpec::new(180, 48),
        tags: vec!["primary".to_owned()],
        generation: 33,
        revision: 4,
    }
}

fn populated_pane() -> PaneInfo {
    PaneInfo {
        id: PaneId::new(101),
        window_id: WindowId::new(11),
        session_id: SessionId::new(7),
        index: 0,
        command: Some(vec![
            "/usr/bin/env".to_owned(),
            "bash".to_owned(),
            "-l".to_owned(),
        ]),
        working_directory: Some("/srv/work/repo".to_owned()),
        tags: vec!["focus".to_owned(), "build".to_owned()],
        size: TerminalSizeSpec::new(120, 32),
        process: PaneProcessState::Running { pid: Some(2048) },
        generation: 256,
        revision: 17,
        output_sequence: 1_700_000_321,
        exit_state: None,
    }
}

#[test]
fn session_info_round_trips_v1_metadata_and_counters() {
    let info = populated_session();
    let decoded = round_trip(&info);
    assert_eq!(decoded, info);
    assert_eq!(decoded.id, SessionId::new(7));
    assert_eq!(decoded.name.as_str(), "alpha");
    assert_eq!(decoded.working_directory.as_deref(), Some("/srv/work"));
    assert_eq!(decoded.size, TerminalSizeSpec::new(180, 48));
    assert_eq!(
        decoded.tags,
        vec!["pinned".to_owned(), "scratch".to_owned()]
    );
    assert_eq!(decoded.generation, 42);
    assert_eq!(decoded.revision, 9);
    assert_eq!(decoded.attached_clients, 2);
}

#[test]
fn window_info_round_trips_v1_metadata_and_counters() {
    let info = populated_window();
    let decoded = round_trip(&info);
    assert_eq!(decoded, info);
    assert_eq!(decoded.id, WindowId::new(11));
    assert_eq!(decoded.session_id, SessionId::new(7));
    assert_eq!(decoded.index, 3);
    assert_eq!(decoded.name.as_deref(), Some("editor"));
    assert_eq!(decoded.size, TerminalSizeSpec::new(180, 48));
    assert_eq!(decoded.tags, vec!["primary".to_owned()]);
    assert_eq!(decoded.generation, 33);
    assert_eq!(decoded.revision, 4);
}

#[test]
fn pane_info_round_trips_command_cwd_tags_dimensions_and_counters() {
    let info = populated_pane();
    let decoded = round_trip(&info);
    assert_eq!(decoded, info);
    assert_eq!(decoded.id, PaneId::new(101));
    assert_eq!(decoded.window_id, WindowId::new(11));
    assert_eq!(decoded.session_id, SessionId::new(7));
    assert_eq!(decoded.index, 0);
    assert_eq!(
        decoded.command.as_deref(),
        Some(
            [
                "/usr/bin/env".to_owned(),
                "bash".to_owned(),
                "-l".to_owned(),
            ]
            .as_slice()
        )
    );
    assert_eq!(decoded.working_directory.as_deref(), Some("/srv/work/repo"));
    assert_eq!(decoded.tags, vec!["focus".to_owned(), "build".to_owned()]);
    assert_eq!(decoded.size, TerminalSizeSpec::new(120, 32));
    assert!(matches!(
        decoded.process,
        PaneProcessState::Running { pid: Some(2048) }
    ));
    assert_eq!(decoded.generation, 256);
    assert_eq!(decoded.revision, 17);
    assert_eq!(decoded.output_sequence, 1_700_000_321);
    assert!(decoded.exit_state.is_none());
}

#[test]
fn pane_info_has_no_environment_field_on_the_wire() {
    // The SDK contract forbids exposing pane environment via info
    // snapshots. Pin the JSON projection so a future refactor that adds
    // an `env` field cannot land silently.
    let info = populated_pane();
    let value = serde_json::to_value(&info).expect("pane info serializes as JSON");
    let object = value
        .as_object()
        .expect("pane info serializes as a JSON object");
    assert!(
        !object.contains_key("env"),
        "PaneInfo must not expose a pane env field on the wire",
    );
    assert!(
        !object.contains_key("environment"),
        "PaneInfo must not expose a pane environment field on the wire",
    );

    // Even an explicit `env` field on the wire must be rejected by the
    // schema — `serde` will return an error on the unknown field if the
    // struct ever picks up `#[serde(deny_unknown_fields)]`. Until then,
    // ensure the deserializer at least ignores the field rather than
    // populating a hidden state slot.
    let intrusive = serde_json::json!({
        "id": 101,
        "window_id": 11,
        "session_id": 7,
        "env": ["SECRET=1"],
        "environment": ["SECRET=1"],
    });
    let decoded: PaneInfo =
        serde_json::from_value(intrusive).expect("intrusive env field is ignored");
    assert_eq!(decoded.id, PaneId::new(101));
    assert_eq!(decoded.window_id, WindowId::new(11));
    assert_eq!(decoded.session_id, SessionId::new(7));
}

#[test]
fn pane_process_state_round_trips_each_variant() {
    let states = [
        PaneProcessState::Unknown,
        PaneProcessState::Running { pid: None },
        PaneProcessState::Running { pid: Some(0) },
        PaneProcessState::Running {
            pid: Some(u32::MAX),
        },
        PaneProcessState::Exited,
    ];
    for state in &states {
        let decoded = round_trip(state);
        assert_eq!(&decoded, state);
    }

    // External tagging keeps the JSON projection compatible with bincode.
    let json = serde_json::to_string(&PaneProcessState::Running { pid: Some(7) })
        .expect("running state serializes as JSON");
    assert_eq!(json, r#"{"running":{"pid":7}}"#);
    let exited = serde_json::to_string(&PaneProcessState::Exited).expect("exited serializes");
    assert_eq!(exited, r#""exited""#);
    let unknown = serde_json::to_string(&PaneProcessState::Unknown).expect("unknown serializes");
    assert_eq!(unknown, r#""unknown""#);
}

#[test]
fn pane_exit_state_round_trips_code_signal_and_message() {
    let cases = [
        PaneExitState::default(),
        PaneExitState::from_code(0),
        PaneExitState::from_code(127),
        PaneExitState::from_signal(15),
        PaneExitState {
            code: Some(2),
            signal: None,
            message: Some("remain-on-exit".to_owned()),
        },
        PaneExitState {
            code: None,
            signal: Some(9),
            message: Some("killed by signal".to_owned()),
        },
    ];
    for state in &cases {
        let decoded = round_trip(state);
        assert_eq!(&decoded, state);
    }
}

#[test]
fn info_snapshot_aggregates_sessions_windows_and_panes() {
    let snapshot = InfoSnapshot::new(
        vec![populated_session()],
        vec![populated_window()],
        vec![
            populated_pane(),
            PaneInfo {
                id: PaneId::new(102),
                window_id: WindowId::new(11),
                session_id: SessionId::new(7),
                index: 1,
                command: None,
                working_directory: None,
                tags: Vec::new(),
                size: TerminalSizeSpec::new(60, 32),
                process: PaneProcessState::Exited,
                generation: 8,
                revision: 1,
                output_sequence: 0,
                exit_state: Some(PaneExitState {
                    code: Some(0),
                    signal: None,
                    message: Some("clean".to_owned()),
                }),
            },
        ],
    );

    let decoded = round_trip(&snapshot);
    assert_eq!(decoded, snapshot);

    assert_eq!(
        decoded.session(SessionId::new(7)).map(|info| &info.name),
        Some(&SessionName::new("alpha").expect("valid"))
    );
    assert_eq!(
        decoded.window(WindowId::new(11)).map(|info| info.index),
        Some(3)
    );
    let exited_pane = decoded
        .pane(PaneId::new(102))
        .expect("aggregate exposes the second pane");
    assert!(matches!(exited_pane.process, PaneProcessState::Exited));
    assert_eq!(
        exited_pane.exit_state.as_ref().and_then(|state| state.code),
        Some(0),
    );
    assert!(decoded.session(SessionId::new(99)).is_none());
    assert!(decoded.window(WindowId::new(99)).is_none());
    assert!(decoded.pane(PaneId::new(99)).is_none());
}

#[test]
fn sparse_payloads_default_optional_fields_for_each_dto() {
    let session: SessionInfo = serde_json::from_value(serde_json::json!({"id": 0, "name": "main"}))
        .expect("sparse session info decodes with defaults");
    assert_eq!(session.id, SessionId::new(0));
    assert_eq!(session.name.as_str(), "main");
    assert!(session.working_directory.is_none());
    assert_eq!(session.size, TerminalSizeSpec::default());
    assert!(session.tags.is_empty());
    assert_eq!(session.generation, 0);
    assert_eq!(session.revision, 0);
    assert_eq!(session.attached_clients, 0);

    let window: WindowInfo = serde_json::from_value(serde_json::json!({
        "id": 4,
        "session_id": 1,
    }))
    .expect("sparse window info decodes with defaults");
    assert_eq!(window.id, WindowId::new(4));
    assert_eq!(window.session_id, SessionId::new(1));
    assert_eq!(window.index, 0);
    assert!(window.name.is_none());
    assert_eq!(window.size, TerminalSizeSpec::default());
    assert!(window.tags.is_empty());
    assert_eq!(window.generation, 0);
    assert_eq!(window.revision, 0);

    let pane: PaneInfo = serde_json::from_value(serde_json::json!({
        "id": 5,
        "window_id": 4,
        "session_id": 1,
    }))
    .expect("sparse pane info decodes with defaults");
    assert_eq!(pane.id, PaneId::new(5));
    assert_eq!(pane.window_id, WindowId::new(4));
    assert_eq!(pane.session_id, SessionId::new(1));
    assert_eq!(pane.index, 0);
    assert!(pane.command.is_none());
    assert!(pane.working_directory.is_none());
    assert!(pane.tags.is_empty());
    assert_eq!(pane.size, TerminalSizeSpec::default());
    assert!(matches!(pane.process, PaneProcessState::Unknown));
    assert_eq!(pane.generation, 0);
    assert_eq!(pane.revision, 0);
    assert_eq!(pane.output_sequence, 0);
    assert!(pane.exit_state.is_none());

    let snapshot: InfoSnapshot =
        serde_json::from_str("{}").expect("empty object decodes via #[serde(default)]");
    assert_eq!(snapshot, InfoSnapshot::default());
    assert!(snapshot.sessions.is_empty());
    assert!(snapshot.windows.is_empty());
    assert!(snapshot.panes.is_empty());

    let exit_state: PaneExitState =
        serde_json::from_str("{}").expect("empty object decodes via #[serde(default)]");
    assert_eq!(exit_state, PaneExitState::default());
    assert!(exit_state.code.is_none());
    assert!(exit_state.signal.is_none());
    assert!(exit_state.message.is_none());
}

#[test]
fn info_constructors_match_default_optional_fields() {
    let session = SessionInfo::new(
        SessionId::new(0),
        SessionName::new("solo").expect("valid name"),
    );
    assert!(session.working_directory.is_none());
    assert_eq!(session.size, TerminalSizeSpec::default());
    assert!(session.tags.is_empty());
    assert_eq!(session.generation, 0);
    assert_eq!(session.revision, 0);
    assert_eq!(session.attached_clients, 0);

    let window = WindowInfo::new(WindowId::new(2), SessionId::new(0));
    assert_eq!(window.index, 0);
    assert!(window.name.is_none());
    assert_eq!(window.size, TerminalSizeSpec::default());
    assert!(window.tags.is_empty());

    let pane = PaneInfo::new(PaneId::new(3), WindowId::new(2), SessionId::new(0));
    assert!(pane.command.is_none());
    assert!(pane.working_directory.is_none());
    assert!(pane.tags.is_empty());
    assert_eq!(pane.size, TerminalSizeSpec::default());
    assert!(matches!(pane.process, PaneProcessState::Unknown));
    assert_eq!(pane.generation, 0);
    assert_eq!(pane.revision, 0);
    assert_eq!(pane.output_sequence, 0);
    assert!(pane.exit_state.is_none());
}

#[test]
fn info_snapshot_lag_recovery_refreshes_sticky_state_and_output_anchor() {
    // Mirrors the lag-recovery contract documented on `info`: an
    // `info()` invocation after a broadcast lag or `TooFarBehind`
    // disconnect refreshes sticky metadata, sticky pane state, and the
    // latest `output_sequence` cursor — but cannot reconstruct dropped
    // raw bytes. The before/after snapshots in this test stand in for
    // the daemon's fresh response, with the `output_sequence` advancing
    // and the process state transitioning, while no pane byte payload
    // is reconstructed because raw output is not part of `InfoSnapshot`.
    let pane_id = PaneId::new(11);
    let window_id = WindowId::new(2);
    let session_id = SessionId::new(1);

    let before = InfoSnapshot::new(
        vec![SessionInfo {
            attached_clients: 1,
            generation: 100,
            revision: 5,
            ..SessionInfo::new(session_id, SessionName::new("recover").expect("valid"))
        }],
        vec![WindowInfo {
            generation: 50,
            revision: 2,
            size: TerminalSizeSpec::new(80, 24),
            ..WindowInfo::new(window_id, session_id)
        }],
        vec![PaneInfo {
            command: Some(vec!["sh".to_owned()]),
            working_directory: Some("/work".to_owned()),
            size: TerminalSizeSpec::new(80, 24),
            process: PaneProcessState::Running { pid: Some(123) },
            generation: 200,
            revision: 12,
            output_sequence: 4_096,
            exit_state: None,
            ..PaneInfo::new(pane_id, window_id, session_id)
        }],
    );

    // After lag recovery, sticky counters advance, the pane has exited,
    // and the output sequence is anchored further along the stream than
    // anything the SDK consumer observed before the lag.
    let after = InfoSnapshot::new(
        vec![SessionInfo {
            attached_clients: 1,
            generation: 137,
            revision: 6,
            ..SessionInfo::new(session_id, SessionName::new("recover").expect("valid"))
        }],
        vec![WindowInfo {
            generation: 71,
            revision: 3,
            size: TerminalSizeSpec::new(120, 30),
            ..WindowInfo::new(window_id, session_id)
        }],
        vec![PaneInfo {
            command: Some(vec!["sh".to_owned()]),
            working_directory: Some("/work".to_owned()),
            size: TerminalSizeSpec::new(120, 30),
            process: PaneProcessState::Exited,
            generation: 314,
            revision: 21,
            // The daemon's retained ring kept advancing the cursor while
            // the SDK was lagging. The far-behind bytes between 4_096 and
            // 9_001 were dropped and `info()` does not — and cannot —
            // resurface them.
            output_sequence: 9_001,
            exit_state: Some(PaneExitState {
                code: Some(0),
                signal: None,
                message: Some("clean".to_owned()),
            }),
            ..PaneInfo::new(pane_id, window_id, session_id)
        }],
    );

    let before_decoded = round_trip(&before);
    let after_decoded = round_trip(&after);
    assert_eq!(before_decoded, before);
    assert_eq!(after_decoded, after);

    let before_pane = before_decoded
        .pane(pane_id)
        .expect("before snapshot has the pane");
    let after_pane = after_decoded
        .pane(pane_id)
        .expect("after snapshot has the pane");

    assert_eq!(
        before_pane.output_sequence, 4_096,
        "before-recovery cursor matches the producer-supplied anchor",
    );
    assert_eq!(
        after_pane.output_sequence, 9_001,
        "info() returns the daemon's freshly recorded cursor verbatim",
    );
    assert_eq!(
        after_pane
            .output_sequence
            .checked_sub(before_pane.output_sequence),
        Some(4_905),
        "info() must not silently rewind or wrap the output cursor",
    );
    assert!(
        after_pane.generation > before_pane.generation,
        "info() refreshes the sticky pane generation counter",
    );
    assert!(
        after_pane.revision > before_pane.revision,
        "info() refreshes the sticky pane revision counter",
    );
    assert!(
        matches!(after_pane.process, PaneProcessState::Exited),
        "info() refreshes sticky process state after lag recovery",
    );
    assert_eq!(
        after_pane.exit_state.as_ref().and_then(|state| state.code),
        Some(0),
        "info() surfaces the captured exit state for the recovered pane",
    );
    assert_eq!(
        after_pane.size,
        TerminalSizeSpec::new(120, 30),
        "info() refreshes pane geometry after a resize during the lag window",
    );

    // The aggregate snapshot exposes only sticky state; raw pane bytes
    // dropped from the retained ring during the lag window cannot be
    // reconstructed by `info()`. Pin that contract: there is no raw-bytes
    // surface anywhere on the JSON projection of an InfoSnapshot, and the
    // recovered pane projection still carries no env field.
    let json = serde_json::to_value(&after).expect("snapshot serializes as JSON");
    let pane_json = json["panes"][0]
        .as_object()
        .expect("pane entry is a JSON object");
    for forbidden in [
        "output_bytes",
        "raw_output",
        "scrollback",
        "buffer",
        "bytes",
        "env",
        "environment",
    ] {
        assert!(
            !pane_json.contains_key(forbidden),
            "info() must not carry the `{forbidden}` field on a recovered pane",
        );
    }
    assert!(
        pane_json.contains_key("output_sequence"),
        "info() exposes the re-anchor cursor instead of dropped bytes",
    );
}

#[test]
fn info_dto_field_sets_pin_the_v1_metadata_surface() {
    // Lock the JSON shape of every populated DTO. The test is a positive
    // companion to the env-absence check: it both forbids unexpected
    // fields and guarantees every documented v1 field is present.
    fn assert_object_keys(value: &serde_json::Value, expected: &[&str], label: &str) {
        let object = value
            .as_object()
            .unwrap_or_else(|| panic!("{label} must serialize as a JSON object"));
        for key in expected {
            assert!(
                object.contains_key(*key),
                "{label} JSON missing expected v1 field `{key}`",
            );
        }
        let extras: Vec<&String> = object
            .keys()
            .filter(|k| !expected.contains(&k.as_str()))
            .collect();
        assert!(
            extras.is_empty(),
            "{label} JSON has unexpected fields: {extras:?}",
        );
    }

    let session_json = serde_json::to_value(populated_session()).expect("session serializes");
    assert_object_keys(
        &session_json,
        &[
            "id",
            "name",
            "working_directory",
            "size",
            "tags",
            "generation",
            "revision",
            "attached_clients",
        ],
        "SessionInfo",
    );

    let window_json = serde_json::to_value(populated_window()).expect("window serializes");
    assert_object_keys(
        &window_json,
        &[
            "id",
            "session_id",
            "index",
            "name",
            "size",
            "tags",
            "generation",
            "revision",
        ],
        "WindowInfo",
    );

    let pane_json = serde_json::to_value(populated_pane()).expect("pane serializes");
    assert_object_keys(
        &pane_json,
        &[
            "id",
            "window_id",
            "session_id",
            "index",
            "command",
            "working_directory",
            "tags",
            "size",
            "process",
            "generation",
            "revision",
            "output_sequence",
            "exit_state",
        ],
        "PaneInfo",
    );

    let snapshot_json = serde_json::to_value(InfoSnapshot::new(
        vec![populated_session()],
        vec![populated_window()],
        vec![populated_pane()],
    ))
    .expect("snapshot serializes");
    assert_object_keys(
        &snapshot_json,
        &["sessions", "windows", "panes"],
        "InfoSnapshot",
    );
}

#[test]
fn info_dto_counters_round_trip_at_full_range() {
    // Pin that none of the counters are silently truncated to a narrower
    // type. The daemon advances generations and output sequences
    // monotonically; a u64 wire field must carry the full range.
    let session = SessionInfo {
        generation: u64::MAX,
        revision: u64::MAX - 1,
        attached_clients: u32::MAX,
        ..populated_session()
    };
    let decoded = round_trip(&session);
    assert_eq!(decoded.generation, u64::MAX);
    assert_eq!(decoded.revision, u64::MAX - 1);
    assert_eq!(decoded.attached_clients, u32::MAX);

    let window = WindowInfo {
        generation: u64::MAX,
        revision: u64::MAX - 1,
        index: u32::MAX,
        ..populated_window()
    };
    let decoded = round_trip(&window);
    assert_eq!(decoded.generation, u64::MAX);
    assert_eq!(decoded.revision, u64::MAX - 1);
    assert_eq!(decoded.index, u32::MAX);

    let pane = PaneInfo {
        generation: u64::MAX,
        revision: u64::MAX - 1,
        output_sequence: u64::MAX,
        index: u32::MAX,
        process: PaneProcessState::Running {
            pid: Some(u32::MAX),
        },
        ..populated_pane()
    };
    let decoded = round_trip(&pane);
    assert_eq!(decoded.generation, u64::MAX);
    assert_eq!(decoded.revision, u64::MAX - 1);
    assert_eq!(decoded.output_sequence, u64::MAX);
    assert_eq!(decoded.index, u32::MAX);
    assert!(matches!(
        decoded.process,
        PaneProcessState::Running {
            pid: Some(p),
        } if p == u32::MAX,
    ));
}
