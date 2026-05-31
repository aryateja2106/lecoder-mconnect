use std::collections::HashMap;
use std::time::{Duration, Instant};

use rmux_core::events::PaneOutputSubscriptionKey;
use rmux_proto::PaneTarget;

use crate::pane_io::PaneOutputSender;

use super::RequestHandler;

/// How long an exited, removed pane keeps its output ring available for a
/// late `Oldest` SDK subscription.
pub(in crate::handler) const EXITED_PANE_OUTPUT_RETENTION_TTL: Duration = Duration::from_secs(5);

#[derive(Debug, Clone)]
pub(in crate::handler) struct RetainedExitedPaneOutput {
    pane: PaneOutputSubscriptionKey,
    output: PaneOutputSender,
    expires_at: Instant,
}

impl RetainedExitedPaneOutput {
    fn new(
        pane: PaneOutputSubscriptionKey,
        output: PaneOutputSender,
        now: Instant,
        ttl: Duration,
    ) -> Self {
        Self {
            pane,
            output,
            expires_at: now + ttl,
        }
    }

    pub(in crate::handler) fn pane(&self) -> &PaneOutputSubscriptionKey {
        &self.pane
    }

    pub(in crate::handler) fn output(&self) -> &PaneOutputSender {
        &self.output
    }

    fn is_expired(&self, now: Instant) -> bool {
        now >= self.expires_at
    }
}

#[derive(Debug, Default)]
pub(in crate::handler) struct RetainedExitedPaneOutputs {
    by_target: HashMap<PaneTarget, PaneOutputSubscriptionKey>,
    by_pane: HashMap<PaneOutputSubscriptionKey, (PaneTarget, RetainedExitedPaneOutput)>,
}

impl RetainedExitedPaneOutputs {
    pub(in crate::handler) fn insert(
        &mut self,
        target: PaneTarget,
        pane: PaneOutputSubscriptionKey,
        output: PaneOutputSender,
        now: Instant,
        ttl: Duration,
    ) {
        self.cleanup_expired(now);
        self.by_target.insert(target.clone(), pane.clone());
        self.by_pane.insert(
            pane.clone(),
            (
                target,
                RetainedExitedPaneOutput::new(pane, output, now, ttl),
            ),
        );
    }

    pub(in crate::handler) fn get(
        &mut self,
        target: &PaneTarget,
        now: Instant,
    ) -> Option<RetainedExitedPaneOutput> {
        self.cleanup_expired(now);
        let pane = self.by_target.get(target)?;
        self.by_pane
            .get(pane)
            .map(|(_target, retained)| retained.clone())
    }

    pub(in crate::handler) fn get_by_pane(
        &mut self,
        pane: &PaneOutputSubscriptionKey,
        now: Instant,
    ) -> Option<(PaneTarget, RetainedExitedPaneOutput)> {
        self.cleanup_expired(now);
        self.by_pane.get(pane).cloned()
    }

    pub(in crate::handler) fn cleanup_pane_if_expired(
        &mut self,
        pane: &PaneOutputSubscriptionKey,
        now: Instant,
    ) {
        let Some((target, retained)) = self.by_pane.get(pane) else {
            return;
        };
        if !retained.is_expired(now) {
            return;
        }

        let target = target.clone();
        self.by_pane.remove(pane);
        if self
            .by_target
            .get(&target)
            .is_some_and(|current_pane| current_pane == pane)
        {
            self.by_target.remove(&target);
        }
    }

    pub(in crate::handler) fn is_empty(&mut self, now: Instant) -> bool {
        self.cleanup_expired(now);
        self.by_target.is_empty()
    }

    pub(in crate::handler) fn clear(&mut self) {
        self.by_target.clear();
        self.by_pane.clear();
    }

    fn cleanup_expired(&mut self, now: Instant) {
        self.by_pane
            .retain(|_, (_target, retained)| !retained.is_expired(now));
        self.by_target
            .retain(|_, pane| self.by_pane.contains_key(pane));
    }
}

impl RequestHandler {
    pub(in crate::handler) fn retain_exited_pane_output(
        &self,
        target: PaneTarget,
        pane: PaneOutputSubscriptionKey,
        output: PaneOutputSender,
    ) {
        let now = Instant::now();
        self.retained_exited_outputs
            .lock()
            .expect("retained exited output mutex must not be poisoned")
            .insert(
                target,
                pane.clone(),
                output,
                now,
                EXITED_PANE_OUTPUT_RETENTION_TTL,
            );
        self.watch_retained_exited_pane_output(pane);
    }

    pub(in crate::handler) fn retained_exited_pane_output(
        &self,
        target: &PaneTarget,
        now: Instant,
    ) -> Option<RetainedExitedPaneOutput> {
        self.retained_exited_outputs
            .lock()
            .expect("retained exited output mutex must not be poisoned")
            .get(target, now)
    }

    pub(in crate::handler) fn retained_exited_pane_output_by_pane(
        &self,
        pane: &PaneOutputSubscriptionKey,
        now: Instant,
    ) -> Option<(PaneTarget, RetainedExitedPaneOutput)> {
        self.retained_exited_outputs
            .lock()
            .expect("retained exited output mutex must not be poisoned")
            .get_by_pane(pane, now)
    }

    fn watch_retained_exited_pane_output(&self, pane: PaneOutputSubscriptionKey) {
        let handler = self.downgrade();
        tokio::spawn(async move {
            tokio::time::sleep(EXITED_PANE_OUTPUT_RETENTION_TTL).await;
            let Some(handler) = handler.upgrade() else {
                return;
            };
            handler
                .retained_exited_outputs
                .lock()
                .expect("retained exited output mutex must not be poisoned")
                .cleanup_pane_if_expired(&pane, Instant::now());
            let _ = handler.request_shutdown_if_pending();
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pane_io::pane_output_channel_with_limits;
    use rmux_proto::{PaneId, SessionName};

    #[test]
    fn replacing_target_preserves_pane_lookup_and_updates_slot_lookup() {
        let mut retained = RetainedExitedPaneOutputs::default();
        let now = Instant::now();
        let ttl = Duration::from_secs(60);
        let target = PaneTarget::new(session_name("alpha"), 0);
        let old_pane = pane_key(34);
        let new_pane = pane_key(35);

        retained.insert(
            target.clone(),
            old_pane.clone(),
            pane_output_channel_with_limits(8, 1024),
            now,
            ttl,
        );
        retained.insert(
            target.clone(),
            new_pane.clone(),
            pane_output_channel_with_limits(8, 1024),
            now,
            ttl,
        );

        let (old_target, old_output) = retained
            .get_by_pane(&old_pane, now)
            .expect("old pane id remains retained by stable identity");
        assert_eq!(old_target, target);
        assert_eq!(old_output.pane(), &old_pane);

        let (retained_target, retained_output) = retained
            .get_by_pane(&new_pane, now)
            .expect("new pane id remains retained");
        assert_eq!(retained_target, target);
        assert_eq!(retained_output.pane(), &new_pane);
        assert_eq!(
            retained.get(&target, now).expect("target retained").pane(),
            &new_pane
        );
    }

    #[test]
    fn cleanup_by_pane_expires_reused_slots_without_dropping_newest_lookup() {
        let mut retained = RetainedExitedPaneOutputs::default();
        let now = Instant::now();
        let target = PaneTarget::new(session_name("alpha"), 0);
        let old_pane = pane_key(34);
        let new_pane = pane_key(35);

        retained.insert(
            target.clone(),
            old_pane.clone(),
            pane_output_channel_with_limits(8, 1024),
            now,
            Duration::from_secs(1),
        );
        retained.insert(
            target.clone(),
            new_pane.clone(),
            pane_output_channel_with_limits(8, 1024),
            now,
            Duration::from_secs(60),
        );

        retained.cleanup_pane_if_expired(&old_pane, now + Duration::from_secs(2));

        assert!(
            !retained.by_pane.contains_key(&old_pane),
            "expired old pane identity should be removed"
        );
        assert_eq!(
            retained
                .get(&target, now + Duration::from_secs(2))
                .expect("target should still resolve to newest pane")
                .pane(),
            &new_pane
        );
    }

    #[test]
    fn cleanup_by_pane_removes_target_when_current_slot_expires() {
        let mut retained = RetainedExitedPaneOutputs::default();
        let now = Instant::now();
        let target = PaneTarget::new(session_name("alpha"), 0);
        let pane = pane_key(34);

        retained.insert(
            target.clone(),
            pane.clone(),
            pane_output_channel_with_limits(8, 1024),
            now,
            Duration::from_secs(1),
        );

        retained.cleanup_pane_if_expired(&pane, now + Duration::from_secs(2));

        assert!(!retained.by_pane.contains_key(&pane));
        assert!(!retained.by_target.contains_key(&target));
        assert!(retained.is_empty(now + Duration::from_secs(2)));
    }

    fn pane_key(pane_id: u32) -> PaneOutputSubscriptionKey {
        PaneOutputSubscriptionKey::new(session_name("alpha"), PaneId::new(pane_id))
    }

    fn session_name(name: &str) -> SessionName {
        SessionName::new(name).expect("valid test session name")
    }
}
