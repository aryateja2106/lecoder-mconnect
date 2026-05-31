//! Unsupported attach-mode surface for Windows builds.

use std::error::Error as StdError;
use std::fmt;
use std::io::{self, Read, Write};

use rmux_ipc::BlockingLocalStream;

use crate::ClientError;

/// Attach-mode result type.
pub type Result<T> = std::result::Result<T, AttachError>;

/// Attach-mode errors.
#[derive(Debug)]
pub enum AttachError {
    /// A terminal descriptor operation failed.
    Io(io::Error),
    /// Attach mode is not available on this platform yet.
    Unsupported(&'static str),
}

impl fmt::Display for AttachError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Io(error) => write!(formatter, "terminal descriptor operation failed: {error}"),
            Self::Unsupported(operation) => {
                write!(
                    formatter,
                    "attach mode is unsupported on this platform: {operation}"
                )
            }
        }
    }
}

impl StdError for AttachError {
    fn source(&self) -> Option<&(dyn StdError + 'static)> {
        match self {
            Self::Io(error) => Some(error),
            Self::Unsupported(_) => None,
        }
    }
}

impl From<io::Error> for AttachError {
    fn from(error: io::Error) -> Self {
        Self::Io(error)
    }
}

/// Raw terminal guard type for unsupported platforms.
#[derive(Debug)]
pub struct RawTerminal;

/// Runs the attach loop using the process stdin/stdout streams.
pub fn attach_terminal(_stream: BlockingLocalStream) -> std::result::Result<(), ClientError> {
    Err(ClientError::Attach(AttachError::Unsupported(
        "attach terminal",
    )))
}

/// Runs the attach loop with an explicit terminal handle.
pub fn attach_with_terminal<Terminal, Input, Output>(
    _stream: BlockingLocalStream,
    _terminal: &Terminal,
    _input: Input,
    _output: Output,
) -> std::result::Result<(), ClientError>
where
    Input: Read + Send + 'static,
    Output: Write + Send + 'static,
{
    Err(ClientError::Attach(AttachError::Unsupported(
        "attach terminal",
    )))
}

/// Drives an already-upgraded attach stream.
pub fn drive_attach_stream<Input, Output>(
    _stream: BlockingLocalStream,
    _input: Input,
    _output: Output,
) -> std::result::Result<(), ClientError>
where
    Input: Read + Send + 'static,
    Output: Write + Send + 'static,
{
    Err(ClientError::Attach(AttachError::Unsupported(
        "attach stream",
    )))
}
