//! Safety-net example: map a matched detach chord to an explicit host
//! action.
//!
//! This example demonstrates the SDK contract for the inert detach
//! helpers. It is built by `cargo build --workspace --examples` and by
//! `cargo clippy --workspace --all-targets --locked`, so a regression in
//! the public detach helper API surfaces as a build failure here.
//!
//! The "safety net" framing matters: a host that wires the detector
//! incorrectly must still fail closed. Here, that means the host owns an
//! explicit `detach()` action and only invokes it when the detector
//! returns [`DetachOutcome::DetachRequested`]. The detector never calls
//! that action on the host's behalf.
//!
//! The example is fully synchronous, allocation-bounded, and uses only
//! types re-exported from `rmux_sdk`. It does not depend on
//! `rmux-client`, `rmux-core`, `rmux-server`, `rmux-pty`, or
//! `crossterm` — the SDK detach helpers are framework-agnostic value
//! objects.
//!
//! # What this example exercises
//!
//! 1. The default tmux chord arms on `Ctrl+B`.
//! 2. The follow-up `d` produces [`DetachOutcome::DetachRequested`],
//!    which is mapped to a single explicit detach action call.
//! 3. Any other event after the prefix is forwarded as
//!    `[prefix, event]` and never triggers the action.
//! 4. A held prefix is flushed via [`DetachDetector::tick`] once the
//!    chord-completion timeout has elapsed.
//! 5. Strict code+modifier equality: `Ctrl+Shift+B` does *not* arm a
//!    detector configured for `Ctrl+B`.
//! 6. Host-driven cancel via [`DetachDetector::reset`] returns the
//!    detector to idle without invoking the detach action and without
//!    forwarding the swallowed prefix.
//! 7. The detector is reusable across successful detaches; a fresh
//!    chord cycle works after `DetachRequested`.

use std::time::{Duration, Instant};

use rmux_sdk::{DetachChord, DetachDetector, DetachOutcome, KeyCode, KeyEvent, KeyModifiers};

/// A host's view of the things the SDK detach helpers can ask it to do.
///
/// The SDK never performs detach itself; it returns a verdict, and the
/// host folds that verdict into its own action set. Modeling it as an
/// enum keeps the safety-net property explicit: every variant the host
/// observes is something the host code wrote, not something the SDK
/// decided to do behind its back.
#[derive(Debug, Clone, PartialEq, Eq)]
enum HostAction {
    /// Send these key events through to the attached pane in order.
    ForwardToPane(Vec<KeyEvent>),
    /// Detach the attached client. This is the *only* host action that
    /// is deferred on the detector returning `DetachRequested`.
    Detach,
    /// Do nothing — typically because the detector is mid-chord.
    Hold,
}

/// Single inert poll wrapper around [`DetachDetector::feed`].
///
/// This is the entire safety-net contract a host needs: convert the
/// SDK's `DetachOutcome` into an explicit `HostAction` enum and react
/// only to the variants the host wrote.
fn host_react(outcome: DetachOutcome) -> HostAction {
    match outcome {
        DetachOutcome::Forward(events) => HostAction::ForwardToPane(events),
        DetachOutcome::Armed => HostAction::Hold,
        DetachOutcome::DetachRequested => HostAction::Detach,
    }
}

/// Marker an explicit host detach action would set in real code.
///
/// In a real host this would call into the SDK to detach the attached
/// client (or whatever else the host considers "the detach action").
/// Here we just count invocations so the example can assert the
/// detector only triggered the action exactly once for the chord.
#[derive(Debug, Default)]
struct DetachState {
    detach_calls: u32,
    pane_writes: Vec<KeyEvent>,
}

impl DetachState {
    fn apply(&mut self, action: HostAction) {
        match action {
            HostAction::ForwardToPane(events) => self.pane_writes.extend(events),
            HostAction::Detach => self.detach_calls += 1,
            HostAction::Hold => {}
        }
    }
}

fn main() {
    let mut detector =
        DetachDetector::with_timeout(DetachChord::tmux_default(), Duration::from_millis(500));
    let mut state = DetachState::default();
    let t0 = Instant::now();

    // Prefix arms but is not yet forwarded.
    let armed = detector.feed(KeyEvent::ctrl('b'), t0);
    assert_eq!(armed, DetachOutcome::Armed);
    state.apply(host_react(armed));
    assert!(detector.is_prefix_armed());
    assert!(state.pane_writes.is_empty());
    assert_eq!(state.detach_calls, 0);

    // Mismatched follow-up: detector flushes prefix + new event, host
    // forwards both, detach action is NOT invoked.
    let stray = KeyEvent::bare(KeyCode::Char('x'));
    let mismatch = detector.feed(stray, t0 + Duration::from_millis(50));
    assert_eq!(
        mismatch,
        DetachOutcome::Forward(vec![KeyEvent::ctrl('b'), stray]),
    );
    state.apply(host_react(mismatch));
    assert_eq!(state.pane_writes, vec![KeyEvent::ctrl('b'), stray]);
    assert_eq!(state.detach_calls, 0);
    assert!(!detector.is_prefix_armed());

    // Successful chord: arm, then complete with `d`. The detect call
    // returns `DetachRequested` but does *not* perform any detach
    // itself — the explicit host action does.
    state.pane_writes.clear();
    let armed_again = detector.feed(KeyEvent::ctrl('b'), t0 + Duration::from_secs(1));
    assert_eq!(armed_again, DetachOutcome::Armed);
    state.apply(host_react(armed_again));

    let completed = detector.feed(
        KeyEvent::bare(KeyCode::Char('d')),
        t0 + Duration::from_secs(1) + Duration::from_millis(40),
    );
    assert_eq!(completed, DetachOutcome::DetachRequested);
    state.apply(host_react(completed));
    assert_eq!(state.detach_calls, 1, "exactly one detach action");
    assert!(state.pane_writes.is_empty(), "chord input is swallowed");
    assert!(!detector.is_prefix_armed());

    // Timeout flushing via tick. Arming a stale prefix and then
    // ticking past the timeout window flushes it as a `Forward` so the
    // pane sees the typed prefix even though the user never pressed
    // the follow-up.
    let t_late = t0 + Duration::from_secs(10);
    let armed_late = detector.feed(KeyEvent::ctrl('b'), t_late);
    assert_eq!(armed_late, DetachOutcome::Armed);
    state.apply(host_react(armed_late));

    let flushed = detector.tick(t_late + detector.timeout());
    assert_eq!(flushed, DetachOutcome::Forward(vec![KeyEvent::ctrl('b')]));
    state.apply(host_react(flushed));
    assert_eq!(state.pane_writes, vec![KeyEvent::ctrl('b')]);
    assert_eq!(
        state.detach_calls, 1,
        "tick-based flush never triggers the detach action",
    );
    assert!(!detector.is_prefix_armed());

    // Idle ticks are no-ops — the host action enum maps them to a
    // `ForwardToPane(vec![])` whose `apply` extends pane writes with an
    // empty slice, so no observable host action happens.
    let pane_writes_before_idle = state.pane_writes.clone();
    let idle = detector.tick(t_late + detector.timeout() + Duration::from_secs(60));
    assert_eq!(idle, DetachOutcome::Forward(Vec::new()));
    state.apply(host_react(idle));
    assert_eq!(state.pane_writes, pane_writes_before_idle);
    assert_eq!(
        state.detach_calls, 1,
        "idle ticks must never trigger the detach action",
    );

    // Strict code+modifier equality: `Ctrl+Shift+B` is a different event
    // from `Ctrl+B` and must NOT arm the detector. The host action enum
    // routes it straight to the pane via `Forward`, with no `Hold` and
    // no `Detach`.
    state.pane_writes.clear();
    let ctrl_shift_b = KeyEvent::new(
        KeyCode::Char('b'),
        KeyModifiers::CONTROL | KeyModifiers::SHIFT,
    );
    let strict = detector.feed(ctrl_shift_b, t_late + Duration::from_secs(120));
    assert_eq!(strict, DetachOutcome::Forward(vec![ctrl_shift_b]));
    state.apply(host_react(strict));
    assert_eq!(state.pane_writes, vec![ctrl_shift_b]);
    assert!(!detector.is_prefix_armed());
    assert_eq!(
        state.detach_calls, 1,
        "extra modifiers on the prefix key must not trigger the detach action",
    );

    // Host-driven cancel: arm the detector, then call `reset()` directly.
    // The contract is that no event is forwarded and no detach action is
    // taken; the swallowed prefix is intentionally discarded.
    state.pane_writes.clear();
    let t_cancel = t_late + Duration::from_secs(180);
    let armed_to_cancel = detector.feed(KeyEvent::ctrl('b'), t_cancel);
    assert_eq!(armed_to_cancel, DetachOutcome::Armed);
    state.apply(host_react(armed_to_cancel));
    assert!(detector.is_prefix_armed());
    detector.reset();
    assert!(!detector.is_prefix_armed());
    assert!(
        state.pane_writes.is_empty(),
        "reset must not synthesize a forward",
    );
    assert_eq!(
        state.detach_calls, 1,
        "reset must not trigger the detach action",
    );

    // Reusability after successful detach: a fresh chord cycle must
    // still produce `DetachRequested` long after the first one.
    let t_next = t_cancel + Duration::from_secs(3600);
    let armed_next = detector.feed(KeyEvent::ctrl('b'), t_next);
    assert_eq!(armed_next, DetachOutcome::Armed);
    state.apply(host_react(armed_next));
    let completed_next = detector.feed(
        KeyEvent::bare(KeyCode::Char('d')),
        t_next + Duration::from_millis(20),
    );
    assert_eq!(completed_next, DetachOutcome::DetachRequested);
    state.apply(host_react(completed_next));
    assert_eq!(
        state.detach_calls, 2,
        "the detector must remain usable across successive detach cycles",
    );
    assert!(!detector.is_prefix_armed());

    println!(
        "detach_safety_net ok: detach_calls={}, pane_writes={}",
        state.detach_calls,
        state.pane_writes.len(),
    );
}
