use std::io::{ErrorKind, Write};
use std::path::Path;

use rmux_client::{connect, ClientError, Connection};
use rmux_proto::{CommandOutput, Response};

use crate::cli_response::{expect_command_output, expect_command_success, response_name};

use super::ExitFailure;

pub(crate) fn run_command<F>(
    socket_path: &Path,
    command_name: &'static str,
    send: F,
) -> Result<i32, ExitFailure>
where
    F: FnOnce(&mut Connection) -> Result<Response, ClientError>,
{
    let mut connection = connect(socket_path)
        .map_err(|error| ExitFailure::from_client_connect(socket_path, error))?;
    let response = send(&mut connection).map_err(ExitFailure::from_client)?;
    finish_command_success(response, command_name)
}

pub(crate) fn run_payload_command<F>(
    socket_path: &Path,
    command_name: &'static str,
    send: F,
) -> Result<i32, ExitFailure>
where
    F: FnOnce(&mut Connection) -> Result<Response, ClientError>,
{
    let mut connection = connect(socket_path)
        .map_err(|error| ExitFailure::from_client_connect(socket_path, error))?;
    let response = send(&mut connection).map_err(ExitFailure::from_client)?;
    let output = expect_command_output(&response, command_name)?;
    write_command_output(output)?;
    Ok(0)
}

pub(crate) fn run_command_resolved<F>(
    socket_path: &Path,
    command_name: &'static str,
    send: F,
) -> Result<i32, ExitFailure>
where
    F: FnOnce(&mut Connection) -> Result<Response, ExitFailure>,
{
    let mut connection = connect(socket_path)
        .map_err(|error| ExitFailure::from_client_connect(socket_path, error))?;
    let response = send(&mut connection)?;
    finish_command_success(response, command_name)
}

pub(crate) fn run_payload_command_resolved<F>(
    socket_path: &Path,
    command_name: &'static str,
    send: F,
) -> Result<i32, ExitFailure>
where
    F: FnOnce(&mut Connection) -> Result<Response, ExitFailure>,
{
    let mut connection = connect(socket_path)
        .map_err(|error| ExitFailure::from_client_connect(socket_path, error))?;
    let response = send(&mut connection)?;
    let output = expect_command_output(&response, command_name)?;
    write_command_output(output)?;
    Ok(0)
}

pub(super) fn run_queued_server_command(
    socket_path: &Path,
    command_name: &'static str,
    queue_command: String,
) -> Result<i32, ExitFailure> {
    let mut connection = connect(socket_path)
        .map_err(|error| ExitFailure::from_client_connect(socket_path, error))?;
    let response = connection
        .source_file(
            vec!["-".to_owned()],
            false,
            false,
            false,
            false,
            None,
            Some(queue_command),
        )
        .map_err(ExitFailure::from_client)?;
    finish_command_success(response, command_name)
}

pub(super) fn unexpected_response(command_name: &str, response: &Response) -> ExitFailure {
    ExitFailure::new(
        1,
        format!(
            "protocol error: unexpected '{}' response for {command_name}",
            response_name(response)
        ),
    )
}

pub(super) fn finish_command_success(
    response: Response,
    command_name: &'static str,
) -> Result<i32, ExitFailure> {
    let output = response.command_output().cloned();
    expect_command_success(response, command_name)?;
    if let Some(output) = output {
        write_command_output(&output)?;
    }
    Ok(0)
}

pub(super) fn write_command_output(output: &CommandOutput) -> Result<(), ExitFailure> {
    match std::io::stdout().write_all(output.stdout()) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::BrokenPipe => Ok(()),
        Err(error) => Err(ExitFailure::new(
            1,
            format!("failed to write command output: {error}"),
        )),
    }
}

pub(super) fn write_lines_output(lines: &[String]) -> Result<i32, ExitFailure> {
    if lines.is_empty() {
        write_command_output(&CommandOutput::from_stdout(Vec::new()))?;
    } else {
        write_command_output(&CommandOutput::from_stdout(
            format!("{}\n", lines.join("\n")).into_bytes(),
        ))?;
    }
    Ok(0)
}
