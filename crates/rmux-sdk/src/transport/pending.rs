use std::pin::Pin;
use std::task::{Context, Poll};

use rmux_proto::Response;
use tokio::sync::oneshot;

use super::failure::TransportFailure;
use crate::Result;

pub(crate) struct PendingResponse {
    operation: String,
    response: oneshot::Receiver<Result<Response>>,
}

impl PendingResponse {
    pub(super) fn new(operation: String, response: oneshot::Receiver<Result<Response>>) -> Self {
        Self {
            operation,
            response,
        }
    }
}

impl std::future::Future for PendingResponse {
    type Output = Result<Response>;

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        match Pin::new(&mut self.response).poll(cx) {
            Poll::Ready(Ok(result)) => Poll::Ready(result),
            Poll::Ready(Err(_)) => Poll::Ready(Err(
                TransportFailure::actor_closed().to_error(&self.operation)
            )),
            Poll::Pending => Poll::Pending,
        }
    }
}

pub(super) struct PendingCall {
    command_name: &'static str,
    operation: String,
    reply: Option<oneshot::Sender<Result<Response>>>,
}

impl PendingCall {
    pub(super) fn reply(
        command_name: &'static str,
        operation: String,
        reply: oneshot::Sender<Result<Response>>,
    ) -> Self {
        Self {
            command_name,
            operation,
            reply: Some(reply),
        }
    }

    pub(super) fn discard(command_name: &'static str, operation: String) -> Self {
        Self {
            command_name,
            operation,
            reply: None,
        }
    }

    pub(super) fn validate_response(
        &self,
        response: &Response,
    ) -> core::result::Result<(), TransportFailure> {
        if response.is_error() {
            return Ok(());
        }

        let actual = response.command_name();
        if self.command_name == actual {
            return Ok(());
        }

        // The pane-output cursor endpoint is the one daemon RPC that resolves
        // to two distinct response variants: a regular cursor batch
        // (`pane-output-cursor`) or a lag notice (`pane-output-lag`) when the
        // server-side receiver detected a sequence gap. Both are valid
        // replies for the same `pane-output-cursor` request.
        if self.command_name == "pane-output-cursor" && actual == "pane-output-lag" {
            return Ok(());
        }

        Err(TransportFailure::mismatched_response(
            self.command_name,
            actual,
        ))
    }

    pub(super) fn complete(self, response: Response) {
        if let Some(reply) = self.reply {
            let _ = reply.send(response_to_result(response));
        }
    }

    pub(super) fn fail(self, failure: &TransportFailure) {
        if let Some(reply) = self.reply {
            let error = failure.to_error_for_command(&self.operation, self.command_name);
            let _ = reply.send(Err(error));
        }
    }
}

fn response_to_result(response: Response) -> Result<Response> {
    match response {
        Response::Error(error) => Err(error.into()),
        response => Ok(response),
    }
}
