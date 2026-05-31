//! Collect-until-exit example: gather bounded raw pane output until the
//! pane's child process exits.
//!
//! Compile-tested by `cargo build --workspace --examples` and
//! `cargo clippy --workspace --all-targets --locked`. The example shows
//! the full lifecycle for a short-lived command that returns a bounded
//! transcript: ensure the session, locate the pane, call
//! `collect_output_until_exit`, and reason about the truncation, lag, and
//! exit fields without converting raw bytes through any lossy decoder.
//!
//! Uses only types re-exported from `rmux_sdk`. Does not depend on
//! `rmux-client`, `rmux-core`, `rmux-server`, or `rmux-pty`.

use std::time::Duration;

use rmux_sdk::{EnsureSession, PaneOutputStart, PaneProcessState, Result, Rmux, TerminalSizeSpec};

const TRANSCRIPT_BUDGET_BYTES: usize = 64 * 1024;

#[tokio::main]
async fn main() -> Result<()> {
    let rmux = Rmux::builder()
        .default_timeout(Duration::from_secs(30))
        .connect_or_start()
        .await?;

    let session = rmux
        .ensure_session(
            EnsureSession::try_named(format!(
                "rmux-sdk-collect-until-exit-{}",
                std::process::id()
            ))?
            .create_only()
            .size(TerminalSizeSpec::new(80, 24))
            .argv(collect_command()),
        )
        .await?;

    let pane = session.pane(0, 0);

    // The byte budget caps the retained transcript. `collect_output_until_exit`
    // keeps waiting for pane exit even after the cap is hit, so the
    // returned `exit_state` matches the daemon's view of the child's exit
    // and `truncated` flips on if the budget was reached.
    let collected = pane
        .collect_output_until_exit_starting_at(PaneOutputStart::Oldest, TRANSCRIPT_BUDGET_BYTES)
        .await?;

    println!(
        "collected {} bytes (truncated={}, lagged={}, missed={})",
        collected.len(),
        collected.truncated,
        collected.lagged,
        collected.missed_events,
    );

    // Sticky info is the authoritative source for the post-exit state.
    // Pane environment is intentionally absent from `PaneInfo`, so the
    // example reports only identity, geometry, and exit fields here.
    let info = pane.info().await?;
    if let Some(pane_info) = info.panes.first() {
        let status = match &pane_info.process {
            PaneProcessState::Running { pid } => format!("running pid={pid:?}"),
            PaneProcessState::Exited => match &pane_info.exit_state {
                Some(exit) => format!("exited code={:?} signal={:?}", exit.code, exit.signal,),
                None => "exited (no recorded detail)".to_owned(),
            },
            PaneProcessState::Unknown => "unknown".to_owned(),
            _ => "other".to_owned(),
        };
        println!("pane {}: {}", pane_info.id, status);
    }

    Ok(())
}

#[cfg(unix)]
fn collect_command() -> Vec<String> {
    vec![
        "sh".to_owned(),
        "-c".to_owned(),
        "printf 'hello\\nworld\\n'; exit 0".to_owned(),
    ]
}

#[cfg(windows)]
fn collect_command() -> Vec<String> {
    vec![
        "cmd.exe".to_owned(),
        "/D".to_owned(),
        "/C".to_owned(),
        "echo hello&&echo world".to_owned(),
    ]
}
