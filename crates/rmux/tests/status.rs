#![cfg(unix)]

mod common;

use std::error::Error;
use std::time::Duration;

use common::{assert_success, read_until_contains, terminate_child, AttachedSession, CliHarness};
use rmux_pty::TerminalSize;

const ATTACH_TIMEOUT: Duration = Duration::from_secs(5);

#[test]
fn status_row_is_visible_on_attach_by_default() -> Result<(), Box<dyn Error>> {
    let harness = CliHarness::new("status-row-attach")?;
    let mut daemon = harness.start_hidden_daemon()?;

    assert_success(&harness.run(&["new-session", "-d", "-s", "alpha", "-x", "40", "-y", "8"])?);

    let mut attach = AttachedSession::spawn(&harness, "alpha", TerminalSize { cols: 40, rows: 8 })?;
    attach.wait_for_raw_mode(ATTACH_TIMEOUT)?;
    let output = read_until_contains(attach.master_mut(), "[alpha]", ATTACH_TIMEOUT)?;
    assert!(output.contains("[alpha]"));

    assert_success(&harness.run(&["detach-client"])?);
    terminate_child(attach.child_mut())?;
    terminate_child(daemon.child_mut())?;
    Ok(())
}
