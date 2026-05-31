use rmux_proto::{
    ErrorResponse, Response, RmuxError, WaitForMode, WaitForRequest, WaitForResponse,
};

use super::super::RequestHandler;
use crate::wait_for::{WaitForCleanupGuard, WaitForRegistration, WaitForWaiterKind, WaitForWake};

impl RequestHandler {
    pub(in crate::handler) async fn handle_wait_for(
        &self,
        client_available: bool,
        request: WaitForRequest,
    ) -> Response {
        if request.channel.is_empty() {
            return Response::Error(ErrorResponse {
                error: RmuxError::Server("wait-for channel must not be empty".to_owned()),
            });
        }

        if !client_available {
            let error = match request.mode {
                WaitForMode::Wait => Some("not able to wait"),
                WaitForMode::Lock => Some("not able to lock"),
                WaitForMode::Signal | WaitForMode::Unlock => None,
            };
            if let Some(error) = error {
                return Response::Error(ErrorResponse {
                    error: RmuxError::Server(error.to_owned()),
                });
            }
        }

        let result = match request.mode {
            WaitForMode::Wait => {
                let registration = match self.wait_for.lock() {
                    Ok(mut store) => store.register_wait(request.channel),
                    Err(_) => {
                        return Response::Error(ErrorResponse {
                            error: RmuxError::Server("wait-for store lock poisoned".to_owned()),
                        });
                    }
                };
                self.wait_for_registration(registration, WaitForWaiterKind::Signal)
                    .await
            }
            WaitForMode::Signal => match self.wait_for.lock() {
                Ok(mut store) => store.signal(&request.channel),
                Err(_) => Err(RmuxError::Server("wait-for store lock poisoned".to_owned())),
            },
            WaitForMode::Lock => {
                let registration = match self.wait_for.lock() {
                    Ok(mut store) => store.register_lock(request.channel),
                    Err(_) => {
                        return Response::Error(ErrorResponse {
                            error: RmuxError::Server("wait-for store lock poisoned".to_owned()),
                        });
                    }
                };
                self.wait_for_registration(registration, WaitForWaiterKind::Lock)
                    .await
            }
            WaitForMode::Unlock => match self.wait_for.lock() {
                Ok(mut store) => store.unlock(&request.channel),
                Err(_) => Err(RmuxError::Server("wait-for store lock poisoned".to_owned())),
            },
        };

        match result {
            Ok(()) => Response::WaitFor(WaitForResponse),
            Err(error) => Response::Error(ErrorResponse { error }),
        }
    }

    async fn wait_for_registration(
        &self,
        registration: WaitForRegistration,
        kind: WaitForWaiterKind,
    ) -> Result<(), RmuxError> {
        match registration {
            WaitForRegistration::Ready => Ok(()),
            WaitForRegistration::Shutdown => Err(wait_for_shutdown_error()),
            WaitForRegistration::Waiting {
                channel,
                waiter_id,
                receiver,
            } => {
                let mut cleanup =
                    WaitForCleanupGuard::new(&self.wait_for, channel.clone(), waiter_id, kind);
                match receiver.await {
                    Ok(WaitForWake::Ready) => {
                        if kind == WaitForWaiterKind::Lock {
                            let mut store = self.wait_for.lock().map_err(|_| {
                                RmuxError::Server("wait-for store lock poisoned".to_owned())
                            })?;
                            if !store.accept_lock(&channel, waiter_id) {
                                return Err(RmuxError::Server(
                                    "wait-for lock grant was cancelled".to_owned(),
                                ));
                            }
                        }
                        cleanup.disarm();
                        Ok(())
                    }
                    Ok(WaitForWake::Shutdown) | Err(_) => Err(wait_for_shutdown_error()),
                }
            }
        }
    }

    #[cfg(test)]
    pub(crate) fn wait_for_counts(&self, channel: &str) -> (usize, usize, bool) {
        self.wait_for
            .lock()
            .expect("wait-for store")
            .waiter_counts(channel)
    }

    #[cfg(test)]
    pub(crate) fn shutdown_wait_for_for_test(&self) {
        self.shutdown_wait_for();
    }
}

fn wait_for_shutdown_error() -> RmuxError {
    RmuxError::Server("wait-for interrupted by server shutdown".to_owned())
}
