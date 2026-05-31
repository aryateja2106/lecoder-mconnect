use std::path::Path;
use std::sync::Arc;

use rmux_ipc::LocalListener;
use tokio::sync::mpsc;
#[cfg(unix)]
use tracing::{debug, warn};

use crate::handler::RequestHandler;
use crate::signals::ServerSignal;
use crate::socket_cleanup::SocketCleanup;

pub(crate) async fn receive_server_signal(
    server_signals: &mut Option<mpsc::UnboundedReceiver<ServerSignal>>,
) -> Option<ServerSignal> {
    match server_signals {
        Some(server_signals) => server_signals.recv().await,
        None => std::future::pending().await,
    }
}

pub(crate) async fn handle_server_signal(
    signal: Option<ServerSignal>,
    server_signals: &mut Option<mpsc::UnboundedReceiver<ServerSignal>>,
    handler: &Arc<RequestHandler>,
    socket_path: &Path,
    listener: &mut LocalListener,
    cleanup: &mut SocketCleanup,
) {
    match signal {
        Some(ServerSignal::ChildChanged) => {
            handler.continue_stopped_panes().await;
        }
        Some(ServerSignal::RecreateSocket) => {
            recreate_listener_after_signal(socket_path, listener, cleanup);
        }
        None => {
            *server_signals = None;
        }
    }
}

#[cfg(unix)]
fn recreate_listener_after_signal(
    socket_path: &Path,
    listener: &mut LocalListener,
    cleanup: &mut SocketCleanup,
) {
    match crate::unix_socket::rebind_unix_listener_at(socket_path, cleanup.socket_identity()) {
        Ok(rebound) => {
            *listener = rebound.listener;
            cleanup.update_socket_identity(rebound.identity);
            debug!(path = %socket_path.display(), "recreated Unix daemon socket after signal");
        }
        Err(error) => {
            warn!(path = %socket_path.display(), "failed to recreate Unix daemon socket after signal: {error}");
        }
    }
}

#[cfg(not(unix))]
fn recreate_listener_after_signal(
    _socket_path: &Path,
    _listener: &mut LocalListener,
    _cleanup: &mut SocketCleanup,
) {
}
