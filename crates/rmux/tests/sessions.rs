#![cfg(unix)]

mod common;

use std::error::Error;
use std::fs;
use std::path::Path;
use std::time::{Duration, Instant};

use common::{assert_success, read_until_contains, stderr, stdout, AttachedSession, CliHarness};
use rmux_pty::TerminalSize;

const ATTACH_TIMEOUT: Duration = Duration::from_secs(5);
const NONBLOCKING_ATTACH_TIMEOUT: Duration = Duration::from_millis(500);

fn run_success_with_transient_retry(
    harness: &CliHarness,
    args: &[&str],
) -> Result<(), Box<dyn Error>> {
    let mut last_output = None;

    for _ in 0..3 {
        let output = harness.run(args)?;
        if output.status.code() == Some(0)
            && stdout(&output).is_empty()
            && stderr(&output).is_empty()
        {
            return Ok(());
        }

        let retryable = stderr(&output).contains("Resource temporarily unavailable");
        last_output = Some(output);
        if !retryable {
            break;
        }

        std::thread::sleep(Duration::from_millis(50));
    }

    assert_success(&last_output.expect("at least one command attempt for transient retry"));
    Ok(())
}

fn assert_missing_has_session(output: &std::process::Output, session_name: &str) {
    assert_eq!(output.status.code(), Some(1));
    assert!(stdout(output).is_empty());
    assert_eq!(
        stderr(output),
        format!("can't find session: {session_name}\n")
    );
}

#[test]
fn list_sessions_prints_sorted_server_rendered_stdout() -> Result<(), Box<dyn Error>> {
    let harness = CliHarness::new("list-sessions-cli")?;
    let _daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "beta", "-x", "120", "-y", "40"])?);
    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha"])?);
    assert_success(&harness.run(&["new-window", "-t", "alpha", "-d", "-n", "logs"])?);

    let listed = harness.run(&[
        "list-sessions",
        "-F",
        "#{session_name}:#{session_windows}:#{session_attached}:#{session_width}x#{session_height}",
    ])?;

    assert_eq!(listed.status.code(), Some(0));
    assert_eq!(stdout(&listed), "alpha:2:0:x\nbeta:1:0:x\n");
    assert!(stderr(&listed).is_empty());
    Ok(())
}

#[test]
fn list_sessions_supports_filter_sort_order_and_reverse() -> Result<(), Box<dyn Error>> {
    let harness = CliHarness::new("list-sessions-filter-sort")?;
    let _daemon = harness.start_hidden_daemon()?;

    for name in ["alpha", "beta", "gamma"] {
        assert_success(&harness.run(&["new-session", "-d", "-s", name])?);
    }

    let listed = harness.run(&[
        "list-sessions",
        "-f",
        "#{||:#{==:#{session_name},alpha},#{==:#{session_name},gamma}}",
        "-O",
        "index",
        "-r",
        "-F",
        "#{session_name}",
    ])?;

    assert_eq!(listed.status.code(), Some(0));
    assert_eq!(stdout(&listed), "gamma\nalpha\n");
    assert!(stderr(&listed).is_empty());
    Ok(())
}

#[test]
fn new_session_prints_formatted_session_info() -> Result<(), Box<dyn Error>> {
    let harness = CliHarness::new("new-session-print-info")?;
    let _daemon = harness.start_hidden_daemon()?;

    let created = harness.run(&[
        "new-session",
        "-d",
        "-P",
        "-F",
        "#{session_name}:#{session_width}x#{session_height}",
        "-s",
        "alpha",
        "-x",
        "120",
        "-y",
        "40",
    ])?;

    assert_eq!(created.status.code(), Some(0));
    assert_eq!(stdout(&created), "alpha:x\n");
    assert!(stderr(&created).is_empty());
    assert_success(&harness.run(&["has-session", "-t", "alpha"])?);
    Ok(())
}

#[test]
fn auto_named_sessions_follow_tmux_global_session_id_sequence() -> Result<(), Box<dyn Error>> {
    let harness = CliHarness::new("new-session-auto-id-shape")?;
    let _daemon = harness.start_hidden_daemon()?;

    for name in ["0", "1", "bob"] {
        assert_success(&harness.run(&["new-session", "-d", "-s", name])?);
    }

    let created = harness.run(&["new-session", "-d", "-P", "-F", "#{session_name}"])?;
    assert_eq!(created.status.code(), Some(0));
    assert_eq!(stdout(&created), "3\n");
    assert!(stderr(&created).is_empty());
    Ok(())
}

#[test]
fn grouped_sessions_without_explicit_name_follow_tmux_global_suffix_shape(
) -> Result<(), Box<dyn Error>> {
    let harness = CliHarness::new("grouped-session-auto-id-shape")?;
    let _daemon = harness.start_hidden_daemon()?;

    for name in ["0", "1", "bob"] {
        assert_success(&harness.run(&["new-session", "-d", "-s", name])?);
    }

    let created = harness.run(&[
        "new-session",
        "-d",
        "-P",
        "-F",
        "#{session_name}|#{session_group}|#{session_windows}",
        "-t",
        "stacy",
    ])?;
    assert_eq!(created.status.code(), Some(0));
    assert_eq!(stdout(&created), "stacy-3|stacy|1\n");
    assert!(stderr(&created).is_empty());

    let listed = harness.run(&[
        "list-sessions",
        "-F",
        "#{session_name}|#{session_group}|#{session_windows}",
    ])?;
    assert_eq!(listed.status.code(), Some(0));
    assert_eq!(stdout(&listed), "0||1\n1||1\nbob||1\nstacy-3|stacy|1\n");
    assert!(stderr(&listed).is_empty());
    Ok(())
}

#[test]
fn rename_session_updates_attached_client_tracking_and_session_local_state(
) -> Result<(), Box<dyn Error>> {
    let harness = CliHarness::new("rename-session-cli")?;
    let _daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha"])?);
    assert_success(&harness.run(&["new-session", "-d", "-s", "beta"])?);
    assert_success(&harness.run(&["set-environment", "-t", "alpha", "TERM", "screen"])?);

    let mut attach = AttachedSession::spawn(&harness, "alpha", TerminalSize::new(80, 24))?;
    attach.wait_for_raw_mode(NONBLOCKING_ATTACH_TIMEOUT)?;

    assert_success(&harness.run(&["rename-session", "-t", "alpha", "gamma"])?);

    let show_environment = harness.run(&["show-environment", "-t", "gamma", "TERM"])?;
    assert_eq!(show_environment.status.code(), Some(0));
    assert_eq!(stdout(&show_environment), "TERM=screen\n");
    assert!(stderr(&show_environment).is_empty());

    let missing_old = harness.run(&["has-session", "-t", "alpha"])?;
    assert_missing_has_session(&missing_old, "alpha");

    assert_success(&harness.run(&["has-session", "-t", "gamma"])?);

    let listed = harness.run(&["list-sessions", "-F", "#{session_name}"])?;
    assert_eq!(listed.status.code(), Some(0));
    assert_eq!(stdout(&listed), "beta\ngamma\n");
    assert!(stderr(&listed).is_empty());

    let tmux_env = format!("{},1,0", harness.socket_path().display());
    let switched = harness.run_with(&["switch-client", "-t", "beta"], |command| {
        command.env("TMUX", &tmux_env);
    })?;
    assert_success(&switched);

    assert_success(&harness.run(&[
        "send-keys",
        "-t",
        "beta:0.0",
        "printf beta-output",
        "Enter",
    ])?);
    let beta_output = read_until_contains(attach.master_mut(), "beta-output", ATTACH_TIMEOUT)?;
    assert!(beta_output.contains("beta-output"));

    assert_success(&harness.run(&["detach-client"])?);
    let status = attach.wait_for_exit(ATTACH_TIMEOUT)?;
    assert_eq!(status.code(), Some(0));
    attach.assert_restored()?;
    Ok(())
}

#[test]
fn grouped_sessions_share_windows_and_report_group_visibility() -> Result<(), Box<dyn Error>> {
    let harness = CliHarness::new("grouped-session-visibility")?;
    let _daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha"])?);
    assert_success(&harness.run(&["new-session", "-d", "-t", "alpha", "-s", "beta"])?);
    assert_success(&harness.run(&["new-window", "-t", "beta", "-d", "-n", "shared"])?);

    let listed = harness.run(&[
        "list-sessions",
        "-F",
        "#{session_name}:#{session_group}:#{session_grouped}:#{session_group_size}:#{session_windows}",
    ])?;
    assert_eq!(listed.status.code(), Some(0));
    assert_eq!(stdout(&listed), "alpha:alpha:1:2:2\nbeta:alpha:1:2:2\n");
    assert!(stderr(&listed).is_empty());

    let alpha_windows = harness.run(&[
        "list-windows",
        "-t",
        "alpha",
        "-F",
        "#{window_index}:#{window_name}",
    ])?;
    let beta_windows = harness.run(&[
        "list-windows",
        "-t",
        "beta",
        "-F",
        "#{window_index}:#{window_name}",
    ])?;
    assert_eq!(alpha_windows.status.code(), Some(0));
    assert_eq!(beta_windows.status.code(), Some(0));
    assert_eq!(stdout(&alpha_windows), stdout(&beta_windows));
    assert!(stdout(&alpha_windows).contains("1:shared"));
    Ok(())
}

#[test]
fn grouped_sessions_copy_current_and_last_window_state_on_creation() -> Result<(), Box<dyn Error>> {
    let harness = CliHarness::new("grouped-session-current-window")?;
    let _daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha"])?);
    assert_success(&harness.run(&["new-window", "-t", "alpha", "-d", "-n", "logs"])?);
    assert_success(&harness.run(&["new-window", "-t", "alpha", "-d", "-n", "shell"])?);
    assert_success(&harness.run(&["select-window", "-t", "alpha:2"])?);
    assert_success(&harness.run(&["select-window", "-t", "alpha:1"])?);
    assert_success(&harness.run(&["new-session", "-d", "-t", "alpha", "-s", "beta"])?);

    let alpha_windows = harness.run(&[
        "list-windows",
        "-t",
        "alpha",
        "-F",
        "#{window_index}:#{window_active}:#{window_last_flag}",
    ])?;
    let beta_windows = harness.run(&[
        "list-windows",
        "-t",
        "beta",
        "-F",
        "#{window_index}:#{window_active}:#{window_last_flag}",
    ])?;

    assert_eq!(alpha_windows.status.code(), Some(0));
    assert_eq!(beta_windows.status.code(), Some(0));
    assert_eq!(stdout(&alpha_windows), stdout(&beta_windows));
    assert_eq!(stdout(&beta_windows), "0:0:0\n1:1:0\n2:0:1\n");
    assert!(stderr(&alpha_windows).is_empty());
    assert!(stderr(&beta_windows).is_empty());
    Ok(())
}

#[test]
fn kill_session_only_removes_the_targeted_group_member() -> Result<(), Box<dyn Error>> {
    let harness = CliHarness::new("grouped-session-kill-member")?;
    let _daemon = harness.start_hidden_daemon()?;
    let output_path = harness.tmpdir().join("grouped-session-survivor.txt");

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha"])?);
    assert_success(&harness.run(&["new-session", "-d", "-t", "alpha", "-s", "beta"])?);
    assert_success(&harness.run(&["new-window", "-t", "beta", "-d", "-n", "shared"])?);
    assert_success(&harness.run(&["kill-session", "-t", "alp"])?);

    let missing = harness.run(&["has-session", "-t", "alpha"])?;
    assert_missing_has_session(&missing, "alpha");
    assert_success(&harness.run(&["has-session", "-t", "beta"])?);

    assert_success(&harness.run(&[
        "send-keys",
        "-t",
        "beta:1.0",
        &format!("printf survivor > {}", shell_quote(&output_path)),
        "Enter",
    ])?);
    wait_for_file_contents(&output_path, "survivor", ATTACH_TIMEOUT)?;
    Ok(())
}

#[test]
fn session_targeting_resolves_unique_prefixes_for_session_commands() -> Result<(), Box<dyn Error>> {
    let harness = CliHarness::new("session-command-prefix-targets")?;
    let _daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha"])?);
    assert_success(&harness.run(&["has-session", "-t", "alp"])?);
    assert_success(&harness.run(&["rename-session", "-t", "alp", "gamma"])?);
    assert_success(&harness.run(&["has-session", "-t", "gam"])?);
    assert_success(&harness.run(&["kill-session", "-t", "gam"])?);

    let missing = harness.run(&["has-session", "-t", "gamma"])?;
    assert_eq!(missing.status.code(), Some(1));
    assert!(stdout(&missing).is_empty());
    assert!(
        stderr(&missing).contains("no server running on "),
        "has-session after the last session is killed should report absent server, got: {}",
        stderr(&missing)
    );
    Ok(())
}

#[test]
fn kill_session_all_except_target_preserves_only_the_named_session() -> Result<(), Box<dyn Error>> {
    let harness = CliHarness::new("kill-session-all-except")?;
    let _daemon = harness.start_hidden_daemon()?;

    for name in ["alpha", "beta", "gamma"] {
        run_success_with_transient_retry(&harness, &["new-session", "-d", "-s", name])?;
    }
    run_success_with_transient_retry(&harness, &["kill-session", "-a", "-t", "beta"])?;

    for (target, status) in [("alpha", 1), ("beta", 0), ("gamma", 1)] {
        let output = harness.run(&["has-session", "-t", target])?;
        if status == 0 {
            assert_eq!(output.status.code(), Some(0));
            assert!(stdout(&output).is_empty());
            assert!(stderr(&output).is_empty());
        } else {
            assert_missing_has_session(&output, target);
        }
    }
    Ok(())
}

fn wait_for_file_contents(
    path: &Path,
    expected: &str,
    timeout: Duration,
) -> Result<(), Box<dyn Error>> {
    let deadline = Instant::now() + timeout;

    while Instant::now() < deadline {
        match fs::read_to_string(path) {
            Ok(contents) if contents == expected => return Ok(()),
            Ok(_) | Err(_) => std::thread::sleep(Duration::from_millis(25)),
        }
    }

    Err(format!("timed out waiting for '{}'", path.display()).into())
}

fn shell_quote(path: &Path) -> String {
    format!("'{}'", path.display().to_string().replace('\'', "'\\''"))
}
