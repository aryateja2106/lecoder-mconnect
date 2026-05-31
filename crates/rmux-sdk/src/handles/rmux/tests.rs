use std::io;
use std::time::Duration;

use super::connect::startup_operation_timeout;
#[cfg(windows)]
use super::connect::windows_pipe_connect_retryable;
use super::Rmux;
use crate::diagnostics::FEATURE_PROTOCOL_CAPABILITIES;
use crate::transport::TransportClient;
use crate::RmuxError;
use rmux_proto::{
    encode_frame, ErrorResponse, FrameDecoder, HandshakeResponse, HasSessionRequest,
    HasSessionResponse, KillServerRequest, KillServerResponse, Request, Response, SessionName,
    CAPABILITY_DAEMON_SHUTDOWN, CAPABILITY_HANDSHAKE, RMUX_WIRE_VERSION,
};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
#[cfg(windows)]
use windows_sys::Win32::Foundation::{
    ERROR_FILE_NOT_FOUND, ERROR_NO_DATA, ERROR_PIPE_BUSY, ERROR_PIPE_NOT_CONNECTED,
};

fn alpha() -> SessionName {
    SessionName::new("alpha").expect("valid session")
}

fn cleanup_request() -> Request {
    Request::HasSession(HasSessionRequest { target: alpha() })
}

#[test]
fn startup_timeout_honors_builder_default_and_unbounded_sentinel() {
    assert_eq!(
        startup_operation_timeout(Some(Duration::from_millis(123))),
        Some(Duration::from_millis(123))
    );
    assert_eq!(startup_operation_timeout(Some(Duration::MAX)), None);
}

#[cfg(windows)]
#[test]
fn windows_pipe_retry_policy_covers_transient_startup_errors() {
    let busy = io::Error::from_raw_os_error(ERROR_PIPE_BUSY as i32);
    let not_connected = io::Error::from_raw_os_error(ERROR_PIPE_NOT_CONNECTED as i32);
    let no_data = io::Error::from_raw_os_error(ERROR_NO_DATA as i32);
    let raw_not_found = io::Error::from_raw_os_error(ERROR_FILE_NOT_FOUND as i32);
    let not_found = io::Error::new(io::ErrorKind::NotFound, "pipe absent");

    assert!(windows_pipe_connect_retryable(&busy));
    assert!(windows_pipe_connect_retryable(&not_connected));
    assert!(windows_pipe_connect_retryable(&no_data));
    assert!(windows_pipe_connect_retryable(&raw_not_found));
    assert!(!windows_pipe_connect_retryable(&not_found));
}

async fn read_request(stream: &mut tokio::io::DuplexStream) -> Request {
    let mut decoder = FrameDecoder::new();
    let mut buffer = [0_u8; 256];

    loop {
        if let Some(request) = decoder
            .next_frame::<Request>()
            .expect("request frame decodes")
        {
            return request;
        }

        let read = stream.read(&mut buffer).await.expect("read request bytes");
        assert_ne!(read, 0, "client closed before request arrived");
        decoder.push_bytes(&buffer[..read]);
    }
}

async fn write_response(stream: &mut tokio::io::DuplexStream, response: Response) {
    let frame = encode_frame(&response).expect("response encodes");
    stream.write_all(&frame).await.expect("write response");
    stream.flush().await.expect("flush response");
}

#[tokio::test]
async fn shutdown_negotiates_capabilities_then_waits_for_transport_close() {
    let (client_stream, mut server_stream) = tokio::io::duplex(4096);
    let rmux = Rmux::from_transport_for_test(TransportClient::spawn(client_stream), None);
    let shutdown = tokio::spawn(rmux.shutdown());

    assert!(matches!(
        read_request(&mut server_stream).await,
        Request::Handshake(_)
    ));
    write_response(
        &mut server_stream,
        Response::Handshake(HandshakeResponse::current()),
    )
    .await;

    assert!(matches!(
        read_request(&mut server_stream).await,
        Request::KillServer(KillServerRequest)
    ));
    write_response(&mut server_stream, Response::KillServer(KillServerResponse)).await;
    drop(server_stream);

    shutdown
        .await
        .expect("shutdown task")
        .expect("shutdown succeeds");
}

#[test]
fn shutdown_treats_post_ack_peer_close_states_as_clean() {
    for kind in [
        io::ErrorKind::UnexpectedEof,
        io::ErrorKind::ConnectionReset,
        io::ErrorKind::BrokenPipe,
        io::ErrorKind::NotConnected,
    ] {
        let error = RmuxError::transport("test shutdown", io::Error::from(kind));
        assert!(
            super::is_clean_shutdown_close(&error),
            "{kind:?} should be clean after KillServer ack"
        );
    }

    let timeout = RmuxError::transport("test shutdown", io::Error::from(io::ErrorKind::TimedOut));
    assert!(!super::is_clean_shutdown_close(&timeout));
}

#[tokio::test]
async fn shutdown_propagates_daemon_transport_errors() {
    let (client_stream, mut server_stream) = tokio::io::duplex(4096);
    let rmux = Rmux::from_transport_for_test(TransportClient::spawn(client_stream), None);
    let shutdown = tokio::spawn(rmux.shutdown());

    assert!(matches!(
        read_request(&mut server_stream).await,
        Request::Handshake(_)
    ));
    write_response(
        &mut server_stream,
        Response::Handshake(HandshakeResponse::current()),
    )
    .await;
    assert!(matches!(
        read_request(&mut server_stream).await,
        Request::KillServer(KillServerRequest)
    ));
    drop(server_stream);

    match shutdown
        .await
        .expect("shutdown task")
        .expect_err("must fail")
    {
        RmuxError::Transport { source, .. } => {
            assert_eq!(source.kind(), io::ErrorKind::UnexpectedEof);
        }
        error => panic!("expected transport error, got {error:?}"),
    }
}

#[tokio::test]
async fn shutdown_maps_missing_daemon_shutdown_capability_to_unsupported() {
    let (client_stream, mut server_stream) = tokio::io::duplex(4096);
    let rmux = Rmux::from_transport_for_test(TransportClient::spawn(client_stream), None);
    let shutdown = tokio::spawn(rmux.shutdown());

    assert!(matches!(
        read_request(&mut server_stream).await,
        Request::Handshake(_)
    ));
    write_response(
        &mut server_stream,
        Response::Handshake(HandshakeResponse {
            wire_version: RMUX_WIRE_VERSION,
            capabilities: vec![CAPABILITY_HANDSHAKE.to_owned()],
        }),
    )
    .await;

    match shutdown
        .await
        .expect("shutdown task")
        .expect_err("must fail")
    {
        RmuxError::Unsupported { feature, .. } => {
            assert_eq!(feature, CAPABILITY_DAEMON_SHUTDOWN);
        }
        error => panic!("expected unsupported error, got {error:?}"),
    }
}

#[tokio::test]
async fn shutdown_disarms_drop_guard_without_sending_cleanup_request() {
    let (client_stream, mut server_stream) = tokio::io::duplex(4096);
    let client = TransportClient::spawn(client_stream);
    let rmux = Rmux::from_transport_for_test(client, Some(cleanup_request()));
    let shutdown = tokio::spawn(rmux.shutdown());

    assert!(matches!(
        read_request(&mut server_stream).await,
        Request::Handshake(_)
    ));
    write_response(
        &mut server_stream,
        Response::Handshake(HandshakeResponse::current()),
    )
    .await;

    assert!(matches!(
        read_request(&mut server_stream).await,
        Request::KillServer(KillServerRequest)
    ));
    write_response(&mut server_stream, Response::KillServer(KillServerResponse)).await;
    drop(server_stream);

    shutdown
        .await
        .expect("shutdown task")
        .expect("shutdown succeeds");
}

#[tokio::test]
async fn drop_guard_cleanup_is_nonblocking_best_effort() {
    let (client_stream, mut server_stream) = tokio::io::duplex(4096);
    let client = TransportClient::spawn(client_stream);
    let rmux = Rmux::from_transport_for_test(client.clone(), Some(cleanup_request()));

    drop(rmux);

    assert_eq!(read_request(&mut server_stream).await, cleanup_request());
    write_response(
        &mut server_stream,
        Response::HasSession(HasSessionResponse { exists: true }),
    )
    .await;
}

#[tokio::test]
async fn drop_guard_does_not_panic_when_transport_is_closed() {
    let (client_stream, server_stream) = tokio::io::duplex(4096);
    let client = TransportClient::spawn(client_stream);
    drop(server_stream);

    let _ = client.request(cleanup_request()).await;
    let rmux = Rmux::from_transport_for_test(client, Some(cleanup_request()));
    drop(rmux);
}

#[tokio::test]
async fn shutdown_maps_error_response_through_protocol_diagnostics() {
    let (client_stream, mut server_stream) = tokio::io::duplex(4096);
    let rmux = Rmux::from_transport_for_test(TransportClient::spawn(client_stream), None);
    let shutdown = tokio::spawn(rmux.shutdown());

    assert!(matches!(
        read_request(&mut server_stream).await,
        Request::Handshake(_)
    ));
    write_response(
        &mut server_stream,
        Response::Error(ErrorResponse {
            error: rmux_proto::RmuxError::UnsupportedCapability {
                feature: "capability.future".to_owned(),
                supported: vec![CAPABILITY_HANDSHAKE.to_owned()],
            },
        }),
    )
    .await;

    match shutdown
        .await
        .expect("shutdown task")
        .expect_err("must fail")
    {
        RmuxError::Unsupported { feature, .. } => {
            assert_eq!(feature, "capability.future");
        }
        error => panic!("expected unsupported error, got {error:?}"),
    }
}

#[tokio::test]
async fn shutdown_maps_handshake_decode_error_to_stable_unsupported_feature() {
    let (client_stream, mut server_stream) = tokio::io::duplex(4096);
    let rmux = Rmux::from_transport_for_test(TransportClient::spawn(client_stream), None);
    let shutdown = tokio::spawn(rmux.shutdown());

    assert!(matches!(
        read_request(&mut server_stream).await,
        Request::Handshake(_)
    ));
    write_response(
        &mut server_stream,
        Response::Error(ErrorResponse {
            error: rmux_proto::RmuxError::Decode("unknown variant index 93 for Request".to_owned()),
        }),
    )
    .await;

    match shutdown
        .await
        .expect("shutdown task")
        .expect_err("must fail")
    {
        RmuxError::Unsupported { feature, .. } => {
            assert_eq!(feature, FEATURE_PROTOCOL_CAPABILITIES);
        }
        error => panic!("expected unsupported error, got {error:?}"),
    }
}
