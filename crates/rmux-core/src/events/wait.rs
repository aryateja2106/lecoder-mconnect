use std::collections::{HashMap, HashSet};

use rmux_proto::{SdkWaitId, SdkWaitOwnerId};

/// Stable key for one daemon-backed SDK wait.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct SdkWaitKey {
    owner_id: SdkWaitOwnerId,
    wait_id: SdkWaitId,
}

impl SdkWaitKey {
    /// Builds a wait key from its owner and per-owner id.
    #[must_use]
    pub const fn new(owner_id: SdkWaitOwnerId, wait_id: SdkWaitId) -> Self {
        Self { owner_id, wait_id }
    }

    /// Returns the SDK owner id.
    #[must_use]
    pub const fn owner_id(self) -> SdkWaitOwnerId {
        self.owner_id
    }

    /// Returns the per-owner wait id.
    #[must_use]
    pub const fn wait_id(self) -> SdkWaitId {
        self.wait_id
    }
}

/// Registered daemon-backed SDK wait metadata.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SdkWaitRecord {
    key: SdkWaitKey,
    connection_id: u64,
}

impl SdkWaitRecord {
    /// Returns the stable wait key.
    #[must_use]
    pub const fn key(self) -> SdkWaitKey {
        self.key
    }

    /// Returns the server-private connection id that owns this wait.
    #[must_use]
    pub const fn connection_id(self) -> u64 {
        self.connection_id
    }
}

/// Registry for daemon-backed SDK wait identities and cleanup accounting.
#[derive(Debug, Clone, Default)]
pub struct SdkWaitRegistry {
    next_id_by_owner: HashMap<SdkWaitOwnerId, u64>,
    records: HashMap<SdkWaitKey, SdkWaitRecord>,
    by_connection: HashMap<u64, HashSet<SdkWaitKey>>,
}

impl SdkWaitRegistry {
    /// Allocates the next wait id for one SDK owner.
    ///
    /// IDs intentionally start at one so a zero value remains conspicuous in
    /// logs and diagnostics. The same numeric id can exist under different
    /// owners, which is the per-connection scoping contract.
    pub fn allocate_id(&mut self, owner_id: SdkWaitOwnerId) -> SdkWaitId {
        let next = self.next_id_by_owner.entry(owner_id).or_insert(1);
        let wait_id = SdkWaitId::new(*next);
        *next = next
            .checked_add(1)
            .expect("SDK wait id space exhausted for owner");
        wait_id
    }

    /// Registers an active wait.
    ///
    /// Returns `false` when the `(owner_id, wait_id)` pair is already active.
    /// Duplicate registration is rejected without disturbing the existing
    /// record.
    pub fn register(
        &mut self,
        connection_id: u64,
        owner_id: SdkWaitOwnerId,
        wait_id: SdkWaitId,
    ) -> bool {
        let key = SdkWaitKey::new(owner_id, wait_id);
        if self.records.contains_key(&key) {
            return false;
        }

        let record = SdkWaitRecord { key, connection_id };
        self.records.insert(key, record);
        self.by_connection
            .entry(connection_id)
            .or_default()
            .insert(key);
        true
    }

    /// Removes one wait by owner and id.
    ///
    /// Duplicate and late cancellations are idempotent: `None` means there was
    /// no live wait to remove.
    pub fn remove(
        &mut self,
        owner_id: SdkWaitOwnerId,
        wait_id: SdkWaitId,
    ) -> Option<SdkWaitRecord> {
        self.remove_key(SdkWaitKey::new(owner_id, wait_id))
    }

    /// Removes every wait owned by an actual server connection.
    pub fn remove_connection(&mut self, connection_id: u64) -> Vec<SdkWaitRecord> {
        let keys = self
            .by_connection
            .remove(&connection_id)
            .unwrap_or_default()
            .into_iter()
            .collect::<Vec<_>>();
        keys.into_iter()
            .filter_map(|key| self.remove_record_without_connection_index(key))
            .collect()
    }

    /// Returns a live wait record.
    #[must_use]
    pub fn get(&self, owner_id: SdkWaitOwnerId, wait_id: SdkWaitId) -> Option<SdkWaitRecord> {
        self.records
            .get(&SdkWaitKey::new(owner_id, wait_id))
            .copied()
    }

    /// Returns the number of active waits.
    #[must_use]
    pub fn len(&self) -> usize {
        self.records.len()
    }

    /// Returns whether no waits are registered.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.records.is_empty()
    }

    fn remove_key(&mut self, key: SdkWaitKey) -> Option<SdkWaitRecord> {
        let record = self.records.remove(&key)?;
        if let Some(keys) = self.by_connection.get_mut(&record.connection_id) {
            keys.remove(&key);
            if keys.is_empty() {
                self.by_connection.remove(&record.connection_id);
            }
        }
        Some(record)
    }

    fn remove_record_without_connection_index(&mut self, key: SdkWaitKey) -> Option<SdkWaitRecord> {
        self.records.remove(&key)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn owner(value: u64) -> SdkWaitOwnerId {
        SdkWaitOwnerId::new(value)
    }

    fn wait(value: u64) -> SdkWaitId {
        SdkWaitId::new(value)
    }

    #[test]
    fn wait_ids_are_unique_within_owner_and_scoped_across_owners() {
        let mut registry = SdkWaitRegistry::default();

        assert_eq!(registry.allocate_id(owner(10)), wait(1));
        assert_eq!(registry.allocate_id(owner(10)), wait(2));
        assert_eq!(registry.allocate_id(owner(11)), wait(1));
        assert_eq!(registry.allocate_id(owner(10)), wait(3));
    }

    #[test]
    fn duplicate_late_and_repeated_cancel_are_idempotent() {
        let mut registry = SdkWaitRegistry::default();

        assert!(registry.register(7, owner(1), wait(1)));
        assert!(!registry.register(8, owner(1), wait(1)));
        assert_eq!(registry.len(), 1);

        let removed = registry
            .remove(owner(1), wait(1))
            .expect("first cancel removes wait");
        assert_eq!(removed.connection_id(), 7);
        assert!(registry.remove(owner(1), wait(1)).is_none());
        assert!(registry.remove(owner(1), wait(9)).is_none());
        assert!(registry.is_empty());
    }

    #[test]
    fn connection_teardown_removes_only_that_connections_waits() {
        let mut registry = SdkWaitRegistry::default();
        assert!(registry.register(1, owner(10), wait(1)));
        assert!(registry.register(1, owner(10), wait(2)));
        assert!(registry.register(2, owner(20), wait(1)));

        let removed = registry.remove_connection(1);
        let removed_keys = removed
            .iter()
            .map(|record| record.key())
            .collect::<HashSet<_>>();
        assert_eq!(
            removed_keys,
            HashSet::from([
                SdkWaitKey::new(owner(10), wait(1)),
                SdkWaitKey::new(owner(10), wait(2)),
            ])
        );
        assert_eq!(registry.len(), 1);
        assert!(registry.get(owner(20), wait(1)).is_some());
        assert!(registry.remove_connection(1).is_empty());
        assert_eq!(registry.remove_connection(2).len(), 1);
        assert!(registry.is_empty());
    }
}
