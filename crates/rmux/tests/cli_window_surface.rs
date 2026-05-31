#![cfg(unix)]

mod common;

use std::error::Error;
use std::fs;
use std::path::Path;
use std::sync::{Mutex, MutexGuard, OnceLock};
use std::time::{Duration, Instant};

use common::{assert_clap_failure, assert_success, stderr, stdout, terminate_child, CliHarness};

const ATTACH_TIMEOUT: Duration = Duration::from_secs(5);

#[test]
fn new_window_detached_keeps_session_target_commands_on_the_current_window(
) -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("new-window-detached-active-window")?;
    let mut daemon = harness.start_hidden_daemon()?;
    let output_path = harness.tmpdir().join("session-target-split.txt");

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha"])?);
    assert_success(&harness.run(&["new-window", "-t", "alpha", "-d", "-n", "scratch"])?);
    assert_success(&harness.run(&["split-window", "-v", "-t", "alpha"])?);
    assert_success(&harness.run(&[
        "send-keys",
        "-t",
        "alpha:0.1",
        &format!("printf split-on-zero > {}", shell_quote(&output_path)),
        "Enter",
    ])?);

    wait_for_file_contents(&output_path, "split-on-zero", ATTACH_TIMEOUT)?;

    let missing = harness.run(&[
        "send-keys",
        "-t",
        "alpha:1.1",
        "printf should-not-exist",
        "Enter",
    ])?;
    assert_eq!(missing.status.code(), Some(1));
    assert_eq!(stderr(&missing), "can't find pane: 1\n");

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn new_window_reuses_window_zero_after_killing_it() -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("new-window-reuse-index-zero")?;
    let mut daemon = harness.start_hidden_daemon()?;
    let output_path = harness.tmpdir().join("reused-window-zero.txt");

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha"])?);
    assert_success(&harness.run(&["new-window", "-t", "alpha", "-d"])?);
    assert_success(&harness.run(&["kill-window", "-t", "alpha:0"])?);

    let missing = harness.run(&["send-keys", "-t", "alpha:0.0", "echo"])?;
    assert_eq!(missing.status.code(), Some(1));
    assert_eq!(stderr(&missing), "can't find window: 0\n");

    assert_success(&harness.run(&["new-window", "-t", "alpha", "-d", "-n", "reused"])?);
    assert_success(&harness.run(&[
        "send-keys",
        "-t",
        "alpha:0.0",
        &format!("printf reused-zero > {}", shell_quote(&output_path)),
        "Enter",
    ])?);

    wait_for_file_contents(&output_path, "reused-zero", ATTACH_TIMEOUT)?;

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn unlink_window_missing_target_uses_tmux_window_lookup_error() -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("unlink-window-missing-target")?;
    let mut daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha"])?);
    let output = harness.run(&["unlink-window", "-k", "-t", "alpha:6"])?;

    assert_eq!(output.status.code(), Some(1));
    assert!(stdout(&output).is_empty(), "stdout should be empty");
    assert!(
        stderr(&output).contains("can't find window: 6"),
        "stderr should match tmux window lookup failure, got: {}",
        stderr(&output)
    );

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn detached_queue_bare_window_target_uses_latest_session_context() -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("detached-queue-latest-target-context")?;
    let mut daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "0", "-n", "shell"])?);
    assert_success(&harness.run(&["new-session", "-d", "-s", "1", "-n", "one"])?);
    assert_success(&harness.run(&["new-session", "-d", "-s", "bob", "-n", "bobwin"])?);

    let output = harness.run(&[
        "display-message",
        "-p",
        "-t",
        "0",
        "#{session_name}:#{window_index}:#{window_name}",
    ])?;

    assert_eq!(output.status.code(), Some(0));
    assert_eq!(stdout(&output), "bob:0:bobwin\n");
    assert!(stderr(&output).is_empty());

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn send_keys_literal_flag_sends_text_without_leaking_the_flag() -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("send-keys-literal")?;
    let mut daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha", "cat"])?);
    assert_success(&harness.run(&["send-keys", "-t", "alpha:0.0", "-l", "Enter"])?);
    assert_success(&harness.run(&["send-keys", "-t", "alpha:0.0", "Enter"])?);

    let deadline = Instant::now() + ATTACH_TIMEOUT;
    loop {
        let captured = harness.run(&["capture-pane", "-p", "-t", "alpha:0.0", "-S", "-5"])?;
        assert_eq!(captured.status.code(), Some(0));
        let output = stdout(&captured);
        if output.contains("Enter") {
            assert!(
                !output.contains("-lEnter"),
                "literal flag leaked into pane output: {output:?}"
            );
            break;
        }
        assert!(
            Instant::now() < deadline,
            "literal send-keys output did not appear, capture={output:?}"
        );
        std::thread::sleep(Duration::from_millis(20));
    }

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn split_window_default_and_horizontal_flag_match_tmux_geometry() -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("split-window-direction-geometry")?;
    let mut daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha", "-x", "120", "-y", "40"])?);
    assert_success(&harness.run(&["split-window", "-t", "alpha"])?);
    let default_split = harness.run(&[
        "list-panes",
        "-t",
        "alpha",
        "-F",
        "#{pane_index}:#{pane_width}x#{pane_height}:#{pane_left},#{pane_top}",
    ])?;
    assert_eq!(default_split.status.code(), Some(0));
    assert_eq!(stdout(&default_split), "0:120x20:0,0\n1:120x19:0,21\n");
    assert!(stderr(&default_split).is_empty());

    assert_success(&harness.run(&["new-session", "-d", "-s", "beta", "-x", "120", "-y", "40"])?);
    assert_success(&harness.run(&["split-window", "-h", "-t", "beta"])?);
    let horizontal_split = harness.run(&[
        "list-panes",
        "-t",
        "beta",
        "-F",
        "#{pane_index}:#{pane_width}x#{pane_height}:#{pane_left},#{pane_top}",
    ])?;
    assert_eq!(horizontal_split.status.code(), Some(0));
    assert_eq!(stdout(&horizontal_split), "0:60x40:0,0\n1:59x40:61,0\n");
    assert!(stderr(&horizontal_split).is_empty());

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn split_window_reports_no_space_for_new_pane_like_tmux() -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("split-window-no-space")?;
    let mut daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha", "-x", "20", "-y", "5"])?);
    assert_success(&harness.run(&["split-window", "-v", "-t", "alpha:0.0"])?);

    let output = harness.run(&["split-window", "-v", "-t", "alpha:0.1"])?;
    assert_eq!(output.status.code(), Some(1));
    assert!(stdout(&output).is_empty(), "stdout should be empty");
    assert_eq!(stderr(&output), "no space for new pane\n");

    let panes = harness.run(&["list-panes", "-t", "alpha", "-F", "#{pane_index}"])?;
    assert_eq!(panes.status.code(), Some(0));
    assert_eq!(stdout(&panes), "0\n1\n");

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn split_window_accepts_shell_command_for_new_pane() -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("split-window-command")?;
    let mut daemon = harness.start_hidden_daemon()?;
    let output_path = harness.tmpdir().join("split-command.txt");

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha"])?);
    assert_success(&harness.run(&[
        "split-window",
        "-t",
        "alpha",
        "sh",
        "-c",
        &format!("printf split-command > {}", shell_quote(&output_path)),
    ])?);

    wait_for_file_contents(&output_path, "split-command", ATTACH_TIMEOUT)?;

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn list_windows_keeps_stored_window_name_while_reporting_active_pane_command(
) -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("list-windows-stored-name-active-pane-command")?;
    let mut daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&[
        "new-session",
        "-d",
        "-s",
        "alpha",
        "-n",
        "rmux",
        "-x",
        "80",
        "-y",
        "24",
        "sh",
        "-c",
        "exec cat",
    ])?);

    let deadline = Instant::now() + ATTACH_TIMEOUT;
    loop {
        let listed = harness.run(&[
            "list-windows",
            "-t",
            "alpha",
            "-F",
            "#{window_name}:#{pane_current_command}",
        ])?;
        assert_eq!(listed.status.code(), Some(0));
        if stdout(&listed) == "rmux:cat\n" {
            break;
        }
        assert!(
            Instant::now() < deadline,
            "list-windows did not converge to stored window name plus active pane command: {:?}",
            stdout(&listed)
        );
        std::thread::sleep(Duration::from_millis(20));
    }

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn new_session_command_sets_initial_automatic_window_name() -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("new-session-command-window-name")?;
    let mut daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&[
        "new-session",
        "-d",
        "-s",
        "alpha",
        "-x",
        "80",
        "-y",
        "24",
        "cat",
    ])?);

    let deadline = Instant::now() + ATTACH_TIMEOUT;
    loop {
        let listed = harness.run(&[
            "list-windows",
            "-t",
            "alpha",
            "-F",
            "#{window_name}:#{pane_current_command}",
        ])?;
        assert_eq!(listed.status.code(), Some(0));
        if stdout(&listed) == "cat:cat\n" {
            break;
        }
        assert!(
            Instant::now() < deadline,
            "new-session command did not converge to command window name: {:?}",
            stdout(&listed)
        );
        std::thread::sleep(Duration::from_millis(20));
    }

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn pane_directional_selection_resize_delta_and_cross_window_join_match_tmux_forms(
) -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("pane-direction-resize-join")?;
    let mut daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha", "-x", "100", "-y", "30"])?);
    assert_success(&harness.run(&["split-window", "-h", "-t", "alpha:0.0"])?);
    assert_success(&harness.run(&["select-pane", "-t", "alpha:0.0"])?);
    assert_success(&harness.run(&["select-pane", "-R", "-t", "alpha:0.0"])?);

    let active = harness.run(&[
        "list-panes",
        "-t",
        "alpha:0",
        "-F",
        "#{pane_index}:#{pane_active}",
    ])?;
    assert_eq!(active.status.code(), Some(0));
    assert_eq!(stdout(&active), "0:0\n1:1\n");

    assert_success(&harness.run(&["resize-pane", "-R", "-t", "alpha:0.1", "5"])?);
    assert_success(&harness.run(&["break-pane", "-d", "-s", "alpha:0.1", "-t", "alpha:3"])?);
    assert_success(&harness.run(&["join-pane", "-h", "-s", "alpha:3.0", "-t", "alpha:0.0"])?);

    let windows = harness.run(&[
        "list-windows",
        "-t",
        "alpha",
        "-F",
        "#{window_index}:#{window_panes}",
    ])?;
    assert_eq!(windows.status.code(), Some(0));
    assert_eq!(stdout(&windows), "0:2\n");

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn advanced_target_forms_resolve_through_the_server_like_tmux() -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("advanced-target-forms")?;
    let mut daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha", "-n", "zero"])?);
    assert_success(&harness.run(&["new-window", "-d", "-t", "alpha:1", "-n", "one"])?);
    assert_success(&harness.run(&["new-window", "-d", "-t", "alpha:2", "-n", "two"])?);
    assert_success(&harness.run(&["select-window", "-t", "alpha:1"])?);
    assert_success(&harness.run(&["select-window", "-t", "alpha:+"])?);
    assert_success(&harness.run(&["select-window", "-t", "alpha:-"])?);
    assert_success(&harness.run(&["select-window", "-t", "alpha:{last}"])?);
    assert_success(&harness.run(&["select-window", "-t", "alpha:{start}"])?);
    assert_success(&harness.run(&["select-window", "-t", "alpha:tw"])?);

    assert_success(&harness.run(&["split-window", "-h", "-t", "alpha:two"])?);
    assert_success(&harness.run(&["split-window", "-v", "-t", "alpha:two.0"])?);
    assert_success(&harness.run(&["select-pane", "-t", "alpha:two.{bottom}"])?);
    assert_success(&harness.run(&["select-pane", "-t", "alpha:two.{left-of}"])?);
    assert_success(&harness.run(&["select-pane", "-t", "alpha:two.{right-of}"])?);

    let active = harness.run(&[
        "display-message",
        "-p",
        "-t",
        "alpha:",
        "#{window_index}:#{window_name}:#{pane_index}",
    ])?;
    assert_eq!(active.status.code(), Some(0));
    assert_eq!(stdout(&active), "2:two:1\n");
    assert!(stderr(&active).is_empty());

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn join_pane_horizontal_flag_splits_target_left_right_like_tmux() -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("join-pane-horizontal-geometry")?;
    let mut daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha", "-x", "80", "-y", "24"])?);
    assert_success(&harness.run(&["split-window", "-h", "-t", "alpha:0.0"])?);
    assert_success(&harness.run(&["break-pane", "-d", "-s", "alpha:0.1", "-t", "alpha:2"])?);
    assert_success(&harness.run(&["join-pane", "-h", "-s", "alpha:2.0", "-t", "alpha:0.0"])?);

    let panes = harness.run(&[
        "list-panes",
        "-t",
        "alpha:0",
        "-F",
        "#{pane_index}:#{pane_width}x#{pane_height}:#{pane_left},#{pane_top}",
    ])?;
    assert_eq!(panes.status.code(), Some(0));
    assert_eq!(stdout(&panes), "0:40x24:0,0\n1:39x24:41,0\n");

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn resize_pane_width_targets_the_addressed_non_main_pane() -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("resize-pane-targeted-width")?;
    let mut daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha", "-x", "100", "-y", "40"])?);
    assert_success(&harness.run(&["split-window", "-h", "-t", "alpha"])?);
    assert_success(&harness.run(&["split-window", "-v", "-t", "alpha:0.1"])?);
    assert_success(&harness.run(&["resize-pane", "-t", "alpha:0.1", "-x", "34"])?);

    let listed = harness.run(&[
        "list-panes",
        "-t",
        "alpha",
        "-F",
        "#{pane_index}:#{pane_width}x#{pane_height}:#{pane_left},#{pane_top}",
    ])?;
    assert_eq!(listed.status.code(), Some(0));
    assert_eq!(
        stdout(&listed),
        "0:65x40:0,0\n1:34x20:66,0\n2:34x19:66,21\n"
    );
    assert!(stderr(&listed).is_empty());

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn window_navigation_wraps_and_list_windows_prints_server_rendered_stdout(
) -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("window-navigation-and-listing")?;
    let mut daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha"])?);
    assert_success(&harness.run(&["new-window", "-t", "alpha", "-d", "-n", "logs"])?);
    assert_success(&harness.run(&["new-window", "-t", "alpha", "-d", "-n", "shell"])?);

    assert_success(&harness.run(&["next-window", "-t", "alpha"])?);
    assert_success(&harness.run(&["previous-window", "-t", "alpha"])?);
    assert_success(&harness.run(&["last-window", "-t", "alpha"])?);

    let window_zero_label = harness.run(&[
        "display-message",
        "-p",
        "-t",
        "alpha:0",
        "#{window_name}#{window_raw_flags}",
    ])?;
    assert_eq!(window_zero_label.status.code(), Some(0));

    let listed = harness.run(&["list-windows", "-t", "alpha"])?;
    assert_eq!(listed.status.code(), Some(0));
    assert_eq!(
        stdout(&listed),
        format!(
            concat!(
                "0: {} (1 panes) [80x24]\n",
                "1: logs* (1 panes) [80x24]\n",
                "2: shell (1 panes) [80x24]\n",
            ),
            stdout(&window_zero_label).trim_end(),
        )
    );
    assert!(stderr(&listed).is_empty());

    let formatted = harness.run(&[
        "list-windows",
        "-t",
        "alpha",
        "-F",
        "#{session_name}:#{window_index}:#{window_id}:#{window_last_flag}:#{window_active}",
    ])?;
    assert_eq!(formatted.status.code(), Some(0));
    assert_eq!(
        stdout(&formatted),
        "alpha:0:@0:1:0\nalpha:1:@1:0:1\nalpha:2:@2:0:0\n"
    );
    assert!(stderr(&formatted).is_empty());

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn single_window_navigation_errors_use_bare_tmux_messages() -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("single-window-navigation-errors")?;
    let mut daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha"])?);

    for (command, expected) in [
        ("next-window", "no next window\n"),
        ("previous-window", "no previous window\n"),
        ("last-window", "no last window\n"),
    ] {
        let output = harness.run(&[command, "-t", "alpha"])?;
        assert_eq!(output.status.code(), Some(1), "{command} should fail");
        assert!(
            stdout(&output).is_empty(),
            "{command} should not print stdout"
        );
        assert_eq!(
            stderr(&output),
            expected,
            "{command} stderr should match tmux"
        );
    }

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn binary_roundtrip_covers_the_public_window_command_surface() -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("public-window-command-roundtrip")?;
    let mut daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha", "-x", "200", "-y", "50"])?);
    assert_success(&harness.run(&["has-session", "-t", "alpha"])?);
    assert_success(&harness.run(&["new-window", "-t", "alpha", "-d", "-n", "logs"])?);
    assert_success(&harness.run(&["select-window", "-t", "alpha:1"])?);
    assert_success(&harness.run(&["rename-window", "-t", "alpha:1", "renamed"])?);
    assert_success(&harness.run(&["previous-window", "-t", "alpha"])?);
    assert_success(&harness.run(&["last-window", "-t", "alpha"])?);
    assert_success(&harness.run(&["next-window", "-t", "alpha"])?);
    let listed = harness.run(&["list-windows", "-t", "alpha"])?;
    assert_eq!(listed.status.code(), Some(0));
    assert!(stdout(&listed).contains("renamed-"));
    assert!(stderr(&listed).is_empty());
    assert_success(&harness.run(&["split-window", "-v", "-t", "alpha"])?);
    assert_success(&harness.run(&["split-window", "-h", "-t", "alpha:0.1"])?);
    assert_success(&harness.run(&["select-layout", "-t", "alpha:0", "main-vertical"])?);
    assert_success(&harness.run(&["select-layout", "-t", "alpha:0", "main-horizontal"])?);
    assert_success(&harness.run(&["select-layout", "-t", "alpha:0", "tiled"])?);
    assert_success(&harness.run(&["next-layout", "-t", "alpha:0"])?);
    assert_success(&harness.run(&["previous-layout", "-t", "alpha:0"])?);
    assert_success(&harness.run(&["resize-pane", "-t", "alpha:0.0", "-x", "34"])?);
    assert_success(&harness.run(&["resize-pane", "-t", "alpha:0.1", "-Z"])?);
    assert_success(&harness.run(&["select-pane", "-t", "alpha:0.1"])?);
    assert_success(&harness.run(&["send-keys", "-t", "alpha:0.1", "echo", "Enter"])?);
    assert_success(&harness.run(&["kill-pane", "-t", "alpha:0.2"])?);
    assert_success(&harness.run(&["new-window", "-t", "alpha", "-d", "-n", "scratch"])?);
    assert_success(&harness.run(&["move-window", "-s", "alpha:2", "-t", "alpha:4"])?);
    assert_success(&harness.run(&["swap-window", "-s", "alpha:1", "-t", "alpha:4"])?);
    assert_success(&harness.run(&["rotate-window", "-t", "alpha:0"])?);
    assert_success(&harness.run(&["move-window", "-r", "-t", "alpha"])?);
    assert_success(&harness.run(&["set-option", "-g", "status", "off"])?);
    assert_success(&harness.run(&["set-option", "-as", "terminal-features", "screen-256color"])?);
    assert_success(&harness.run(&[
        "set-window-option",
        "-t",
        "alpha:0",
        "pane-border-style",
        "fg=colour1",
    ])?);
    assert_success(&harness.run(&["set-environment", "-t", "alpha", "TERM", "screen"])?);
    assert_success(&harness.run(&["set-hook", "-g", "client-attached", "true"])?);
    assert_success(&harness.run(&["kill-window", "-t", "alpha:1"])?);
    assert_success(&harness.run(&["kill-session", "-t", "alpha"])?);

    let has_after_kill = harness.run(&["has-session", "-t", "alpha"])?;
    assert_eq!(has_after_kill.status.code(), Some(1));
    assert!(stdout(&has_after_kill).is_empty());
    assert!(
        stderr(&has_after_kill).contains("no server running on "),
        "has-session after the last session is killed should report absent server, got: {}",
        stderr(&has_after_kill)
    );

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn link_window_shares_runtime_and_updates_linked_formats() -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("link-window-runtime-share")?;
    let mut daemon = harness.start_hidden_daemon()?;
    let output_path = harness.tmpdir().join("linked-runtime.txt");

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha"])?);
    assert_success(&harness.run(&["new-session", "-d", "-s", "beta"])?);
    assert_success(&harness.run(&["link-window", "-s", "alpha:0", "-t", "beta:1"])?);
    assert_success(&harness.run(&[
        "send-keys",
        "-t",
        "beta:1.0",
        &format!("printf linked-runtime > {}", shell_quote(&output_path)),
        "Enter",
    ])?);

    wait_for_file_contents(&output_path, "linked-runtime", ATTACH_TIMEOUT)?;

    assert_success(&harness.run(&["rename-window", "-t", "beta:1", "logs"])?);

    let linked = harness.run(&[
        "display-message",
        "-p",
        "-t",
        "alpha:0",
        "#{window_name}:#{window_linked}:#{window_linked_sessions}:#{window_linked_sessions_list}",
    ])?;
    assert_eq!(linked.status.code(), Some(0));
    assert_eq!(stdout(&linked), "logs:1:2:alpha,beta\n");
    assert!(stderr(&linked).is_empty());

    assert_success(&harness.run(&["unlink-window", "-t", "beta:1"])?);

    let missing = harness.run(&[
        "send-keys",
        "-t",
        "beta:1.0",
        "printf should-not-exist",
        "Enter",
    ])?;
    assert_eq!(missing.status.code(), Some(1));
    assert_eq!(stderr(&missing), "can't find window: 1\n");

    let unlinked = harness.run(&[
        "display-message",
        "-p",
        "-t",
        "alpha:0",
        "#{window_name}:#{window_linked}:#{window_linked_sessions}:#{window_linked_sessions_list}",
    ])?;
    assert_eq!(unlinked.status.code(), Some(0));
    assert_eq!(stdout(&unlinked), "logs:0:1:alpha\n");
    assert!(stderr(&unlinked).is_empty());

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn swap_window_with_linked_slot_resizes_the_link_runtime_owner() -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("swap-window-linked-slot")?;
    let mut daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha", "-n", "alpha"])?);
    assert_success(&harness.run(&["new-session", "-d", "-s", "beta", "-n", "beta"])?);
    assert_success(&harness.run(&["link-window", "-s", "alpha:0", "-t", "beta:1"])?);
    assert_success(&harness.run(&["swap-window", "-s", "beta:1", "-t", "beta:0"])?);

    let beta_windows = harness.run(&[
        "list-windows",
        "-t",
        "beta",
        "-F",
        "#{window_index}:#{window_name}:#{window_active}:#{window_flags}",
    ])?;
    assert_eq!(beta_windows.status.code(), Some(0));
    assert_eq!(stdout(&beta_windows), "0:alpha:0:-\n1:beta:1:*\n");
    assert!(stderr(&beta_windows).is_empty());

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn link_window_position_detached_and_kill_flags_control_slot_selection(
) -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("link-window-flag-surface")?;
    let mut daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha"])?);
    assert_success(&harness.run(&["rename-window", "-t", "alpha:0", "source"])?);

    assert_success(&harness.run(&["new-session", "-d", "-s", "beta"])?);
    assert_success(&harness.run(&["rename-window", "-t", "beta:0", "keep0"])?);
    assert_success(&harness.run(&["new-window", "-t", "beta", "-d", "-n", "keep1"])?);
    assert_success(&harness.run(&["select-window", "-t", "beta:0"])?);
    assert_success(&harness.run(&["link-window", "-a", "-d", "-s", "alpha:0", "-t", "beta:0"])?);

    let beta_windows = harness.run(&[
        "list-windows",
        "-t",
        "beta",
        "-F",
        "#{window_index}:#{window_name}:#{window_active}",
    ])?;
    assert_eq!(beta_windows.status.code(), Some(0));
    assert_eq!(stdout(&beta_windows), "0:keep0:1\n1:source:0\n2:keep1:0\n");
    assert!(stderr(&beta_windows).is_empty());

    let source_id = harness.run(&["display-message", "-p", "-t", "alpha:0", "#{window_id}"])?;
    let beta_link_id = harness.run(&["display-message", "-p", "-t", "beta:1", "#{window_id}"])?;
    assert_eq!(source_id.status.code(), Some(0));
    assert_eq!(beta_link_id.status.code(), Some(0));
    assert_eq!(stdout(&source_id), stdout(&beta_link_id));

    assert_success(&harness.run(&["new-session", "-d", "-s", "gamma"])?);
    assert_success(&harness.run(&["rename-window", "-t", "gamma:0", "anchor"])?);
    assert_success(&harness.run(&["new-window", "-t", "gamma", "-d", "-n", "victim"])?);
    assert_success(&harness.run(&["select-window", "-t", "gamma:0"])?);
    assert_success(&harness.run(&["link-window", "-d", "-k", "-s", "alpha:0", "-t", "gamma:1"])?);

    let gamma_windows = harness.run(&[
        "list-windows",
        "-t",
        "gamma",
        "-F",
        "#{window_index}:#{window_name}:#{window_active}",
    ])?;
    assert_eq!(gamma_windows.status.code(), Some(0));
    assert_eq!(stdout(&gamma_windows), "0:anchor:1\n1:source:0\n");
    assert!(stderr(&gamma_windows).is_empty());

    let gamma_link_id = harness.run(&["display-message", "-p", "-t", "gamma:1", "#{window_id}"])?;
    assert_eq!(gamma_link_id.status.code(), Some(0));
    assert_eq!(stdout(&source_id), stdout(&gamma_link_id));

    assert_success(&harness.run(&["new-session", "-d", "-s", "delta"])?);
    assert_success(&harness.run(&["rename-window", "-t", "delta:0", "keep0"])?);
    assert_success(&harness.run(&["new-window", "-t", "delta", "-d", "-n", "keep1"])?);
    assert_success(&harness.run(&["select-window", "-t", "delta:0"])?);
    assert_success(&harness.run(&["link-window", "-b", "-d", "-s", "alpha:0", "-t", "delta:1"])?);

    let delta_windows = harness.run(&[
        "list-windows",
        "-t",
        "delta",
        "-F",
        "#{window_index}:#{window_name}:#{window_active}",
    ])?;
    assert_eq!(delta_windows.status.code(), Some(0));
    assert_eq!(stdout(&delta_windows), "0:keep0:1\n1:source:0\n2:keep1:0\n");
    assert!(stderr(&delta_windows).is_empty());

    let delta_link_id = harness.run(&["display-message", "-p", "-t", "delta:1", "#{window_id}"])?;
    assert_eq!(delta_link_id.status.code(), Some(0));
    assert_eq!(stdout(&source_id), stdout(&delta_link_id));

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn kill_pane_of_last_pane_destroys_the_window_and_updates_session_targets(
) -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("kill-pane-destroys-window")?;
    let mut daemon = harness.start_hidden_daemon()?;
    let output_path = harness.tmpdir().join("kill-pane-fallback.txt");

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha"])?);
    assert_success(&harness.run(&["new-window", "-t", "alpha", "-d", "-n", "scratch"])?);
    assert_success(&harness.run(&["select-window", "-t", "alpha:1"])?);
    std::thread::sleep(Duration::from_millis(25));
    assert_success(&harness.run(&["kill-pane", "-t", "alpha:1.0"])?);

    let listed = harness.run(&[
        "list-windows",
        "-t",
        "alpha",
        "-F",
        "#{window_index}:#{window_active}:#{window_panes}",
    ])?;
    assert_eq!(listed.status.code(), Some(0));
    assert_eq!(stdout(&listed), "0:1:1\n");
    assert!(stderr(&listed).is_empty());

    assert_success(&harness.run(&["split-window", "-v", "-t", "alpha"])?);
    assert_success(&harness.run(&[
        "send-keys",
        "-t",
        "alpha:0.1",
        &format!("printf fallback-pane > {}", shell_quote(&output_path)),
        "Enter",
    ])?);

    wait_for_file_contents(&output_path, "fallback-pane", ATTACH_TIMEOUT)?;

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn kill_pane_missing_target_uses_tmux_pane_lookup_error() -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("kill-pane-missing-pane-error")?;
    let mut daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha"])?);

    let missing = harness.run(&["kill-pane", "-t", "alpha:0.99"])?;
    assert_eq!(missing.status.code(), Some(1));
    assert_eq!(stderr(&missing), "can't find pane: 99\n");
    assert!(stdout(&missing).is_empty());

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn display_panes_target_without_attached_client_uses_tmux_client_lookup_error(
) -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("display-panes-missing-client-error")?;
    let mut daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha"])?);

    let missing = harness.run(&["display-panes", "-t", "alpha:0"])?;
    assert_eq!(missing.status.code(), Some(1));
    assert_eq!(stderr(&missing), "can't find client: alpha:0\n");
    assert!(stdout(&missing).is_empty());

    let trailing_colon = harness.run(&["display-panes", "-t", "alpha:"])?;
    assert_eq!(trailing_colon.status.code(), Some(1));
    assert_eq!(stderr(&trailing_colon), "can't find client: alpha\n");
    assert!(stdout(&trailing_colon).is_empty());

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn new_window_after_and_before_insert_like_tmux() -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("new-window-after-before")?;
    let mut daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha", "-n", "zero"])?);
    assert_success(&harness.run(&["new-window", "-d", "-n", "one", "-t", "alpha:1"])?);
    assert_success(&harness.run(&["new-window", "-d", "-n", "five", "-t", "alpha:5"])?);
    assert_success(&harness.run(&[
        "new-window",
        "-d",
        "-a",
        "-t",
        "alpha:1",
        "-n",
        "after-one",
    ])?);
    assert_success(&harness.run(&[
        "new-window",
        "-d",
        "-b",
        "-t",
        "alpha:5",
        "-n",
        "before-five",
    ])?);

    let windows = harness.run(&[
        "list-windows",
        "-t",
        "alpha",
        "-F",
        "#{window_index}:#{window_name}",
    ])?;
    assert_eq!(windows.status.code(), Some(0));
    assert_eq!(
        stdout(&windows),
        "0:zero\n1:one\n2:after-one\n5:before-five\n6:five\n"
    );
    assert!(stderr(&windows).is_empty());

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn move_window_reindex_without_target_uses_current_session() -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("move-window-reindex-current-session")?;
    let mut daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha", "-n", "alpha0"])?);
    assert_success(&harness.run(&["new-window", "-d", "-t", "alpha", "-n", "alpha5"])?);
    assert_success(&harness.run(&["move-window", "-s", "alpha:1", "-t", "alpha:5"])?);
    assert_success(&harness.run(&["new-session", "-d", "-s", "beta", "-n", "beta0"])?);
    assert_success(&harness.run(&["new-window", "-d", "-t", "beta", "-n", "beta5"])?);
    assert_success(&harness.run(&["move-window", "-s", "beta:1", "-t", "beta:5"])?);

    assert_success(&harness.run(&["move-window", "-r"])?);

    let alpha = harness.run(&[
        "list-windows",
        "-t",
        "alpha",
        "-F",
        "#{window_index}:#{window_name}",
    ])?;
    let beta = harness.run(&[
        "list-windows",
        "-t",
        "beta",
        "-F",
        "#{window_index}:#{window_name}",
    ])?;
    assert_eq!(stdout(&alpha), "0:alpha0\n5:alpha5\n");
    assert_eq!(stdout(&beta), "0:beta0\n1:beta5\n");

    assert_success(&harness.run(&["move-window", "-r", "-t", "alpha:"])?);
    let alpha = harness.run(&[
        "list-windows",
        "-t",
        "alpha",
        "-F",
        "#{window_index}:#{window_name}",
    ])?;
    assert_eq!(stdout(&alpha), "0:alpha0\n1:alpha5\n");

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn new_window_target_window_index_creates_at_requested_index() -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("new-window-target-index")?;
    let mut daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha", "-n", "zero"])?);
    assert_success(&harness.run(&["new-window", "-d", "-t", "alpha:5", "-n", "five"])?);

    let windows = harness.run(&[
        "list-windows",
        "-t",
        "alpha",
        "-F",
        "#{window_index}:#{window_name}",
    ])?;
    assert_eq!(windows.status.code(), Some(0));
    assert_eq!(stdout(&windows), "0:zero\n5:five\n");
    assert!(stderr(&windows).is_empty());

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn swap_window_preserves_explicit_window_names_after_auto_rename_tracking(
) -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("swap-window-explicit-name")?;
    let mut daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha"])?);
    assert_success(&harness.run(&["new-window", "-d", "-t", "alpha:2", "-n", "two"])?);
    assert_success(&harness.run(&[
        "new-window",
        "-d",
        "-b",
        "-t",
        "alpha:2",
        "-n",
        "before-two",
    ])?);
    assert_success(&harness.run(&["swap-window", "-s", "alpha:0", "-t", "alpha:2"])?);

    let windows = harness.run(&[
        "list-windows",
        "-t",
        "alpha",
        "-F",
        "#{window_index}:#{window_name}",
    ])?;
    assert_eq!(windows.status.code(), Some(0));
    assert_shell_window_names(
        &stdout(&windows),
        &[
            "0:before-two\n2:bash\n3:two\n",
            "0:before-two\n2:zsh\n3:two\n",
        ],
    );
    assert!(stderr(&windows).is_empty());

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn select_layout_rejects_mirrored_layout_names_like_tmux() -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("select-layout-mirrored-rejected")?;
    let mut daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha"])?);
    let output = harness.run(&["select-layout", "-t", "alpha:0", "main-horizontal-mirrored"])?;

    assert_eq!(output.status.code(), Some(1));
    assert!(stdout(&output).is_empty());
    assert_eq!(
        stderr(&output),
        "invalid layout: main-horizontal-mirrored\n"
    );

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn select_layout_uses_window_main_pane_size_options_like_tmux() -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("select-layout-main-pane-size-options")?;
    let mut daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha", "-x", "120", "-y", "35"])?);
    assert_success(&harness.run(&["split-window", "-h", "-t", "alpha:0"])?);
    assert_success(&harness.run(&[
        "set-window-option",
        "-t",
        "alpha:0",
        "main-pane-width",
        "90",
    ])?);
    assert_success(&harness.run(&[
        "set-window-option",
        "-t",
        "alpha:0",
        "main-pane-height",
        "10",
    ])?);

    assert_success(&harness.run(&["select-layout", "-t", "alpha:0", "main-vertical"])?);
    let vertical = harness.run(&[
        "list-panes",
        "-t",
        "alpha:0",
        "-F",
        "#{pane_index}:#{pane_left},#{pane_width}",
    ])?;
    assert_eq!(vertical.status.code(), Some(0));
    assert_eq!(stdout(&vertical), "0:0,90\n1:91,29\n");

    assert_success(&harness.run(&["select-layout", "-t", "alpha:0", "main-horizontal"])?);
    let horizontal = harness.run(&[
        "list-panes",
        "-t",
        "alpha:0",
        "-F",
        "#{pane_index}:#{pane_top},#{pane_height}",
    ])?;
    assert_eq!(horizontal.status.code(), Some(0));
    assert_eq!(stdout(&horizontal), "0:0,10\n1:11,24\n");

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn kill_pane_all_except_keeps_target_and_removes_other_panes() -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("kill-pane-all-except")?;
    let mut daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha", "-x", "100", "-y", "30"])?);
    assert_success(&harness.run(&["split-window", "-h", "-t", "alpha:0.0"])?);
    assert_success(&harness.run(&["split-window", "-v", "-t", "alpha:0.1"])?);
    assert_success(&harness.run(&["kill-pane", "-a", "-t", "alpha:0.0"])?);

    let panes = harness.run(&[
        "list-panes",
        "-t",
        "alpha:0",
        "-F",
        "#{pane_index}:#{pane_active}:#{pane_left},#{pane_top},#{pane_width}x#{pane_height}",
    ])?;
    assert_eq!(panes.status.code(), Some(0));
    assert_eq!(stdout(&panes), "0:1:0,0,100x30\n");
    assert!(stderr(&panes).is_empty());

    let single = harness.run(&["kill-pane", "-a", "-t", "alpha:0.0"])?;
    assert_eq!(single.status.code(), Some(0));
    assert!(stdout(&single).is_empty());
    assert!(stderr(&single).is_empty());

    terminate_child(daemon.child_mut())?;
    Ok(())
}

#[test]
fn unsupported_window_command_flags_fail_before_server_contact() -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("unsupported-window-command-flags")?;

    for args in [
        &["new-window", "-t", "alpha", "-P"][..],
        &["new-window", "-t", "alpha", "echo"][..],
        &["select-window", "-t", "alpha:0", "-l"][..],
        &["select-window", "-t", "alpha:0", "-n"][..],
        &["next-window", "-a", "-t", "alpha"][..],
        &["previous-window", "-a", "-t", "alpha"][..],
        &["list-windows", "-a", "-t", "alpha"][..],
        &["move-window", "-a", "-s", "alpha:0", "-t", "alpha:1"][..],
        &["move-window", "-b", "-s", "alpha:0", "-t", "alpha:1"][..],
        &["swap-window", "-a", "-s", "alpha:0", "-t", "alpha:1"][..],
        &["rename-window", "-t", "alpha:0", "logs", "extra"][..],
    ] {
        let output = harness.run(args)?;
        assert_clap_failure(&output);
        assert!(
            !harness.socket_path().exists(),
            "unsupported arguments must fail before touching the server"
        );
    }

    Ok(())
}

#[test]
fn detach_client_requires_a_reachable_server() -> Result<(), Box<dyn Error>> {
    let _guard = window_surface_guard();
    let harness = CliHarness::new("detach-client-absent")?;
    let output = harness.run(&["detach-client"])?;

    assert_eq!(output.status.code(), Some(1));
    assert!(stderr(&output).contains("rmux server is not running"));
    assert!(stdout(&output).is_empty());
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

fn assert_shell_window_names(actual: &str, accepted: &[&str]) {
    assert!(
        accepted.contains(&actual),
        "expected one of {accepted:?}, got {actual:?}"
    );
}

fn window_surface_guard() -> MutexGuard<'static, ()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}
