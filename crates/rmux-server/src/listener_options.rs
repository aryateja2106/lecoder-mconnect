use rmux_core::events::SubscriptionLimits;

use crate::signals::ServerSignal;
#[cfg(unix)]
use crate::unix_socket::SocketFileIdentity;
use crate::ConfigLoadOptions;

pub(crate) struct ServeOptions {
    pub(crate) server_signals: Option<tokio::sync::mpsc::UnboundedReceiver<ServerSignal>>,
    pub(crate) config_load: ConfigLoadOptions,
    pub(crate) subscription_limits: SubscriptionLimits,
    pub(crate) owner_uid: u32,
    #[cfg(unix)]
    pub(crate) socket_identity: Option<SocketFileIdentity>,
}

impl ServeOptions {
    pub(crate) fn new(
        config_load: ConfigLoadOptions,
        subscription_limits: SubscriptionLimits,
        owner_uid: u32,
    ) -> Self {
        Self {
            server_signals: None,
            config_load,
            subscription_limits,
            owner_uid,
            #[cfg(unix)]
            socket_identity: None,
        }
    }

    #[cfg(unix)]
    pub(crate) fn with_socket_identity(mut self, socket_identity: SocketFileIdentity) -> Self {
        self.socket_identity = Some(socket_identity);
        self
    }

    #[cfg(unix)]
    pub(crate) fn with_server_signals(
        mut self,
        server_signals: tokio::sync::mpsc::UnboundedReceiver<ServerSignal>,
    ) -> Self {
        self.server_signals = Some(server_signals);
        self
    }
}
