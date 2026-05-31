//! Quickstart example: connect through the [`Rmux`] facade, ensure a session,
//! and capture the first pane snapshot.
//!
//! This example is compile-tested by `cargo build --workspace --examples`
//! and `cargo clippy --workspace --all-targets --locked`. It documents
//! the primary daemon-backed public surface.
//!
//! The example uses only types re-exported from `rmux_sdk` and does not
//! depend on `rmux-client`, `rmux-core`, `rmux-server`, or `rmux-pty`.

use std::time::Duration;

use rmux_sdk::{EnsureSession, EnsureSessionPolicy, Rmux, SessionName, TerminalSizeSpec};

#[tokio::main]
async fn main() -> rmux_sdk::Result<()> {
    let rmux = Rmux::builder()
        .default_timeout(Duration::from_secs(5))
        .connect_or_start()
        .await?;
    assert_eq!(
        rmux.configured_default_timeout(),
        Some(Duration::from_secs(5))
    );

    let session_name = SessionName::new("quickstart").expect("valid session name");
    let session = rmux
        .ensure_session(
            EnsureSession::named(session_name.clone())
                .policy(EnsureSessionPolicy::CreateOrReuse)
                .detached(true)
                .size(TerminalSizeSpec::new(120, 32))
                .window_name("main"),
        )
        .await?;

    assert!(session.exists().await?);
    let snapshot = session.pane(0, 0).snapshot().await?;
    println!(
        "quickstart connected: session={}, endpoint={:?}, snapshot={}x{}",
        session_name,
        rmux.endpoint(),
        snapshot.cols,
        snapshot.rows,
    );

    Ok(())
}
