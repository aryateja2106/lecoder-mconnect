use rmux_proto::{DisplayMessageRequest, Request, Response, ShowMessagesRequest, Target};

use crate::{connection::Connection, ClientError};

impl Connection {
    /// Sends a `display-message` request over the detached RPC channel.
    pub fn display_message(
        &mut self,
        target: Option<Target>,
        print: bool,
        message: Option<String>,
    ) -> Result<Response, ClientError> {
        self.roundtrip(&Request::DisplayMessage(DisplayMessageRequest {
            target,
            print,
            message,
        }))
    }

    /// Sends a `show-messages` request over the detached RPC channel.
    pub fn show_messages(
        &mut self,
        jobs: bool,
        terminals: bool,
        target_client: Option<String>,
    ) -> Result<Response, ClientError> {
        self.roundtrip(&Request::ShowMessages(ShowMessagesRequest {
            jobs,
            terminals,
            target_client,
        }))
    }
}
