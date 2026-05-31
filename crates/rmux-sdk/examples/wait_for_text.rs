//! Wait-for-text example: drive `Pane::wait_for_text` to react to
//! rendered pane content.
//!
//! Compile-tested by `cargo build --workspace --examples` and
//! `cargo clippy --workspace --all-targets --locked`. Running it requires a
//! reachable RMUX daemon; `connect_or_start` keeps the example runnable
//! from a cold checkout without requiring a pre-existing daemon.
//!
//! The example uses only types re-exported from `rmux_sdk` and does not
//! depend on `rmux-client`, `rmux-core`, `rmux-server`, or `rmux-pty`.

use std::time::Duration;

use rmux_sdk::{EnsureSession, Result, Rmux, TerminalSizeSpec};

#[tokio::main]
async fn main() -> Result<()> {
    let rmux = Rmux::builder()
        .default_timeout(Duration::from_secs(10))
        .connect_or_start()
        .await?;

    // Bind to a known session via create-or-reuse semantics. The example
    // launches a short shell pane that prints a sentinel banner so the
    // wait_for_text call below has a deterministic match to land on.
    let session = rmux
        .ensure_session(
            EnsureSession::try_named(format!("rmux-sdk-wait-for-text-{}", std::process::id()))?
                .create_only()
                .size(TerminalSizeSpec::new(80, 24))
                .argv(wait_command()),
        )
        .await?;

    let pane = session.pane(0, 0);

    // Poll the rendered visible-text grid until the sentinel appears.
    // `wait_for_text` is client-side: it captures snapshots and runs them
    // through the same `PaneSnapshot::find_text` helper a caller could
    // invoke directly, so the wait observes whatever the pane has already
    // rendered when it starts.
    pane.wait_for_text("ready").await?;

    // Re-capture once the wait succeeds to inspect the matched coordinate.
    let snapshot = pane.snapshot().await?;
    if let Some(hit) = snapshot.find_text("ready") {
        println!(
            "wait_for_text matched 'ready' at row {} col {}",
            hit.start_row, hit.start_col,
        );
    }

    Ok(())
}

#[cfg(unix)]
fn wait_command() -> Vec<String> {
    vec![
        "sh".to_owned(),
        "-c".to_owned(),
        "printf 'ready\\n'; sleep 5".to_owned(),
    ]
}

#[cfg(windows)]
fn wait_command() -> Vec<String> {
    vec![
        "cmd.exe".to_owned(),
        "/D".to_owned(),
        "/C".to_owned(),
        "echo ready && ping -n 6 127.0.0.1 >NUL".to_owned(),
    ]
}
