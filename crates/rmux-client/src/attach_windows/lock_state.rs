use std::sync::{Condvar, Mutex};

#[derive(Debug, Default)]
pub(super) struct AttachLockState {
    inner: Mutex<State>,
    changed: Condvar,
}

impl AttachLockState {
    pub(super) fn lock(&self) {
        let mut state = self.inner.lock().expect("attach lock state poisoned");
        state.locked = true;
        self.changed.notify_all();
    }

    pub(super) fn unlock(&self) {
        let mut state = self.inner.lock().expect("attach lock state poisoned");
        state.locked = false;
        self.changed.notify_all();
    }

    pub(super) fn close(&self) {
        let mut state = self.inner.lock().expect("attach lock state poisoned");
        state.closed = true;
        self.changed.notify_all();
    }

    pub(super) fn is_locked(&self) -> bool {
        self.inner
            .lock()
            .expect("attach lock state poisoned")
            .locked
    }

    pub(super) fn is_closed(&self) -> bool {
        self.inner
            .lock()
            .expect("attach lock state poisoned")
            .closed
    }

    pub(super) fn wait_until_closed(&self) {
        let mut state = self.inner.lock().expect("attach lock state poisoned");
        while !state.closed {
            state = self
                .changed
                .wait(state)
                .expect("attach lock state poisoned");
        }
    }
}

#[derive(Debug, Default)]
struct State {
    locked: bool,
    closed: bool,
}
