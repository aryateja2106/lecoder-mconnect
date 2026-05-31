//! Nested-detection example: refuse to spawn an rmux client when the
//! current process is already running inside an existing rmux/tmux
//! client, and surface a stable [`Diagnostic`] instead.
//!
//! Compile-tested by `cargo build --workspace --examples` and
//! `cargo clippy --workspace --all-targets --locked`. The example reads
//! only the *presence* of the `TMUX` and `RMUX` environment variables to
//! decide whether the host is nested; their values are never printed.
//! When the host is not nested, the example contacts the daemon to read
//! identity/metadata from an [`InfoSnapshot`] — which by contract carries
//! no per-pane environment values.
//!
//! Uses only types re-exported from `rmux_sdk`. Does not depend on
//! `rmux-client`, `rmux-core`, `rmux-server`, or `rmux-pty`.

use std::env;
use std::time::Duration;

use rmux_sdk::{
    command_feature_id, Diagnostic, EnsureSession, InfoSnapshot, PaneProcessState, Result, Rmux,
    RmuxError,
};

fn detect_nested_parent() -> Option<&'static str> {
    // Only presence is observed. The value of `TMUX` / `RMUX` (the parent
    // socket path) is never read or printed.
    if env::var_os("RMUX").is_some() {
        Some("rmux")
    } else if env::var_os("TMUX").is_some() {
        Some("tmux")
    } else {
        None
    }
}

fn nested_unsupported_strings(parent: &str) -> (String, String) {
    // Compute feature id and hint once, then reuse them for both the
    // `Diagnostic` (UI surface) and the `RmuxError` (return value). This
    // keeps the example honest: there is no second source of truth for
    // the hint string, so the diagnostic the user sees and the error a
    // caller pattern-matches on always agree.
    let feature = command_feature_id("new-session.nested");
    let hint = format!(
        "refusing to create a nested rmux client inside an existing {parent} client; \
         detach the parent client first or run this binary outside its pane"
    );
    (feature, hint)
}

fn report_diagnostic(diagnostic: &Diagnostic) {
    eprintln!("nested-detection: {}", diagnostic.message());
    if let Some(feature) = diagnostic.feature() {
        eprintln!("feature: {feature}");
    }
    if let Some(hint) = diagnostic.hint() {
        eprintln!("hint: {hint}");
    }
}

fn describe_identity(snapshot: &InfoSnapshot) {
    // `PaneInfo` deliberately has no `env` / `environment` field, so this
    // identity rendering matches the public contract verbatim.
    for session in &snapshot.sessions {
        println!("session {} name={}", session.id, session.name);
    }
    for window in &snapshot.windows {
        println!(
            "  window {} index={} size={}x{}",
            window.id, window.index, window.size.cols, window.size.rows,
        );
    }
    for pane in &snapshot.panes {
        let process = match &pane.process {
            PaneProcessState::Running { pid } => format!("running pid={pid:?}"),
            PaneProcessState::Exited => "exited".to_owned(),
            PaneProcessState::Unknown => "unknown".to_owned(),
            _ => "other".to_owned(),
        };
        println!(
            "    pane {} index={} size={}x{} gen={} rev={} process={}",
            pane.id,
            pane.index,
            pane.size.cols,
            pane.size.rows,
            pane.generation,
            pane.revision,
            process,
        );
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    if let Some(parent) = detect_nested_parent() {
        let (feature, hint) = nested_unsupported_strings(parent);
        let diagnostic = Diagnostic::unsupported(&feature, &hint);
        report_diagnostic(&diagnostic);
        return Err(RmuxError::unsupported(feature, hint));
    }

    let rmux = Rmux::builder()
        .default_endpoint()
        .default_timeout(Duration::from_secs(5))
        .build();

    let ensure = EnsureSession::try_named("rmux-sdk-nested-detection")?.reuse_only();
    match rmux.ensure_session(ensure).await {
        Ok(session) => {
            let info = session.pane(0, 0).info().await?;
            describe_identity(&info);
        }
        Err(error) => {
            // Surface the SDK's stable feature/hint context instead of
            // raw lower-crate display text. No environment values leak.
            if let Some(feature) = error.feature() {
                eprintln!("rmux feature: {feature}");
            }
            if let Some(hint) = error.hint() {
                eprintln!("rmux hint: {hint}");
            }
        }
    }
    Ok(())
}
