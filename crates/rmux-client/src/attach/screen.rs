use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use rmux_core::alternate_screen_exit_sequence;

pub(super) const ALT_SCREEN_EXIT_FALLBACK: &[u8] = b"\x1b[?1049l";
pub(super) const DETACHED_BANNER_PREFIX: &[u8] = b"[detached (from session ";
pub(super) const EXITED_BANNER: &[u8] = b"[exited]\r\n";

#[derive(Clone, Debug, Default)]
pub(super) struct AttachScreenTracker {
    stopped: Arc<AtomicBool>,
}

impl AttachScreenTracker {
    pub(super) fn mark_stopped(&self) {
        self.stopped.store(true, Ordering::SeqCst);
    }

    pub(super) fn was_stopped(&self) -> bool {
        self.stopped.load(Ordering::SeqCst)
    }
}

#[derive(Debug)]
pub(super) struct AttachStopDetector {
    tracker: AttachScreenTracker,
    marker: Vec<u8>,
    tail: Vec<u8>,
}

impl AttachStopDetector {
    pub(super) fn new(tracker: AttachScreenTracker) -> Self {
        let term = std::env::var("TERM").unwrap_or_default();
        let marker = alternate_screen_exit_sequence(&term).to_vec();
        let tail_len = stop_marker_tail_len(&marker);
        Self {
            tracker,
            marker,
            tail: Vec::with_capacity(tail_len),
        }
    }

    pub(super) fn observe(&mut self, bytes: &[u8]) {
        if self.tracker.was_stopped() || bytes.is_empty() {
            return;
        }

        if contains_subslice(bytes, &self.marker)
            || contains_subslice(bytes, ALT_SCREEN_EXIT_FALLBACK)
            || contains_subslice(bytes, DETACHED_BANNER_PREFIX)
            || contains_subslice(bytes, EXITED_BANNER)
        {
            self.tracker.mark_stopped();
            return;
        }

        if self.tail.is_empty() {
            self.update_tail(bytes);
            return;
        }

        let mut combined = Vec::with_capacity(self.tail.len() + bytes.len());
        combined.extend_from_slice(&self.tail);
        combined.extend_from_slice(bytes);

        if contains_subslice(&combined, &self.marker)
            || contains_subslice(&combined, ALT_SCREEN_EXIT_FALLBACK)
            || contains_subslice(&combined, DETACHED_BANNER_PREFIX)
            || contains_subslice(&combined, EXITED_BANNER)
        {
            self.tracker.mark_stopped();
            return;
        }

        self.update_tail(&combined);
    }

    fn update_tail(&mut self, bytes: &[u8]) {
        let tail_len = stop_marker_tail_len(&self.marker);
        self.tail.clear();
        if tail_len == 0 {
            return;
        }
        let start = bytes.len().saturating_sub(tail_len);
        self.tail.extend_from_slice(&bytes[start..]);
    }
}

fn stop_marker_tail_len(marker: &[u8]) -> usize {
    [
        marker.len(),
        ALT_SCREEN_EXIT_FALLBACK.len(),
        DETACHED_BANNER_PREFIX.len(),
        EXITED_BANNER.len(),
    ]
    .into_iter()
    .max()
    .unwrap_or(0)
    .saturating_sub(1)
}

pub(super) fn contains_subslice(haystack: &[u8], needle: &[u8]) -> bool {
    !needle.is_empty()
        && haystack
            .windows(needle.len())
            .any(|window| window == needle)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tail_len_covers_all_stop_markers() {
        let marker = b"\x1b[?1049l";
        let tail_len = stop_marker_tail_len(marker);

        for needle in [
            marker.as_slice(),
            ALT_SCREEN_EXIT_FALLBACK,
            DETACHED_BANNER_PREFIX,
            EXITED_BANNER,
        ] {
            assert!(
                tail_len >= needle.len().saturating_sub(1),
                "tail length {tail_len} should cover marker length {}",
                needle.len()
            );
        }
    }

    #[test]
    fn detector_marks_stopped_when_detached_banner_is_split_across_reads() {
        let tracker = AttachScreenTracker::default();
        let mut detector = AttachStopDetector::new(tracker.clone());
        let split = 12;

        detector.observe(&DETACHED_BANNER_PREFIX[..split]);
        assert!(!tracker.was_stopped());

        detector.observe(&DETACHED_BANNER_PREFIX[split..]);
        assert!(tracker.was_stopped());
    }
}
