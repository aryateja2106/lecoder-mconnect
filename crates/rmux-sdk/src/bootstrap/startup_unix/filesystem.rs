use std::fs;
use std::io;
use std::os::unix::fs::{DirBuilderExt, FileTypeExt, MetadataExt, PermissionsExt};
use std::path::{Path, PathBuf};
use std::time::Duration;

use super::{StartupError, SOCKET_DIRECTORY_MODE, UNSAFE_PERMISSION_MASK};

const STALE_PROBE_TIMEOUT: Duration = Duration::from_millis(50);

pub(super) fn reject_socket_symlink(socket_path: &Path) -> Result<(), StartupError> {
    match fs::symlink_metadata(socket_path) {
        Ok(metadata) if metadata.file_type().is_symlink() => Err(StartupError::SymlinkRejected {
            path: socket_path.to_path_buf(),
        }),
        Ok(_) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(StartupError::Filesystem {
            operation: "stat daemon socket for symlink check",
            path: socket_path.to_path_buf(),
            source: error,
        }),
    }
}

pub(super) fn startup_lock_path(socket_path: &Path) -> PathBuf {
    let mut lock_name = socket_path
        .file_name()
        .map(|name| name.to_os_string())
        .unwrap_or_default();
    lock_name.push(".startup-lock");
    let parent = socket_path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_default();
    parent.join(lock_name)
}

pub(super) fn ensure_owner_only_directory(path: &Path, owner_uid: u32) -> Result<(), StartupError> {
    match fs::symlink_metadata(path) {
        Ok(metadata) => validate_directory_metadata(path, &metadata, owner_uid),
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            create_owner_only_directory(path)?;
            let metadata =
                fs::symlink_metadata(path).map_err(|error| StartupError::Filesystem {
                    operation: "stat owner-only directory after create",
                    path: path.to_path_buf(),
                    source: error,
                })?;
            validate_directory_metadata(path, &metadata, owner_uid)
        }
        Err(error) => Err(StartupError::Filesystem {
            operation: "stat owner-only directory",
            path: path.to_path_buf(),
            source: error,
        }),
    }
}

fn validate_directory_metadata(
    path: &Path,
    metadata: &fs::Metadata,
    owner_uid: u32,
) -> Result<(), StartupError> {
    let file_type = metadata.file_type();
    if file_type.is_symlink() {
        return Err(StartupError::SymlinkRejected {
            path: path.to_path_buf(),
        });
    }
    if !file_type.is_dir() {
        return Err(StartupError::Filesystem {
            operation: "ensure owner-only directory",
            path: path.to_path_buf(),
            source: io::Error::new(
                io::ErrorKind::AlreadyExists,
                "expected a directory at this path",
            ),
        });
    }
    if metadata.uid() != owner_uid {
        return Err(StartupError::UnsafeOwner {
            path: path.to_path_buf(),
            expected_uid: owner_uid,
            actual_uid: metadata.uid(),
        });
    }
    let mode = metadata.mode() & 0o7777;
    if mode != SOCKET_DIRECTORY_MODE {
        let permissions = fs::Permissions::from_mode(SOCKET_DIRECTORY_MODE);
        fs::set_permissions(path, permissions).map_err(|error| StartupError::Filesystem {
            operation: "tighten directory permissions",
            path: path.to_path_buf(),
            source: error,
        })?;
        let metadata = fs::symlink_metadata(path).map_err(|error| StartupError::Filesystem {
            operation: "stat owner-only directory after chmod",
            path: path.to_path_buf(),
            source: error,
        })?;
        let mode = metadata.mode() & 0o7777;
        if mode & UNSAFE_PERMISSION_MASK != 0 {
            return Err(StartupError::UnsafePermissions {
                path: path.to_path_buf(),
                mode,
            });
        }
    }
    Ok(())
}

fn create_owner_only_directory(path: &Path) -> Result<(), StartupError> {
    let mut builder = fs::DirBuilder::new();
    builder.recursive(true);
    builder.mode(SOCKET_DIRECTORY_MODE);
    builder
        .create(path)
        .map_err(|error| StartupError::Filesystem {
            operation: "create owner-only directory",
            path: path.to_path_buf(),
            source: error,
        })
}

pub(super) fn prepare_socket_path_safe(
    socket_path: &Path,
    owner_uid: u32,
) -> Result<(), StartupError> {
    match fs::symlink_metadata(socket_path) {
        Ok(metadata) => {
            let file_type = metadata.file_type();
            if file_type.is_symlink() {
                return Err(StartupError::SymlinkRejected {
                    path: socket_path.to_path_buf(),
                });
            }
            if !file_type.is_socket() {
                return Err(StartupError::Filesystem {
                    operation: "remove non-socket residue",
                    path: socket_path.to_path_buf(),
                    source: io::Error::new(
                        io::ErrorKind::AlreadyExists,
                        "endpoint path exists and is not a Unix socket",
                    ),
                });
            }
            if metadata.uid() != owner_uid {
                return Err(StartupError::UnsafeOwner {
                    path: socket_path.to_path_buf(),
                    expected_uid: owner_uid,
                    actual_uid: metadata.uid(),
                });
            }
            if !stale_socket_unanswered(socket_path)? {
                return Err(StartupError::Filesystem {
                    operation: "treat answering socket as stale",
                    path: socket_path.to_path_buf(),
                    source: io::Error::new(
                        io::ErrorKind::AddrInUse,
                        "another rmux daemon is already answering this endpoint",
                    ),
                });
            }
            fs::remove_file(socket_path).map_err(|error| StartupError::Filesystem {
                operation: "remove stale socket",
                path: socket_path.to_path_buf(),
                source: error,
            })
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(StartupError::Filesystem {
            operation: "stat socket path",
            path: socket_path.to_path_buf(),
            source: error,
        }),
    }
}

fn stale_socket_unanswered(socket_path: &Path) -> Result<bool, StartupError> {
    use std::os::unix::net::UnixStream as StdUnixStream;

    match StdUnixStream::connect(socket_path) {
        Ok(stream) => {
            // Drop the probe stream immediately; we only needed the connect
            // result. The timeout on the closing handshake guards against a
            // peer that accepts but never reads a goodbye frame.
            let _ = stream.set_read_timeout(Some(STALE_PROBE_TIMEOUT));
            drop(stream);
            Ok(false)
        }
        Err(error)
            if matches!(
                error.kind(),
                io::ErrorKind::ConnectionRefused | io::ErrorKind::NotFound
            ) =>
        {
            Ok(true)
        }
        Err(error) => Err(StartupError::Filesystem {
            operation: "probe potentially stale socket",
            path: socket_path.to_path_buf(),
            source: error,
        }),
    }
}
