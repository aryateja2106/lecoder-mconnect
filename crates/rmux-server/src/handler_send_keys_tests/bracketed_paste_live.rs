use super::*;

#[tokio::test]
async fn live_attach_bracketed_paste_sequences_pass_through_unchanged_when_chunked() {
    let handler = RequestHandler::new();
    let alpha = session_name("alpha");
    let requester_pid = std::process::id();

    create_send_keys_test_session(&handler, &alpha).await;

    let (control_tx, _control_rx) = mpsc::unbounded_channel();
    let _attach_id = handler
        .register_attach(requester_pid, alpha.clone(), control_tx)
        .await;

    let expected = b"\x1b[200~paste\x1b[201~";
    let capture = RawPaneInputProbe::start(
        &handler,
        &alpha,
        "live-attach-bracketed-paste",
        expected.len(),
    )
    .await;

    let mut pending_input = Vec::new();
    handler
        .handle_attached_live_input(requester_pid, &mut pending_input, b"\x1b[20")
        .await
        .expect("first bracketed paste chunk");
    assert_eq!(pending_input, b"\x1b[20");

    handler
        .handle_attached_live_input(requester_pid, &mut pending_input, b"0~paste\x1b[201~")
        .await
        .expect("second bracketed paste chunk");
    assert!(pending_input.is_empty());

    capture.finish(&handler, &alpha).await;
    capture.assert_contents(&handler, expected).await;
}

#[tokio::test]
async fn live_attach_bracketed_paste_preserves_multiline_special_payload() {
    let handler = RequestHandler::new();
    let alpha = session_name("alpha");
    let requester_pid = std::process::id();

    create_send_keys_test_session(&handler, &alpha).await;

    let (control_tx, _control_rx) = mpsc::unbounded_channel();
    let _attach_id = handler
        .register_attach(requester_pid, alpha.clone(), control_tx)
        .await;

    let expected = b"\x1b[200~line one\r\nline\ttwo \x02 literal \xe6\x9d\xb1\xe4\xba\xac\x1b[201~";
    let capture = RawPaneInputProbe::start(
        &handler,
        &alpha,
        "live-attach-bracketed-paste-special",
        expected.len(),
    )
    .await;

    let mut pending_input = Vec::new();
    for chunk in [
        &expected[..4],
        &expected[4..17],
        &expected[17..31],
        &expected[31..expected.len() - 3],
        &expected[expected.len() - 3..],
    ] {
        handler
            .handle_attached_live_input(requester_pid, &mut pending_input, chunk)
            .await
            .expect("bracketed paste chunk");
    }
    assert!(pending_input.is_empty());

    capture.finish(&handler, &alpha).await;
    capture.assert_contents(&handler, expected).await;
}

#[tokio::test]
async fn live_attach_bracketed_paste_forwards_embedded_control_sequences_as_payload() {
    let handler = RequestHandler::new();
    let alpha = session_name("alpha");
    let requester_pid = std::process::id();

    create_send_keys_test_session(&handler, &alpha).await;

    let (control_tx, _control_rx) = mpsc::unbounded_channel();
    let _attach_id = handler
        .register_attach(requester_pid, alpha.clone(), control_tx)
        .await;

    let chunks: [&[u8]; 7] = [
        b"\x1b[200~literal ",
        b"\x02 prefix ",
        b"\x1b[<64;2",
        b";2M mouse-ish ",
        b"\x1b[9;2u key-ish ",
        b"\x1b[200~ nested-start-ish ",
        b"\x1b[201~",
    ];
    let expected = chunks.concat();
    let capture = RawPaneInputProbe::start(
        &handler,
        &alpha,
        "live-attach-bracketed-paste-control-like",
        expected.len(),
    )
    .await;

    let mut pending_input = Vec::new();
    for chunk in chunks {
        handler
            .handle_attached_live_input(requester_pid, &mut pending_input, chunk)
            .await
            .expect("control-like bracketed paste chunk");
    }
    assert!(pending_input.is_empty());

    capture.finish(&handler, &alpha).await;
    capture.assert_contents(&handler, &expected).await;
}
