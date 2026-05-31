#[cfg(windows)]
use super::{spawn_hook_command_with_profile, TerminalProfile};
#[cfg(windows)]
use rmux_core::{EnvironmentStore, OptionStore};
#[cfg(windows)]
use rmux_proto::{OptionName, ScopeSelector, SetOptionMode};
#[cfg(windows)]
use std::error::Error;
#[cfg(windows)]
use std::fs;
#[cfg(windows)]
use std::path::{Path, PathBuf};
#[cfg(windows)]
use std::time::Duration;
#[cfg(windows)]
use tokio::time::sleep;

#[cfg(windows)]
#[tokio::test]
async fn hook_command_with_profile_respects_windows_default_shell() -> Result<(), Box<dyn Error>> {
    let output_path = unique_output_path("cmd-profile-hook");
    let mut options = OptionStore::new();
    options.set(
        ScopeSelector::Global,
        OptionName::DefaultShell,
        "cmd.exe".to_owned(),
        SetOptionMode::Replace,
    )?;
    let profile = TerminalProfile::for_run_shell(
        &EnvironmentStore::new(),
        &options,
        None,
        None,
        temp_socket_path().as_path(),
        false,
        Some(std::env::temp_dir().as_path()),
    )?;

    spawn_hook_command_with_profile(
        format!("echo RMUX_CMD_HOOK>{}", output_path.display()),
        &profile,
    )?;

    wait_for_file_contains(&output_path, "RMUX_CMD_HOOK").await?;
    fs::remove_file(&output_path)?;
    Ok(())
}

#[cfg(windows)]
fn unique_output_path(label: &str) -> PathBuf {
    let path = std::env::temp_dir().join(format!("rmux-server-{label}-{}.txt", std::process::id()));
    let _ = fs::remove_file(&path);
    path
}

#[cfg(windows)]
fn temp_socket_path() -> PathBuf {
    std::env::temp_dir().join("rmux.sock")
}

#[cfg(windows)]
async fn wait_for_file_contains(path: &Path, expected: &str) -> Result<(), Box<dyn Error>> {
    for _ in 0..100 {
        if let Ok(contents) = fs::read_to_string(path) {
            if contents.contains(expected) {
                return Ok(());
            }
        }
        sleep(Duration::from_millis(20)).await;
    }

    Err(format!("file '{}' never contained '{expected}'", path.display()).into())
}
