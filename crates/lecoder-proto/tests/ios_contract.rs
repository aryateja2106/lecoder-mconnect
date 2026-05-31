//! Golden-JSON contract tests pinning `lecoder-proto` to the iOS Swift wire format
//! (`packages/ios-app/MConnect/Services/WebSocket/Protocol.swift`).
//!
//! Every client and server message type round-trips; enum string mappings, the error
//! retryable table, rate-limit/version constants, and unknown-message tolerance are pinned.

use lecoder_proto::*;
use serde_json::{json, Value};

/// Deserialize `json` into `ClientMessage`, re-serialize, and assert the JSON Value is equal
/// (order-independent). Returns the parsed message for further field assertions.
fn rt_client(value: Value) -> ClientMessage {
    let s = value.to_string();
    let msg: ClientMessage = serde_json::from_str(&s).expect("client deserialize");
    let back: Value = serde_json::to_value(&msg).expect("client serialize");
    assert_eq!(back, value, "client round-trip mismatch");
    msg
}

/// Same as [`rt_client`] for `ServerMessage`.
fn rt_server(value: Value) -> ServerMessage {
    let s = value.to_string();
    let msg: ServerMessage = serde_json::from_str(&s).expect("server deserialize");
    let back: Value = serde_json::to_value(&msg).expect("server serialize");
    assert_eq!(back, value, "server round-trip mismatch");
    msg
}

// --------------------------- Client -> Server ---------------------------

#[test]
fn roundtrip_auth() {
    let m = rt_client(json!({
        "type": "auth", "token": "jwt.abc", "protocolVersion": "3.0", "clientType": "mobile"
    }));
    assert!(matches!(m, ClientMessage::Auth { client_type: ClientType::Mobile, .. }));
}

#[test]
fn roundtrip_session_attach() {
    let m = rt_client(json!({ "type": "session_attach", "sessionId": "01JABC" }));
    match m {
        ClientMessage::SessionAttach { session_id } => assert_eq!(session_id, "01JABC"),
        _ => panic!("wrong variant"),
    }
}

#[test]
fn roundtrip_session_detach() {
    let m = rt_client(json!({ "type": "session_detach" }));
    assert!(matches!(m, ClientMessage::SessionDetach));
}

#[test]
fn roundtrip_terminal_input_preserves_newline() {
    let m = rt_client(json!({ "type": "terminal_input", "agentId": "a1", "data": "ls -la\n" }));
    match m {
        ClientMessage::TerminalInput { agent_id, data } => {
            assert_eq!(agent_id, "a1");
            assert_eq!(data, "ls -la\n");
        }
        _ => panic!("wrong variant"),
    }
}

#[test]
fn roundtrip_resize() {
    let m = rt_client(json!({ "type": "resize", "agentId": "a1", "cols": 120, "rows": 32 }));
    assert!(matches!(m, ClientMessage::Resize { cols: 120, rows: 32, .. }));
}

#[test]
fn roundtrip_control_request_both_actions() {
    assert!(matches!(
        rt_client(json!({ "type": "control_request", "action": "exclusive" })),
        ClientMessage::ControlRequest { action: ControlAction::Exclusive }
    ));
    assert!(matches!(
        rt_client(json!({ "type": "control_request", "action": "release" })),
        ClientMessage::ControlRequest { action: ControlAction::Release }
    ));
}

#[test]
fn roundtrip_scrollback_request() {
    let m = rt_client(json!({
        "type": "scrollback_request", "sessionId": "s1", "fromLine": 50, "count": 30
    }));
    match m {
        ClientMessage::ScrollbackRequest { session_id, from_line, count } => {
            assert_eq!(session_id, "s1");
            assert_eq!(from_line, 50);
            assert_eq!(count, 30);
        }
        _ => panic!("wrong variant"),
    }
}

#[test]
fn roundtrip_heartbeat_ack() {
    assert!(matches!(
        rt_client(json!({ "type": "heartbeat_ack", "timestamp": 1.0 })),
        ClientMessage::HeartbeatAck { .. }
    ));
}

#[test]
fn roundtrip_ping() {
    assert!(matches!(rt_client(json!({ "type": "ping" })), ClientMessage::Ping));
}

#[test]
fn roundtrip_device_token_register() {
    let m = rt_client(json!({
        "type": "device_token_register", "deviceToken": "deadbeef", "platform": "ios"
    }));
    match m {
        ClientMessage::DeviceTokenRegister { device_token, platform } => {
            assert_eq!(device_token, "deadbeef");
            assert_eq!(platform, "ios");
        }
        _ => panic!("wrong variant"),
    }
}

// --------------------------- Server -> Client ---------------------------

#[test]
fn roundtrip_auth_success() {
    let m = rt_server(json!({
        "type": "auth_success", "clientId": "c1", "protocolVersion": "3.0",
        "clientType": "mobile", "userId": "u1", "timestamp": 1234.0
    }));
    assert!(matches!(m, ServerMessage::AuthSuccess { .. }));
}

#[test]
fn roundtrip_auth_failed() {
    let m = rt_server(json!({
        "type": "auth_failed", "reason": "expired_token", "retryable": true, "timestamp": 1.0
    }));
    match m {
        ServerMessage::AuthFailed { reason, retryable, .. } => {
            assert_eq!(reason, AuthFailureReason::ExpiredToken);
            assert!(retryable);
        }
        _ => panic!("wrong variant"),
    }
}

#[test]
fn roundtrip_session_list_with_optional_name() {
    // name present
    rt_server(json!({
        "type": "session_list",
        "sessions": [{
            "id": "s1", "name": "work", "state": "active",
            "agentCount": 1, "createdAt": 1.0, "lastActivity": 2.0
        }],
        "timestamp": 3.0
    }));
    // name absent (Option skipped on serialize, defaulted on deserialize)
    let m = rt_server(json!({
        "type": "session_list",
        "sessions": [{
            "id": "s2", "state": "idle", "agentCount": 0, "createdAt": 1.0, "lastActivity": 2.0
        }],
        "timestamp": 3.0
    }));
    if let ServerMessage::SessionList { sessions, .. } = m {
        assert_eq!(sessions[0].name, None);
        assert_eq!(sessions[0].state, SessionState::Idle);
    } else {
        panic!("wrong variant");
    }
}

#[test]
fn roundtrip_session_state() {
    rt_server(json!({
        "type": "session_state", "sessionId": "s1", "state": "terminated",
        "lastActivity": 9.0, "timestamp": 10.0
    }));
}

#[test]
fn roundtrip_terminal_output() {
    let m = rt_server(json!({
        "type": "terminal_output", "agentId": "a1", "data": "ECHO: hi\r\n", "timestamp": 1.0
    }));
    assert!(matches!(m, ServerMessage::TerminalOutput { .. }));
}

#[test]
fn roundtrip_agent_status() {
    rt_server(json!({ "type": "agent_status", "agentId": "a1", "status": "running", "timestamp": 1.0 }));
}

#[test]
fn roundtrip_agent_list_uses_preset_field() {
    let value = json!({
        "type": "agent_list",
        "agents": [{ "id": "a1", "name": "Claude", "preset": "claude", "status": "creating" }],
        "timestamp": 1.0
    });
    let m = rt_server(value.clone());
    if let ServerMessage::AgentList { agents, .. } = m {
        assert_eq!(agents[0].preset, "claude");
    } else {
        panic!("wrong variant");
    }
    // Guard against regressing to `type` (the drifted v3.md field name).
    assert!(value["agents"][0].get("type").is_none());
}

#[test]
fn roundtrip_control_status_full_and_minimal() {
    rt_server(json!({
        "type": "control_status", "sessionId": "s1", "state": "mobile_exclusive",
        "activeClient": "c2", "exclusiveExpires": 99.0, "lastPcActivity": 50.0, "timestamp": 1.0
    }));
    // optional fields omitted
    let m = rt_server(json!({
        "type": "control_status", "sessionId": "s1", "state": "pc_disconnected", "timestamp": 1.0
    }));
    if let ServerMessage::ControlStatus { active_client, exclusive_expires, last_pc_activity, state, .. } = m {
        assert_eq!(state, ControlState::PcDisconnected);
        assert!(active_client.is_none() && exclusive_expires.is_none() && last_pc_activity.is_none());
    } else {
        panic!("wrong variant");
    }
}

#[test]
fn roundtrip_control_response() {
    rt_server(json!({ "type": "control_response", "granted": true, "expiresAt": 5.0, "timestamp": 1.0 }));
    rt_server(json!({ "type": "control_response", "granted": false, "reason": "pc active", "timestamp": 1.0 }));
}

#[test]
fn roundtrip_input_rejected() {
    let m = rt_server(json!({
        "type": "input_rejected", "reason": "pc_typing", "command": "rm -rf", "timestamp": 1.0
    }));
    match m {
        ServerMessage::InputRejected { reason, .. } => assert_eq!(reason, InputRejectionReason::PcTyping),
        _ => panic!("wrong variant"),
    }
}

#[test]
fn roundtrip_scrollback_response() {
    let m = rt_server(json!({
        "type": "scrollback_response", "sessionId": "s1",
        "lines": ["a", "b", "c"], "fromLine": 50, "totalLines": 200, "timestamp": 1.0
    }));
    match m {
        ServerMessage::ScrollbackResponse { lines, from_line, total_lines, .. } => {
            assert_eq!(lines, vec!["a", "b", "c"]);
            assert_eq!(from_line, 50);
            assert_eq!(total_lines, 200);
        }
        _ => panic!("wrong variant"),
    }
}

#[test]
fn roundtrip_client_joined_and_left() {
    rt_server(json!({
        "type": "client_joined",
        "client": { "clientId": "c1", "clientType": "desktop", "userId": "u1" },
        "timestamp": 1.0
    }));
    rt_server(json!({ "type": "client_left", "clientId": "c1", "timestamp": 1.0 }));
}

#[test]
fn roundtrip_heartbeat_and_pong() {
    rt_server(json!({ "type": "heartbeat", "timestamp": 1.0, "serverTime": 2.0 }));
    rt_server(json!({ "type": "pong", "timestamp": 1.0 }));
}

#[test]
fn roundtrip_error_with_and_without_retry_after() {
    let m = rt_server(json!({
        "type": "error", "message": "slow down", "code": "RATE_LIMITED",
        "retryable": true, "retryAfterMs": 1000, "timestamp": 1.0
    }));
    match m {
        ServerMessage::Error { code, retry_after_ms, .. } => {
            assert_eq!(code, ProtocolErrorCode::RateLimited);
            assert_eq!(retry_after_ms, Some(1000));
        }
        _ => panic!("wrong variant"),
    }
    rt_server(json!({
        "type": "error", "message": "gone", "code": "SESSION_NOT_FOUND",
        "retryable": false, "timestamp": 1.0
    }));
}

// --------------------------- Tolerance / negotiation ---------------------------

#[test]
fn unknown_message_type_is_tolerated_not_panic() {
    match ClientMessage::parse(r#"{"type":"some_future_thing","x":1}"#) {
        ClientParse::Unknown { message_type, raw } => {
            assert_eq!(message_type, "some_future_thing");
            assert_eq!(raw["x"], json!(1));
        }
        other => panic!("expected Unknown, got {other:?}"),
    }
}

#[test]
fn unknown_field_on_known_message_is_ignored() {
    match ClientMessage::parse(r#"{"type":"ping","extra":"ignored"}"#) {
        ClientParse::Known(ClientMessage::Ping) => {}
        other => panic!("expected Known(Ping), got {other:?}"),
    }
}

#[test]
fn missing_required_field_is_invalid_not_panic() {
    // terminal_input without `data`
    match ClientMessage::parse(r#"{"type":"terminal_input","agentId":"a1"}"#) {
        ClientParse::Invalid { .. } => {}
        other => panic!("expected Invalid, got {other:?}"),
    }
}

#[test]
fn missing_type_is_invalid() {
    match ClientMessage::parse(r#"{"token":"x"}"#) {
        ClientParse::Invalid { .. } => {}
        other => panic!("expected Invalid, got {other:?}"),
    }
}

#[test]
fn non_json_is_invalid() {
    assert!(matches!(ClientMessage::parse("not json"), ClientParse::Invalid { .. }));
}

#[test]
fn version_constant_is_3_0() {
    assert_eq!(PROTOCOL_VERSION, "3.0");
}

// --------------------------- Constant + enum tables ---------------------------

#[test]
fn rate_limit_constants_match_swift() {
    use rate_limits::*;
    assert_eq!(INPUT_CHARS_PER_SECOND, 100);
    assert_eq!(CONTROL_REQUESTS_PER_WINDOW, 1);
    assert_eq!(CONTROL_REQUEST_WINDOW_MS, 10_000);
    assert_eq!(SCROLLBACK_REQUESTS_PER_SECOND, 10);
    assert_eq!(MCP_MESSAGES_PER_SECOND, 20);
    assert_eq!(RECONNECTION_ATTEMPTS_PER_MINUTE, 5);
}

#[test]
fn error_code_strings_round_trip_exactly() {
    let table = [
        (ProtocolErrorCode::AuthFailed, "AUTH_FAILED"),
        (ProtocolErrorCode::AuthExpired, "AUTH_EXPIRED"),
        (ProtocolErrorCode::SessionNotFound, "SESSION_NOT_FOUND"),
        (ProtocolErrorCode::SessionCompleted, "SESSION_COMPLETED"),
        (ProtocolErrorCode::NotAttached, "NOT_ATTACHED"),
        (ProtocolErrorCode::RateLimited, "RATE_LIMITED"),
        (ProtocolErrorCode::GuardrailBlocked, "GUARDRAIL_BLOCKED"),
        (ProtocolErrorCode::InternalError, "INTERNAL_ERROR"),
    ];
    for (code, s) in table {
        assert_eq!(serde_json::to_value(code).unwrap(), json!(s));
        let back: ProtocolErrorCode = serde_json::from_value(json!(s)).unwrap();
        assert_eq!(back, code);
    }
}

#[test]
fn error_code_retryable_table() {
    assert!(!ProtocolErrorCode::AuthFailed.retryable());
    assert!(ProtocolErrorCode::AuthExpired.retryable());
    assert!(!ProtocolErrorCode::SessionNotFound.retryable());
    assert!(!ProtocolErrorCode::SessionCompleted.retryable());
    assert!(ProtocolErrorCode::NotAttached.retryable());
    assert!(ProtocolErrorCode::RateLimited.retryable());
    assert!(!ProtocolErrorCode::GuardrailBlocked.retryable());
    assert!(ProtocolErrorCode::InternalError.retryable());
}

#[test]
fn input_rejection_reason_strings() {
    let table = [
        (InputRejectionReason::PcTyping, "pc_typing"),
        (InputRejectionReason::OtherExclusive, "other_exclusive"),
        (InputRejectionReason::RateLimited, "rate_limited"),
        (InputRejectionReason::ReadOnly, "read_only"),
        (InputRejectionReason::GuardrailBlocked, "guardrail_blocked"),
    ];
    for (r, s) in table {
        assert_eq!(serde_json::to_value(r).unwrap(), json!(s));
    }
}

#[test]
fn control_state_strings() {
    let table = [
        (ControlState::PcActive, "pc_active"),
        (ControlState::PcIdle, "pc_idle"),
        (ControlState::PcDisconnected, "pc_disconnected"),
        (ControlState::MobileExclusive, "mobile_exclusive"),
    ];
    for (c, s) in table {
        assert_eq!(serde_json::to_value(c).unwrap(), json!(s));
    }
}

#[test]
fn session_and_agent_status_strings() {
    assert_eq!(serde_json::to_value(SessionState::Active).unwrap(), json!("active"));
    assert_eq!(serde_json::to_value(SessionState::Idle).unwrap(), json!("idle"));
    assert_eq!(serde_json::to_value(SessionState::Terminated).unwrap(), json!("terminated"));
    for (st, s) in [
        (AgentStatus::Creating, "creating"),
        (AgentStatus::Running, "running"),
        (AgentStatus::Idle, "idle"),
        (AgentStatus::Stopped, "stopped"),
        (AgentStatus::Error, "error"),
    ] {
        assert_eq!(serde_json::to_value(st).unwrap(), json!(s));
    }
}
