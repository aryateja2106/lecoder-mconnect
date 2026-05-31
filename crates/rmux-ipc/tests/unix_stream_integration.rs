#![cfg(unix)]

use std::time::Duration;

use rmux_ipc::{wait_for_peer_close, LocalStream};
use tokio::io::AsyncWriteExt;
use tokio::time::timeout;

#[tokio::test]
async fn wait_for_peer_close_keeps_observing_after_buffered_bytes() -> std::io::Result<()> {
    let (server, mut client) = LocalStream::pair()?;

    let wait = tokio::spawn(async move {
        timeout(Duration::from_secs(2), wait_for_peer_close(&server))
            .await
            .expect("peer close wait timed out after buffered bytes")
    });

    client.write_all(b"buffered protocol bytes").await?;
    tokio::time::sleep(Duration::from_millis(100)).await;
    drop(client);

    wait.await.expect("peer close task")?;
    Ok(())
}
