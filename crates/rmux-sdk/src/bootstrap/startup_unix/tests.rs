use super::filesystem::startup_lock_path;
use super::lock::StartupLock;
use super::*;
use std::fs::{self, OpenOptions};
use std::os::fd::AsFd;
use std::os::unix::fs::OpenOptionsExt;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use rustix::fs::{flock, FlockOperation};

static NEXT_TEST_DIR_ID: AtomicUsize = AtomicUsize::new(0);

fn unique_dir(label: &str) -> PathBuf {
    let id = NEXT_TEST_DIR_ID.fetch_add(1, Ordering::SeqCst);
    let label: String = label
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .take(8)
        .collect();
    let label = if label.is_empty() { "case" } else { &label };

    // macOS Unix sockets have a short sockaddr_un path budget, while TMPDIR is
    // often a long /var/folders/... path. Keep test sockets under /tmp.
    PathBuf::from("/tmp").join(format!("rmux-su-{label}-{}-{id}", std::process::id()))
}

#[tokio::test]
async fn startup_lock_path_uses_sibling_filename() {
    let socket = PathBuf::from("/tmp/rmux-1000/default");
    assert_eq!(
        startup_lock_path(&socket),
        PathBuf::from("/tmp/rmux-1000/default.startup-lock")
    );
}

#[tokio::test]
async fn launcher_runs_once_when_only_one_caller() {
    let dir = unique_dir("solo");
    fs::create_dir_all(&dir).expect("temp dir");
    let socket = dir.join("default");
    let calls = Arc::new(AtomicUsize::new(0));
    let calls_clone = Arc::clone(&calls);

    let result = connect_or_start_with(
        &socket,
        move || async move {
            calls_clone.fetch_add(1, Ordering::SeqCst);
            Err(io::Error::other("no daemon for solo"))
        },
        Duration::from_millis(50),
        Duration::from_millis(10),
    )
    .await;

    assert_eq!(calls.load(Ordering::SeqCst), 1);
    match result {
        Err(StartupError::Launcher { .. }) => {}
        other => panic!("expected Launcher error, got {other:?}"),
    }

    let _ = fs::remove_dir_all(&dir);
}

#[tokio::test]
async fn invalid_path_when_socket_path_has_no_parent() {
    let socket = PathBuf::from("/");
    let result = connect_or_start_with(
        &socket,
        || async { Err::<(), io::Error>(io::Error::other("never")) },
        Duration::from_millis(10),
        Duration::from_millis(5),
    )
    .await;

    assert!(matches!(result, Err(StartupError::InvalidPath { .. })));
}

#[tokio::test]
async fn lock_acquisition_times_out_when_lock_is_held() {
    let dir = unique_dir("held-lock");
    fs::create_dir_all(&dir).expect("temp dir");
    let lock_path = dir.join("default.startup-lock");
    let holder = OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .custom_flags(libc::O_CLOEXEC)
        .mode(STARTUP_LOCK_MODE)
        .open(&lock_path)
        .expect("open held lock");
    flock(holder.as_fd(), FlockOperation::LockExclusive).expect("hold startup lock");

    let result = StartupLock::acquire(
        &lock_path,
        real_user_id(),
        StartupDeadline::from_timeout(Some(Duration::from_millis(20))),
        Duration::from_millis(5),
    )
    .await;

    match result {
        Err(StartupError::Lock { path, source }) => {
            assert_eq!(path, lock_path);
            assert_eq!(source.kind(), io::ErrorKind::TimedOut);
        }
        other => panic!("expected timed-out Lock error, got {other:?}"),
    }

    drop(holder);
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn recoverable_matrix_matches_documented_contract() {
    let recoverable = [
        StartupError::Lock {
            path: PathBuf::from("/tmp/lock"),
            source: io::Error::other("lock"),
        },
        StartupError::Launcher {
            source: io::Error::other("launcher"),
        },
        StartupError::StartupTimeout {
            socket_path: PathBuf::from("/tmp/sock"),
            waited: Duration::from_millis(1),
        },
        StartupError::PeerCredentialMismatch {
            expected_uid: 1000,
            actual_uid: 1001,
            socket_path: PathBuf::from("/tmp/sock"),
        },
    ];
    for error in recoverable {
        assert!(
            error.is_recoverable(),
            "expected recoverable, got {error:?}"
        );
    }

    let not_recoverable = [
        StartupError::InvalidPath {
            reason: "no parent".to_owned(),
            path: PathBuf::from("/"),
        },
        StartupError::SymlinkRejected {
            path: PathBuf::from("/tmp/sym"),
        },
        StartupError::Filesystem {
            operation: "stat",
            path: PathBuf::from("/tmp/x"),
            source: io::Error::other("fs"),
        },
        StartupError::UnsafeOwner {
            path: PathBuf::from("/tmp/x"),
            expected_uid: 1000,
            actual_uid: 0,
        },
        StartupError::UnsafePermissions {
            path: PathBuf::from("/tmp/x"),
            mode: 0o644,
        },
    ];
    for error in not_recoverable {
        assert!(
            !error.is_recoverable(),
            "expected non-recoverable, got {error:?}"
        );
    }
}

#[tokio::test]
async fn startup_outcome_is_owner_only_for_started() {
    let dir = unique_dir("outcome-isowner");
    fs::create_dir_all(&dir).expect("temp dir");
    let socket = dir.join("default");
    let listener = tokio::net::UnixListener::bind(&socket).expect("bind helper listener");
    let accept = tokio::spawn(async move { listener.accept().await });

    let stream = UnixStream::connect(&socket).await.expect("connect helper");
    let started = StartupOutcome::Started(stream);
    assert!(started.is_owner());
    let joined = StartupOutcome::JoinedExisting(started.into_stream());
    assert!(!joined.is_owner());
    drop(joined);

    let _ = accept.await;
    let _ = fs::remove_dir_all(&dir);
}
