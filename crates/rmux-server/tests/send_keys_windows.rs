#![cfg(windows)]

use std::error::Error;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::OnceLock;
use std::time::{Duration, Instant};

type TestResult<T = ()> = Result<T, Box<dyn Error>>;

const STEP_TIMEOUT: Duration = Duration::from_secs(5);
static UNIQUE_ID: AtomicUsize = AtomicUsize::new(0);

#[test]
fn send_keys_writes_to_the_correct_pane_through_the_windows_pipe() -> TestResult {
    let harness = CliHarness::new("sendkeysone")?;
    harness.success_quiet(&["new-session", "-d", "-s", "alpha", "cmd.exe", "/d"])?;

    harness.success_quiet(&["send-keys", "-t", "alpha:0.0", "echo send-keys-ok", "Enter"])?;
    let capture = harness.capture_until_contains("alpha:0.0", "send-keys-ok")?;
    assert!(capture.contains("send-keys-ok"));

    harness.failure(&["send-keys", "-t", "missing:0.0", "x"])?;
    harness.finish()
}

#[test]
fn send_keys_targets_the_correct_pane_in_a_multi_pane_session_windows() -> TestResult {
    let harness = CliHarness::new("sendkeysmulti")?;
    harness.success_quiet(&["new-session", "-d", "-s", "beta", "cmd.exe", "/d"])?;
    harness.success_quiet(&["split-window", "-h", "-t", "beta:0", "cmd.exe", "/d"])?;

    harness.success_quiet(&["send-keys", "-t", "beta:0.0", "echo pane-zero", "Enter"])?;
    assert!(harness
        .capture_until_contains("beta:0.0", "pane-zero")?
        .contains("pane-zero"));

    harness.success_quiet(&["send-keys", "-t", "beta:0.1", "echo pane-one", "Enter"])?;
    assert!(harness
        .capture_until_contains("beta:0.1", "pane-one")?
        .contains("pane-one"));
    harness.finish()
}

struct CliHarness {
    label: String,
    armed: bool,
}

impl CliHarness {
    fn new(label: &str) -> TestResult<Self> {
        Ok(Self {
            label: format!("win{}{}", std::process::id(), unique_id(label)),
            armed: true,
        })
    }

    fn success(&self, args: &[&str]) -> TestResult<Output> {
        let output = self.run(args)?;
        if !output.status.success() {
            return Err(format!(
                "rmux {:?} failed with {:?}\nstdout:\n{}\nstderr:\n{}",
                args,
                output.status.code(),
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            )
            .into());
        }
        Ok(output)
    }

    fn success_quiet(&self, args: &[&str]) -> TestResult {
        let status = Command::new(rmux_binary()?)
            .arg("-L")
            .arg(&self.label)
            .args(args)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()?;
        if !status.success() {
            return Err(format!("rmux {:?} failed with {:?}", args, status.code()).into());
        }
        Ok(())
    }

    fn failure(&self, args: &[&str]) -> TestResult<Output> {
        let output = self.run(args)?;
        if output.status.success() {
            return Err(format!("rmux {:?} unexpectedly succeeded", args).into());
        }
        Ok(output)
    }

    fn run(&self, args: &[&str]) -> TestResult<Output> {
        let mut command = Command::new(rmux_binary()?);
        command.arg("-L").arg(&self.label).args(args);
        Ok(command.output()?)
    }

    fn capture_until_contains(&self, target: &str, needle: &str) -> TestResult<String> {
        let deadline = Instant::now() + STEP_TIMEOUT;
        let mut last = String::new();
        while Instant::now() < deadline {
            let output = self.success(&["capture-pane", "-p", "-t", target])?;
            last = String::from_utf8_lossy(&output.stdout).into_owned();
            if last.contains(needle) {
                return Ok(last);
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        Err(format!("capture-pane never surfaced {needle:?}; last capture: {last:?}").into())
    }

    fn finish(mut self) -> TestResult {
        self.armed = false;
        self.kill_server();
        Ok(())
    }

    fn kill_server(&self) {
        let _ = Command::new(rmux_binary().unwrap_or_else(|_| Path::new("rmux")))
            .arg("-L")
            .arg(&self.label)
            .arg("kill-server")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
}

impl Drop for CliHarness {
    fn drop(&mut self) {
        if self.armed {
            self.kill_server();
        }
    }
}

fn unique_id(label: &str) -> String {
    format!(
        "{}{}",
        UNIQUE_ID.fetch_add(1, Ordering::Relaxed),
        label
            .chars()
            .filter(|ch| ch.is_ascii_alphanumeric())
            .collect::<String>()
    )
}

fn rmux_binary() -> TestResult<&'static Path> {
    static RMUX_BINARY: OnceLock<Result<PathBuf, String>> = OnceLock::new();
    match RMUX_BINARY.get_or_init(|| resolve_rmux_binary().map_err(|error| error.to_string())) {
        Ok(path) => Ok(path.as_path()),
        Err(error) => Err(std::io::Error::other(error.clone()).into()),
    }
}

fn resolve_rmux_binary() -> TestResult<PathBuf> {
    let target_dir = target_dir()?;
    let candidate = target_dir.join("debug").join("rmux.exe");
    if candidate.is_file() {
        return Ok(candidate);
    }
    let status = Command::new(std::env::var_os("CARGO").unwrap_or_else(|| "cargo".into()))
        .arg("build")
        .arg("--bin")
        .arg("rmux")
        .arg("--locked")
        .arg("--manifest-path")
        .arg(workspace_root().join("Cargo.toml"))
        .env("CARGO_TARGET_DIR", &target_dir)
        .status()?;
    if !status.success() {
        return Err(
            format!("failed to build rmux binary for Windows send-keys smoke: {status}").into(),
        );
    }
    Ok(candidate)
}

fn target_dir() -> TestResult<PathBuf> {
    if let Some(target_dir) = std::env::var_os("CARGO_TARGET_DIR") {
        return Ok(PathBuf::from(target_dir));
    }
    let current = std::env::current_exe()?;
    current
        .parent()
        .and_then(Path::parent)
        .and_then(Path::parent)
        .map(Path::to_path_buf)
        .ok_or_else(|| "test executable is not under a target directory".into())
}

fn workspace_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(Path::parent)
        .expect("rmux-server manifest lives under crates/rmux-server")
        .to_path_buf()
}
