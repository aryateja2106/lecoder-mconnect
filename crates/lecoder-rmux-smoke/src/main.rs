//! Smoke demo of the slice-1 integration path through `rmux-sdk`.
//!
//! This is a hand-run prototype of what `lecoder-core`'s `AgentManager`/pump will do:
//! spawn an agent (here: a shell) inside a persistent rmux session, send input, read the
//! rendered snapshot, then drop the SDK handle (simulating a `lecoder-daemon` restart) and
//! reconnect to the SAME rmux daemon — proving the session/output survive.

use std::path::PathBuf;
use std::time::Duration;

use rmux_sdk::{EnsureSession, EnsureSessionPolicy, Rmux, RmuxEndpoint, SessionName, TerminalSizeSpec};

const MARKER: &str = "SDK_HELLO_FROM_PUMP";

#[tokio::main]
async fn main() -> rmux_sdk::Result<()> {
    // Slice-1 daemon-launch contract: point the SDK at our forked rmux binary + an isolated socket.
    let daemon_bin = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../target/debug/rmux");
    let socket = std::env::temp_dir().join(format!("lecoder-sdk-smoke-{}.sock", std::process::id()));
    std::env::set_var("RMUX_SDK_DAEMON_BINARY", &daemon_bin);
    let endpoint = RmuxEndpoint::UnixSocket(socket.clone());

    println!(">>> connect_or_start: spawn forked rmux daemon");
    println!("    binary   = {}", daemon_bin.display());
    println!("    endpoint = {}", socket.display());
    let rmux = Rmux::builder()
        .default_timeout(Duration::from_secs(10))
        .endpoint(endpoint.clone())
        .connect_or_start()
        .await?;
    println!("    connected.\n");

    let name = SessionName::new("lcsdksmoke").expect("valid session name");
    println!(">>> ensure_session 'lcsdksmoke' (== AgentManager::spawn creating a persistent agent session)");
    let session = rmux
        .ensure_session(
            EnsureSession::named(name.clone())
                .policy(EnsureSessionPolicy::CreateOrReuse)
                .detached(true)
                .size(TerminalSizeSpec::new(100, 24)),
        )
        .await?;
    println!("    session exists: {}\n", session.exists().await?);

    let pane = session.pane(0, 0);
    println!(">>> send_text  (== terminal_input from the phone -> send-keys to the agent)");
    pane.send_text(&format!("echo {MARKER}\n")).await?;
    pane.wait_for_text(MARKER).await?;
    let snap = pane.snapshot().await?;
    println!("    snapshot {}x{}, {} visible lines (== source for scrollback_response)", snap.cols, snap.rows, snap.visible_lines().len());
    for line in snap.visible_lines().into_iter().filter(|l| l.contains(MARKER) && !l.contains("echo")) {
        println!("    agent output> {}", line.trim_end());
    }
    println!();

    // Simulate lecoder-daemon restart: drop the SDK handle, then reconnect to the SAME daemon.
    println!(">>> drop SDK handle  (≈ lecoder-daemon crash/restart; rmux daemon keeps the PTY)");
    drop(rmux);
    println!(">>> reconnect to the same rmux daemon and re-acquire the session");
    let rmux2 = Rmux::builder()
        .default_timeout(Duration::from_secs(10))
        .endpoint(endpoint)
        .connect()
        .await?;
    let session2 = rmux2
        .ensure_session(
            EnsureSession::named(name)
                .policy(EnsureSessionPolicy::CreateOrReuse)
                .detached(true)
                .size(TerminalSizeSpec::new(100, 24)),
        )
        .await?;
    let snap2 = session2.pane(0, 0).snapshot().await?;
    let survived = snap2.visible_lines().iter().any(|l| l.contains(MARKER));
    println!("    prior agent output present after reconnect: {survived}");
    assert!(survived, "PERSISTENCE FAILED: output lost across simulated daemon restart");

    println!("\n>>> cleanup: kill session + daemon");
    session2.kill().await.ok();
    let _ = std::process::Command::new(&daemon_bin)
        .arg("-S")
        .arg(&socket)
        .arg("kill-server")
        .output();
    println!(">>> DEMO OK — persistent agent session survived a simulated daemon restart via rmux-sdk.");
    Ok(())
}
