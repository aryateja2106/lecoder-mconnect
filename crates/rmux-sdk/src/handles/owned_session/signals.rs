//! Opt-in process signal listener for owned sessions.

use std::future::Future;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use tokio::task::JoinHandle;

use crate::transport::TransportClient;
use crate::SessionName;
use rmux_proto::{KillSessionRequest, Request};

pub(super) fn install_default_signal_handlers(
    transport: TransportClient,
    target: SessionName,
    installed: Arc<AtomicBool>,
) -> OwnedSessionSignalHandlers {
    let task = tokio::spawn(async move {
        wait_for_default_shutdown_signal().await;
        let _ = transport
            .request(Request::KillSession(KillSessionRequest {
                target,
                kill_all_except_target: false,
                clear_alerts: false,
            }))
            .await;
    });

    OwnedSessionSignalHandlers { task, installed }
}

/// Guard returned by [`OwnedSession::install_default_signal_handlers`](super::OwnedSession::install_default_signal_handlers).
#[derive(Debug)]
#[must_use = "dropping this guard disables the installed signal listener"]
pub struct OwnedSessionSignalHandlers {
    task: JoinHandle<()>,
    installed: Arc<AtomicBool>,
}

impl OwnedSessionSignalHandlers {
    /// Stops listening for process signals without killing the session.
    pub fn abort(self) {}
}

impl Drop for OwnedSessionSignalHandlers {
    fn drop(&mut self) {
        self.task.abort();
        self.installed.store(false, Ordering::Release);
    }
}

#[cfg(unix)]
async fn wait_for_default_shutdown_signal() {
    use tokio::signal::unix::SignalKind;

    let mut waiters = ShutdownSignalWaiters::new();
    waiters.spawn(recv_ctrl_c());
    waiters.spawn(recv_unix_signal(SignalKind::terminate()));
    waiters.spawn(recv_unix_signal(SignalKind::hangup()));
    waiters.wait().await;

    async fn recv_unix_signal(kind: SignalKind) {
        let Ok(mut signal) = tokio::signal::unix::signal(kind) else {
            std::future::pending::<()>().await;
            return;
        };
        let _ = signal.recv().await;
    }
}

#[cfg(windows)]
async fn wait_for_default_shutdown_signal() {
    let mut waiters = ShutdownSignalWaiters::new();
    waiters.spawn(recv_ctrl_c());
    waiters.spawn(recv_windows_ctrl_break());
    waiters.spawn(recv_windows_ctrl_close());
    waiters.spawn(recv_windows_ctrl_logoff());
    waiters.spawn(recv_windows_ctrl_shutdown());
    waiters.wait().await;
}

#[cfg(all(not(unix), not(windows)))]
async fn wait_for_default_shutdown_signal() {
    let mut waiters = ShutdownSignalWaiters::new();
    waiters.spawn(recv_ctrl_c());
    waiters.wait().await;
}

async fn recv_ctrl_c() {
    if tokio::signal::ctrl_c().await.is_err() {
        std::future::pending::<()>().await;
    }
}

#[cfg(windows)]
async fn recv_windows_ctrl_break() {
    let Ok(mut signal) = tokio::signal::windows::ctrl_break() else {
        std::future::pending::<()>().await;
        return;
    };
    let _ = signal.recv().await;
}

#[cfg(windows)]
async fn recv_windows_ctrl_close() {
    let Ok(mut signal) = tokio::signal::windows::ctrl_close() else {
        std::future::pending::<()>().await;
        return;
    };
    let _ = signal.recv().await;
}

#[cfg(windows)]
async fn recv_windows_ctrl_logoff() {
    let Ok(mut signal) = tokio::signal::windows::ctrl_logoff() else {
        std::future::pending::<()>().await;
        return;
    };
    let _ = signal.recv().await;
}

#[cfg(windows)]
async fn recv_windows_ctrl_shutdown() {
    let Ok(mut signal) = tokio::signal::windows::ctrl_shutdown() else {
        std::future::pending::<()>().await;
        return;
    };
    let _ = signal.recv().await;
}

struct ShutdownSignalWaiters {
    sender: tokio::sync::mpsc::Sender<()>,
    receiver: tokio::sync::mpsc::Receiver<()>,
    tasks: Vec<JoinHandle<()>>,
}

impl ShutdownSignalWaiters {
    fn new() -> Self {
        let (sender, receiver) = tokio::sync::mpsc::channel(1);
        Self {
            sender,
            receiver,
            tasks: Vec::new(),
        }
    }

    fn spawn<F>(&mut self, wait: F)
    where
        F: Future<Output = ()> + Send + 'static,
    {
        let sender = self.sender.clone();
        self.tasks.push(tokio::spawn(async move {
            wait.await;
            let _ = sender.try_send(());
        }));
    }

    async fn wait(mut self) {
        let _ = self.receiver.recv().await;
        for task in self.tasks {
            task.abort();
        }
    }
}
