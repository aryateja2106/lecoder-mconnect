//! Pane event vocabulary roundtrip and shape checks.
//!
//! Each variant of [`PaneEvent`](rmux_sdk::PaneEvent) — pane output,
//! extended output, pause, continue, lag, disconnect, exit, close,
//! permission/read-only refusals, notifications, and command-block
//! summaries — round-trips through both `serde_json` and `bincode` with
//! its raw byte payloads and `PaneId` identity fields preserved.
//!
//! The control-output sequencing rules documented on `PaneEvent` mirror
//! the producer in `crates/rmux-server/src/control.rs`:
//!
//! * command stdout and ready pane output flush before the trailing
//!   `%end`/`%error` guard line of the active block;
//! * notifications and exits defer until the active command block
//!   closes, with deferred exits waiting for queued notifications first;
//! * EOF and empty input emit a bare `%exit\n` with no preceding guard
//!   tuple;
//! * broadcast lag precedes a pane-attributed TooFarBehind disconnect,
//!   while aged queued output maps to `%exit too far behind` without pane
//!   attribution.
//!
//! These behavioural guards are encoded into the test payloads so the
//! variants are exercised in roughly the order the daemon would emit
//! them.

#![allow(dead_code, clippy::extra_unused_type_parameters)]

use std::collections::hash_map::DefaultHasher;
use std::fmt::Debug;
use std::hash::{Hash, Hasher};

use serde::de::DeserializeOwned;
use serde::Serialize;

use rmux_sdk::{
    PaneCommandStatus, PaneCommandSummary, PaneDisconnectReason, PaneEvent, PaneExitReason, PaneId,
    PaneNotification, PanePermissionScope,
};

fn assert_send<T: Send>() {}
fn assert_sync<T: Sync>() {}
fn assert_static<T: 'static>() {}
fn assert_clone<T: Clone>() {}
fn assert_copy<T: Copy>() {}
fn assert_eq_hash<T: Eq + Hash>() {}
fn assert_debug<T: Debug>() {}

fn _assert_bounds() {
    assert_send::<PaneEvent>();
    assert_sync::<PaneEvent>();
    assert_static::<PaneEvent>();
    assert_clone::<PaneEvent>();
    assert_eq_hash::<PaneEvent>();
    assert_debug::<PaneEvent>();

    assert_send::<PaneDisconnectReason>();
    assert_sync::<PaneDisconnectReason>();
    assert_static::<PaneDisconnectReason>();
    assert_clone::<PaneDisconnectReason>();
    assert_eq_hash::<PaneDisconnectReason>();
    assert_debug::<PaneDisconnectReason>();

    assert_send::<PaneCommandStatus>();
    assert_sync::<PaneCommandStatus>();
    assert_static::<PaneCommandStatus>();
    assert_clone::<PaneCommandStatus>();
    assert_copy::<PaneCommandStatus>();
    assert_eq_hash::<PaneCommandStatus>();
    assert_debug::<PaneCommandStatus>();

    assert_send::<PaneExitReason>();
    assert_sync::<PaneExitReason>();
    assert_static::<PaneExitReason>();
    assert_clone::<PaneExitReason>();
    assert_eq_hash::<PaneExitReason>();
    assert_debug::<PaneExitReason>();

    assert_send::<PaneNotification>();
    assert_sync::<PaneNotification>();
    assert_static::<PaneNotification>();
    assert_clone::<PaneNotification>();
    assert_eq_hash::<PaneNotification>();
    assert_debug::<PaneNotification>();

    assert_send::<PaneCommandSummary>();
    assert_sync::<PaneCommandSummary>();
    assert_static::<PaneCommandSummary>();
    assert_clone::<PaneCommandSummary>();
    assert_eq_hash::<PaneCommandSummary>();
    assert_debug::<PaneCommandSummary>();

    assert_send::<PanePermissionScope>();
    assert_sync::<PanePermissionScope>();
    assert_static::<PanePermissionScope>();
    assert_clone::<PanePermissionScope>();
    assert_copy::<PanePermissionScope>();
    assert_eq_hash::<PanePermissionScope>();
    assert_debug::<PanePermissionScope>();
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

    // Round-tripping the JSON-decoded value through bincode and vice versa
    // must continue to yield the original value, so the two encodings stay
    // mutually consistent.
    let cross = bincode::deserialize::<T>(&bincode::serialize(&from_json).expect("cross encode"))
        .expect("cross decode");
    assert_eq!(&cross, value, "cross-encoding stays stable");

    // JSON output must be deterministic for a given value: the encoded form
    // is a wire-level interface and any drift would silently break
    // downstream consumers that hash or diff these payloads.
    let json_again = serde_json::to_string(&from_json).expect("re-encode JSON");
    assert_eq!(json_again, json, "JSON encoding is deterministic per value");

    from_bin
}

fn raw_payload() -> Vec<u8> {
    // Cover NUL, every C0 control byte, DEL, the backslash that the wire
    // octal-escape rules also expand, and several high-bit bytes including
    // the all-bits-set sentinel.
    let mut bytes = Vec::with_capacity(0x40);
    for byte in 0u8..=0x1f {
        bytes.push(byte);
    }
    bytes.extend_from_slice(b"hello\n\t world");
    bytes.push(b'\\');
    bytes.push(0x7f);
    bytes.extend_from_slice(&[0x80, 0xa0, 0xc2, 0xff]);
    bytes
}

#[test]
fn pane_output_round_trips_with_raw_bytes_and_pane_id() {
    let event = PaneEvent::Output {
        pane_id: PaneId::new(7),
        bytes: raw_payload(),
    };
    let decoded = round_trip(&event);
    match decoded {
        PaneEvent::Output { pane_id, bytes } => {
            assert_eq!(pane_id, PaneId::new(7));
            assert_eq!(bytes, raw_payload());
        }
        other => panic!("expected Output, got {other:?}"),
    }
}

#[test]
fn extended_output_round_trips_age_and_bytes() {
    let event = PaneEvent::ExtendedOutput {
        pane_id: PaneId::new(11),
        age_ms: u64::MAX - 1,
        bytes: raw_payload(),
    };
    let decoded = round_trip(&event);
    match decoded {
        PaneEvent::ExtendedOutput {
            pane_id,
            age_ms,
            bytes,
        } => {
            assert_eq!(pane_id, PaneId::new(11));
            assert_eq!(age_ms, u64::MAX - 1);
            assert_eq!(bytes, raw_payload());
        }
        other => panic!("expected ExtendedOutput, got {other:?}"),
    }
}

#[test]
fn pause_and_continue_round_trip_pane_id() {
    let pause = PaneEvent::Pause {
        pane_id: PaneId::new(0),
    };
    let cont = PaneEvent::Continue {
        pane_id: PaneId::new(u32::MAX),
    };

    assert_eq!(round_trip(&pause), pause);
    assert_eq!(round_trip(&cont), cont);
}

#[test]
fn lag_round_trips_and_pairs_with_too_far_behind_disconnect() {
    let lag = PaneEvent::Lag {
        pane_id: PaneId::new(42),
    };
    let too_far = PaneEvent::Disconnect {
        pane_id: Some(PaneId::new(42)),
        reason: PaneDisconnectReason::TooFarBehind,
    };

    let lag_decoded = round_trip(&lag);
    let too_far_decoded = round_trip(&too_far);

    assert_eq!(lag_decoded, lag);
    assert_eq!(too_far_decoded, too_far);
    assert!(
        matches!(lag_decoded, PaneEvent::Lag { pane_id } if pane_id == PaneId::new(42)),
        "lag preserves pane identity for the TooFarBehind disconnect path",
    );
}

#[test]
fn disconnect_variants_round_trip_each_reason() {
    let cases = [
        (None, PaneDisconnectReason::TooFarBehind),
        (None, PaneDisconnectReason::ServerShutdown),
        (None, PaneDisconnectReason::NotificationOverflow),
        (None, PaneDisconnectReason::TransportClosed),
        (
            Some(PaneId::new(9)),
            PaneDisconnectReason::Other {
                reason: "control notification queue exceeded".to_owned(),
            },
        ),
        (
            None,
            PaneDisconnectReason::Other {
                reason: String::new(),
            },
        ),
    ];

    for (pane_id, reason) in cases {
        let event = PaneEvent::Disconnect {
            pane_id,
            reason: reason.clone(),
        };
        let decoded = round_trip(&event);
        match decoded {
            PaneEvent::Disconnect {
                pane_id: decoded_pane,
                reason: decoded,
            } => {
                assert_eq!(decoded_pane, pane_id);
                assert_eq!(decoded, reason);
            }
            other => panic!("expected Disconnect, got {other:?}"),
        }
    }

    let missing_pane_id = r#"{"disconnect":{"reason":"transport-closed"}}"#;
    let decoded: PaneEvent =
        serde_json::from_str(missing_pane_id).expect("disconnect decodes without pane_id");
    assert_eq!(
        decoded,
        PaneEvent::Disconnect {
            pane_id: None,
            reason: PaneDisconnectReason::TransportClosed,
        }
    );
}

#[test]
fn close_variant_carries_pane_identity() {
    let event = PaneEvent::Close {
        pane_id: PaneId::new(13),
    };
    let decoded = round_trip(&event);
    match decoded {
        PaneEvent::Close { pane_id } => {
            assert_eq!(pane_id, PaneId::new(13));
        }
        other => panic!("expected Close, got {other:?}"),
    }
}

#[test]
fn exit_variants_round_trip_bare_and_reasoned_forms() {
    let bare = PaneEvent::Exit {
        reason: PaneExitReason::Bare,
    };
    let with_reason = PaneEvent::Exit {
        reason: PaneExitReason::WithReason {
            reason: "server shutting down".to_owned(),
        },
    };
    let too_far_behind = PaneEvent::Exit {
        reason: PaneExitReason::WithReason {
            reason: "too far behind".to_owned(),
        },
    };

    for event in [&bare, &with_reason, &too_far_behind] {
        let decoded = round_trip(event);
        assert_eq!(&decoded, event);
    }

    match round_trip(&bare) {
        PaneEvent::Exit {
            reason: PaneExitReason::Bare,
        } => {}
        other => panic!("expected bare exit, got {other:?}"),
    }
}

#[test]
fn permission_denied_round_trips_for_every_scope() {
    let scopes = [
        PanePermissionScope::ReadOnlyClient,
        PanePermissionScope::Other,
    ];
    for scope in scopes {
        let scoped = PaneEvent::PermissionDenied {
            pane_id: Some(PaneId::new(5)),
            scope,
            reason: "client is read-only".to_owned(),
        };
        let unscoped = PaneEvent::PermissionDenied {
            pane_id: None,
            scope,
            reason: String::new(),
        };

        for event in [scoped, unscoped] {
            let decoded = round_trip(&event);
            assert_eq!(decoded, event);
        }
    }
}

#[test]
fn notification_round_trips_with_and_without_pane_id() {
    let session_scoped =
        PaneEvent::Notification(PaneNotification::new("command-notification-finished"));
    let pane_scoped = PaneEvent::Notification(PaneNotification::for_pane(
        PaneId::new(99),
        "%message hello\\talpha",
    ));

    let session_decoded = round_trip(&session_scoped);
    let pane_decoded = round_trip(&pane_scoped);

    match session_decoded {
        PaneEvent::Notification(note) => {
            assert!(note.pane_id.is_none());
            assert_eq!(note.text, "command-notification-finished");
        }
        other => panic!("expected Notification, got {other:?}"),
    }
    match pane_decoded {
        PaneEvent::Notification(note) => {
            assert_eq!(note.pane_id, Some(PaneId::new(99)));
            assert_eq!(note.text, "%message hello\\talpha");
        }
        other => panic!("expected Notification, got {other:?}"),
    }
}

#[test]
fn command_summary_round_trips_success_and_failure_forms() {
    let success = PaneEvent::CommandSummary(PaneCommandSummary::success(
        1_700_000_000,
        7,
        1,
        b"first line\nsecond\n".to_vec(),
    ));
    let failure = PaneEvent::CommandSummary(PaneCommandSummary::failure(
        1_700_000_001,
        8,
        1,
        b"partial stdout\nparse error: missing argument".to_vec(),
    ));
    let empty = PaneEvent::CommandSummary(PaneCommandSummary::default());

    for event in [&success, &failure, &empty] {
        let decoded = round_trip(event);
        assert_eq!(&decoded, event);
    }

    match round_trip(&success) {
        PaneEvent::CommandSummary(summary) => {
            assert!(summary.is_success());
            assert_eq!(summary.command_number, 7);
            assert_eq!(summary.timestamp, 1_700_000_000);
            assert_eq!(summary.flags, 1);
            assert_eq!(summary.status, PaneCommandStatus::End);
            assert_eq!(summary.stdout, b"first line\nsecond\n");
        }
        other => panic!("expected CommandSummary, got {other:?}"),
    }
    match round_trip(&failure) {
        PaneEvent::CommandSummary(summary) => {
            assert!(!summary.is_success());
            assert_eq!(summary.status, PaneCommandStatus::Error);
            assert_eq!(
                summary.stdout,
                b"partial stdout\nparse error: missing argument"
            );
        }
        other => panic!("expected CommandSummary, got {other:?}"),
    }
}

#[test]
fn full_control_block_sequence_round_trips_in_order() {
    // Sequence rehearses the ordering rules documented on PaneEvent:
    //   1. ready pane output and command stdout flush before %end/%error;
    //   2. notifications defer until the command block closes;
    //   3. queued notifications flush before a deferred exit;
    //   4. EOF/empty input emits the bare %exit form;
    //   5. broadcast lag maps to a pane-attributed TooFarBehind disconnect.
    let timeline = vec![
        PaneEvent::Output {
            pane_id: PaneId::new(1),
            bytes: b"ready\n".to_vec(),
        },
        PaneEvent::CommandSummary(PaneCommandSummary::success(
            1_700_000_010,
            42,
            1,
            b"ok\n".to_vec(),
        )),
        PaneEvent::Notification(PaneNotification::new("%message deferred-after-command")),
        PaneEvent::Exit {
            reason: PaneExitReason::Bare,
        },
        PaneEvent::Lag {
            pane_id: PaneId::new(1),
        },
        PaneEvent::Disconnect {
            pane_id: Some(PaneId::new(1)),
            reason: PaneDisconnectReason::TooFarBehind,
        },
    ];

    let json = serde_json::to_string(&timeline).expect("timeline serializes as JSON");
    let from_json: Vec<PaneEvent> =
        serde_json::from_str(&json).expect("timeline deserializes from JSON");
    assert_eq!(from_json, timeline);

    let bytes = bincode::serialize(&timeline).expect("timeline serializes as bincode");
    let from_bin: Vec<PaneEvent> =
        bincode::deserialize(&bytes).expect("timeline deserializes from bincode");
    assert_eq!(from_bin, timeline);
}

#[test]
fn control_lag_event_stays_pane_scoped_and_not_an_output_gap() {
    let timeline = vec![
        PaneEvent::Lag {
            pane_id: PaneId::new(42),
        },
        PaneEvent::Disconnect {
            pane_id: Some(PaneId::new(42)),
            reason: PaneDisconnectReason::TooFarBehind,
        },
    ];

    let decoded = round_trip(&timeline);
    assert_eq!(decoded, timeline);

    let json = serde_json::to_value(&timeline[0]).expect("lag serializes as JSON");
    let lag = json
        .get("lag")
        .and_then(serde_json::Value::as_object)
        .expect("lag uses the external control-event tag");
    assert_eq!(lag.len(), 1);
    assert!(lag.contains_key("pane_id"));
    for forbidden in [
        "expected_sequence",
        "resume_sequence",
        "missed_events",
        "newest_sequence",
        "recent",
        "bytes",
        "replayed",
    ] {
        assert!(
            !lag.contains_key(forbidden),
            "control lag must not reuse output-subscription gap field `{forbidden}`",
        );
    }

    assert!(matches!(decoded[0], PaneEvent::Lag { pane_id } if pane_id == PaneId::new(42)));
    assert!(matches!(
        decoded[1],
        PaneEvent::Disconnect {
            pane_id: Some(pane_id),
            reason: PaneDisconnectReason::TooFarBehind,
        } if pane_id == PaneId::new(42)
    ));
}

#[test]
fn json_uses_external_kebab_tags_for_every_variant() {
    // Pin the externally-tagged JSON layout so downstream tooling that
    // switches on the variant key does not have to re-derive the
    // discriminant names from the source. External tagging keeps the
    // bincode encoding usable without falling back to `deserialize_any`.
    let cases: Vec<(PaneEvent, &str)> = vec![
        (
            PaneEvent::Output {
                pane_id: PaneId::new(1),
                bytes: vec![1],
            },
            "output",
        ),
        (
            PaneEvent::ExtendedOutput {
                pane_id: PaneId::new(1),
                age_ms: 0,
                bytes: vec![],
            },
            "extended-output",
        ),
        (
            PaneEvent::Pause {
                pane_id: PaneId::new(1),
            },
            "pause",
        ),
        (
            PaneEvent::Continue {
                pane_id: PaneId::new(1),
            },
            "continue",
        ),
        (
            PaneEvent::Lag {
                pane_id: PaneId::new(1),
            },
            "lag",
        ),
        (
            PaneEvent::Disconnect {
                pane_id: None,
                reason: PaneDisconnectReason::TooFarBehind,
            },
            "disconnect",
        ),
        (
            PaneEvent::Exit {
                reason: PaneExitReason::Bare,
            },
            "exit",
        ),
        (
            PaneEvent::Close {
                pane_id: PaneId::new(1),
            },
            "close",
        ),
        (
            PaneEvent::PermissionDenied {
                pane_id: None,
                scope: PanePermissionScope::ReadOnlyClient,
                reason: String::new(),
            },
            "permission-denied",
        ),
        (
            PaneEvent::Notification(PaneNotification::default()),
            "notification",
        ),
        (
            PaneEvent::CommandSummary(PaneCommandSummary::default()),
            "command-summary",
        ),
    ];

    for (event, expected_tag) in cases {
        let value = serde_json::to_value(&event).expect("variant serializes as JSON");
        let object = value
            .as_object()
            .unwrap_or_else(|| panic!("variant {event:?} must serialize as a JSON object"));
        assert_eq!(
            object.len(),
            1,
            "externally-tagged variant must have exactly one key: {value}",
        );
        let actual_tag = object
            .keys()
            .next()
            .map(String::as_str)
            .unwrap_or_else(|| panic!("variant missing top-level tag: {value}"));
        assert_eq!(
            actual_tag, expected_tag,
            "variant {event:?} must serialize with `\"{expected_tag}\": {{ ... }}`",
        );
    }
}

#[test]
fn pane_id_field_is_serde_transparent_in_event_payloads() {
    // The PaneId in pane-scoped events must reach the wire as a bare u32,
    // matching the proto-side `#[serde(transparent)]` representation. This
    // guards against accidental wrapper objects that would break wire-level
    // compatibility for downstream consumers reading the JSON projection.
    let event = PaneEvent::Output {
        pane_id: PaneId::new(257),
        bytes: vec![0xde, 0xad, 0xbe, 0xef],
    };
    let value = serde_json::to_value(&event).expect("variant serializes as JSON");
    let payload = value
        .get("output")
        .expect("externally-tagged variant exposes its payload under the variant key");
    assert_eq!(payload["pane_id"], serde_json::json!(257));
}

#[test]
fn notification_tolerates_missing_optional_fields() {
    // `PaneNotification` marks `pane_id` and `text` `#[serde(default)]` so a
    // session-scoped notification with no pane and an empty body — for
    // example a future control-mode line that carries only its variant tag
    // — still deserializes into the canonical default. Locking this in
    // prevents a future serde rename from accidentally turning these
    // optional fields into required ones.
    let session_default: PaneNotification =
        serde_json::from_str("{}").expect("empty object decodes via #[serde(default)]");
    assert_eq!(session_default, PaneNotification::default());
    assert!(session_default.pane_id.is_none());
    assert!(session_default.text.is_empty());

    let pane_only: PaneNotification = serde_json::from_str(r#"{"pane_id":42}"#)
        .expect("partial object decodes with text default");
    assert_eq!(pane_only.pane_id, Some(PaneId::new(42)));
    assert!(pane_only.text.is_empty());

    let text_only: PaneNotification = serde_json::from_str(r#"{"text":"%message hi"}"#)
        .expect("partial object decodes with pane_id default");
    assert!(text_only.pane_id.is_none());
    assert_eq!(text_only.text, "%message hi");
}

#[test]
fn command_summary_tolerates_missing_optional_fields() {
    // `status` and `stdout` carry `#[serde(default)]` so a clean `%end`
    // summary written by a producer that elides optional fields still
    // decodes. The minimum viable wire form must keep round-tripping.
    let minimal: PaneCommandSummary =
        serde_json::from_str(r#"{"timestamp":1700000000,"command_number":1,"flags":1}"#)
            .expect("minimal command summary decodes");
    assert_eq!(minimal.timestamp, 1_700_000_000);
    assert_eq!(minimal.command_number, 1);
    assert_eq!(minimal.flags, 1);
    assert_eq!(minimal.status, PaneCommandStatus::End);
    assert!(minimal.stdout.is_empty());
    assert!(minimal.is_success(), "default status means a clean %end");

    let with_error: PaneCommandSummary = serde_json::from_str(
        r#"{"timestamp":0,"command_number":0,"flags":1,"status":"error","stdout":[98,111,111,109]}"#,
    )
    .expect("error command summary decodes");
    assert!(!with_error.is_success());
    assert_eq!(with_error.status, PaneCommandStatus::Error);
    assert_eq!(with_error.stdout, b"boom");
}

#[test]
fn command_summary_constructors_are_consistent_with_is_success() {
    let success = PaneCommandSummary::success(0, 0, 1, b"hi".to_vec());
    assert!(success.is_success());
    assert_eq!(success.status, PaneCommandStatus::End);

    let failure = PaneCommandSummary::failure(0, 0, 1, b"explicit error".to_vec());
    assert!(!failure.is_success());
    assert_eq!(failure.status, PaneCommandStatus::Error);
    assert_eq!(failure.stdout, b"explicit error");

    // The `default` value mirrors a clean `%end` with no stdout — i.e. a
    // success — so consumers that construct via Default can still rely on
    // `is_success()`.
    let defaulted = PaneCommandSummary::default();
    assert!(defaulted.is_success());
    assert_eq!(defaulted.status, PaneCommandStatus::End);
    assert!(defaulted.stdout.is_empty());
}

#[test]
fn deferred_exit_follows_queued_notification_in_serialized_order() {
    // Mirrors `flush_deferred_server_events` in
    // `crates/rmux-server/src/control.rs`: when a command block closes with
    // queued notifications and a pending exit, every queued notification
    // must drain before the deferred exit. This test pins that ordering
    // invariant on the SDK side so any consumer that replays a serialized
    // timeline produces the same transcript shape.
    let timeline = vec![
        // 1. Active command finishes: stdout + %end land first.
        PaneEvent::CommandSummary(PaneCommandSummary::success(
            1_700_000_100,
            17,
            1,
            b"stdout chunk\n".to_vec(),
        )),
        // 2. Notifications that were deferred while the command was active
        //    flush in the order they were queued.
        PaneEvent::Notification(PaneNotification::new("%message queued-first")),
        PaneEvent::Notification(PaneNotification::for_pane(
            PaneId::new(2),
            "%message queued-second",
        )),
        // 3. The deferred exit lands last, after the notification flush.
        PaneEvent::Exit {
            reason: PaneExitReason::WithReason {
                reason: "control notification queue exceeded".to_owned(),
            },
        },
    ];

    let json = serde_json::to_string(&timeline).expect("timeline serializes as JSON");
    let from_json: Vec<PaneEvent> =
        serde_json::from_str(&json).expect("timeline deserializes from JSON");
    assert_eq!(from_json, timeline);

    let bytes = bincode::serialize(&timeline).expect("timeline serializes as bincode");
    let from_bin: Vec<PaneEvent> =
        bincode::deserialize(&bytes).expect("timeline deserializes from bincode");
    assert_eq!(from_bin, timeline);

    // Pin the exact emission order: notifications must precede the exit and
    // the exit must be the last entry in the transcript.
    let exit_position = from_json
        .iter()
        .rposition(|event| matches!(event, PaneEvent::Exit { .. }))
        .expect("transcript contains a deferred exit");
    assert_eq!(
        exit_position,
        from_json.len() - 1,
        "deferred exit is the final transcript entry",
    );
    let last_notification = from_json
        .iter()
        .rposition(|event| matches!(event, PaneEvent::Notification(_)))
        .expect("transcript contains queued notifications");
    assert!(
        last_notification < exit_position,
        "all queued notifications precede the deferred exit",
    );
}

#[test]
fn lag_precedes_too_far_behind_disconnect_in_serialized_order() {
    // A broadcast receiver lag is distinct from the aged output-queue
    // `%exit too far behind` path. The SDK surfaces broadcast lag as `Lag`
    // followed by a pane-attributed `Disconnect{TooFarBehind}`. Pin that
    // serialized order so consumers can rely on the prior `Lag` for pane
    // attribution.
    let timeline = vec![
        PaneEvent::Lag {
            pane_id: PaneId::new(7),
        },
        PaneEvent::Disconnect {
            pane_id: Some(PaneId::new(7)),
            reason: PaneDisconnectReason::TooFarBehind,
        },
    ];
    let json = serde_json::to_string(&timeline).expect("timeline serializes as JSON");
    let from_json: Vec<PaneEvent> =
        serde_json::from_str(&json).expect("timeline deserializes from JSON");
    assert_eq!(from_json, timeline);

    let lag_index = from_json
        .iter()
        .position(|event| matches!(event, PaneEvent::Lag { .. }))
        .expect("transcript contains a Lag entry");
    let disconnect_index = from_json
        .iter()
        .position(|event| {
            matches!(
                event,
                PaneEvent::Disconnect {
                    pane_id: Some(pane_id),
                    reason: PaneDisconnectReason::TooFarBehind,
                } if *pane_id == PaneId::new(7)
            )
        })
        .expect("transcript contains the TooFarBehind disconnect");
    assert!(
        lag_index < disconnect_index,
        "Lag must precede the TooFarBehind disconnect in the SDK transcript",
    );
    assert!(
        matches!(
            &from_json[disconnect_index],
            PaneEvent::Disconnect {
                pane_id: Some(pane_id),
                reason: PaneDisconnectReason::TooFarBehind,
            } if *pane_id == PaneId::new(7)
        ),
        "TooFarBehind disconnect preserves the lagging pane attribution",
    );
}

#[test]
fn permission_scope_round_trips_by_value_and_is_copy() {
    // `PanePermissionScope` is `Copy` so consumers can keep a scope value
    // around after they move the surrounding event. The serde encoding for
    // each scope must remain a bare kebab-case string so downstream tooling
    // can match on it as a plain enum tag.
    let cases = [
        (PanePermissionScope::ReadOnlyClient, "read-only-client"),
        (PanePermissionScope::Other, "other"),
    ];
    for (scope, expected) in cases {
        let copy = scope; // exercises the Copy bound
        assert_eq!(scope, copy);
        let json = serde_json::to_string(&scope).expect("scope serializes as JSON");
        assert_eq!(json, format!("\"{expected}\""));
        let decoded: PanePermissionScope =
            serde_json::from_str(&json).expect("scope deserializes from JSON");
        assert_eq!(decoded, scope);
    }
}
