#![cfg(unix)]

mod common;

use std::error::Error;

use common::{assert_success, stderr, stdout, CliHarness};

#[test]
fn list_panes_all_sessions_prints_all_panes_across_session_windows() -> Result<(), Box<dyn Error>> {
    let harness = CliHarness::new("list-panes-cli")?;
    let _daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha"])?);
    assert_success(&harness.run(&["split-window", "-v", "-t", "alpha"])?);
    assert_success(&harness.run(&["new-window", "-t", "alpha", "-d", "-n", "logs"])?);

    let listed = harness.run(&[
        "list-panes",
        "-a",
        "-F",
        "#{session_name}:#{window_index}:#{pane_index}:#{pane_id}:#{pane_active}",
    ])?;

    assert_eq!(listed.status.code(), Some(0));
    assert_eq!(
        stdout(&listed),
        "alpha:0:0:%0:0\nalpha:0:1:%1:1\nalpha:1:0:%2:1\n"
    );
    assert!(stderr(&listed).is_empty());
    Ok(())
}

#[test]
fn list_panes_session_target_lists_only_the_active_window() -> Result<(), Box<dyn Error>> {
    let harness = CliHarness::new("list-panes-session-target-active-window")?;
    let _daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha"])?);
    assert_success(&harness.run(&["split-window", "-h", "-t", "alpha:0"])?);
    assert_success(&harness.run(&["new-window", "-t", "alpha", "-d", "-n", "logs"])?);

    let listed = harness.run(&[
        "list-panes",
        "-t",
        "alpha",
        "-F",
        "#{window_index}:#{pane_index}",
    ])?;

    assert_eq!(listed.status.code(), Some(0));
    assert_eq!(stdout(&listed), "0:0\n0:1\n");
    assert!(stderr(&listed).is_empty());
    Ok(())
}

#[test]
fn list_panes_exposes_pane_geometry_through_the_shared_formatter() -> Result<(), Box<dyn Error>> {
    let harness = CliHarness::new("list-panes-geometry-cli")?;
    let _daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha"])?);

    let listed = harness.run(&[
        "list-panes",
        "-t",
        "alpha",
        "-F",
        "#{pane_width}x#{pane_height}",
    ])?;

    assert_eq!(listed.status.code(), Some(0));
    assert_eq!(stdout(&listed), "80x24\n");
    assert!(stderr(&listed).is_empty());
    Ok(())
}

#[test]
fn list_panes_window_target_lists_only_that_window() -> Result<(), Box<dyn Error>> {
    let harness = CliHarness::new("list-panes-window-target")?;
    let _daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha"])?);
    assert_success(&harness.run(&["split-window", "-h", "-t", "alpha:0"])?);
    assert_success(&harness.run(&["new-window", "-t", "alpha", "-d", "-n", "logs"])?);

    let listed = harness.run(&[
        "list-panes",
        "-t",
        "alpha:0",
        "-F",
        "#{window_index}:#{pane_index}",
    ])?;

    assert_eq!(listed.status.code(), Some(0));
    assert_eq!(stdout(&listed), "0:0\n0:1\n");
    assert!(stderr(&listed).is_empty());
    Ok(())
}
