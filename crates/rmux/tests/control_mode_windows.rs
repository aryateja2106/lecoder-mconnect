#![cfg(windows)]

use std::error::Error;
use std::fs::{self, File};
use std::process::{Child, Command, ExitStatus, Stdio};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use rmux_proto::{CONTROL_CONTROL_END, CONTROL_CONTROL_START};

const CONTROL_TIMEOUT: Duration = Duration::from_secs(5);

#[test]
fn control_control_mode_uses_tmux_text_protocol() -> Result<(), Box<dyn Error>> {
    let label = unique_label("control-mode-windows")?;
    let _server = ServerGuard::new(label.clone());

    assert_status_success(
        rmux_command()
            .args(["-L", &label, "new-session", "-d", "-s", "alpha"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()?,
        "create detached session",
    )?;

    let input_path = temp_file_path(&label, "in");
    let output_path = temp_file_path(&label, "out");
    let error_path = temp_file_path(&label, "err");
    fs::write(&input_path, b"list-sessions\nbad-command\n")?;

    let mut child = rmux_command()
        .args(["-L", &label, "-CC"])
        .stdin(Stdio::from(File::open(&input_path)?))
        .stdout(Stdio::from(File::create(&output_path)?))
        .stderr(Stdio::from(File::create(&error_path)?))
        .spawn()?;
    let status = wait_for_child_exit(&mut child, CONTROL_TIMEOUT)?;
    let rendered = fs::read_to_string(&output_path)?;
    let stderr = fs::read_to_string(&error_path)?;
    let _ = fs::remove_file(&input_path);
    let _ = fs::remove_file(&output_path);
    let _ = fs::remove_file(&error_path);

    assert_eq!(status.code(), Some(0));
    assert!(
        stderr.is_empty(),
        "control-mode stderr should stay empty, got: {stderr:?}"
    );
    assert!(rendered.starts_with(CONTROL_CONTROL_START));
    assert!(rendered.contains("%begin "));
    assert!(rendered.contains("%end "));
    assert!(rendered.contains("%error "));
    assert!(rendered.contains("parse error:"));
    assert!(rendered.contains("bad-command"));
    assert!(rendered.contains("alpha"));
    assert!(rendered.contains("%exit"));
    assert!(rendered.ends_with(CONTROL_CONTROL_END));

    Ok(())
}

#[test]
fn plain_control_mode_exits_after_stdin_eof_without_empty_line() -> Result<(), Box<dyn Error>> {
    let label = unique_label("plain-control-mode-windows")?;
    let _server = ServerGuard::new(label.clone());

    assert_status_success(
        rmux_command()
            .args(["-L", &label, "new-session", "-d", "-s", "alpha"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()?,
        "create detached session",
    )?;

    let input_path = temp_file_path(&label, "in");
    let output_path = temp_file_path(&label, "out");
    let error_path = temp_file_path(&label, "err");
    fs::write(&input_path, b"list-sessions\n")?;

    let mut child = rmux_command()
        .args(["-L", &label, "-C"])
        .stdin(Stdio::from(File::open(&input_path)?))
        .stdout(Stdio::from(File::create(&output_path)?))
        .stderr(Stdio::from(File::create(&error_path)?))
        .spawn()?;
    let status = wait_for_child_exit(&mut child, CONTROL_TIMEOUT)?;
    let rendered = fs::read_to_string(&output_path)?;
    let stderr = fs::read_to_string(&error_path)?;
    let _ = fs::remove_file(&input_path);
    let _ = fs::remove_file(&output_path);
    let _ = fs::remove_file(&error_path);

    assert_eq!(status.code(), Some(0));
    assert!(
        stderr.is_empty(),
        "control-mode stderr should stay empty, got: {stderr:?}"
    );
    assert!(!rendered.starts_with(CONTROL_CONTROL_START));
    assert!(rendered.contains("%begin "));
    assert!(rendered.contains("%end "));
    assert!(rendered.contains("alpha"));
    assert!(rendered.contains("%exit"));

    Ok(())
}

fn rmux_command() -> Command {
    Command::new(env!("CARGO_BIN_EXE_rmux"))
}

fn unique_label(prefix: &str) -> Result<String, Box<dyn Error>> {
    let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_millis();
    Ok(format!("{prefix}-{}-{now}", std::process::id()))
}

fn temp_file_path(label: &str, extension: &str) -> std::path::PathBuf {
    std::env::temp_dir().join(format!("{label}.{extension}"))
}

fn assert_status_success(status: ExitStatus, context: &str) -> Result<(), Box<dyn Error>> {
    if status.success() {
        return Ok(());
    }

    Err(format!("{context} failed with status {:?}", status.code()).into())
}

fn wait_for_child_exit(child: &mut Child, timeout: Duration) -> Result<ExitStatus, Box<dyn Error>> {
    let deadline = Instant::now() + timeout;
    loop {
        if let Some(status) = child.try_wait()? {
            return Ok(status);
        }
        if Instant::now() >= deadline {
            child.kill()?;
            let _ = child.wait();
            return Err("control-mode client did not exit".into());
        }
        thread::sleep(Duration::from_millis(25));
    }
}

struct ServerGuard {
    label: String,
}

impl ServerGuard {
    fn new(label: String) -> Self {
        Self { label }
    }
}

impl Drop for ServerGuard {
    fn drop(&mut self) {
        let _ = rmux_command()
            .args(["-L", &self.label, "kill-server"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
}
