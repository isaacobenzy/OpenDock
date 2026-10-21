use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{sync_channel, Receiver, SyncSender, TrySendError};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const EVENT_VERSION: u32 = 1;
const SUBSCRIBER_CAPACITY: usize = 256;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BusEvent {
    pub name: String,
    pub version: u32,
    pub timestamp: i64,
    pub source: String,
    pub payload: Value,
    /// Identifies one real-world occurrence, so rules fire once per occurrence even when the
    /// source republishes it (for example every minute while a meeting approaches).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dedupe_key: Option<String>,
}

impl BusEvent {
    pub fn new(name: &str, source: &str, payload: Value) -> Self {
        Self {
            name: name.to_string(),
            version: EVENT_VERSION,
            timestamp: chrono::Utc::now().timestamp_millis(),
            source: source.to_string(),
            payload,
            dedupe_key: None,
        }
    }

    pub fn with_dedupe(mut self, key: impl Into<String>) -> Self {
        self.dedupe_key = Some(key.into());
        self
    }
}

/// In-process typed pub/sub. Each subscriber gets a bounded queue; a slow subscriber drops
/// events instead of blocking publishers, and the drop is counted.
#[derive(Default)]
pub struct EventBus {
    subscribers: Mutex<Vec<SyncSender<BusEvent>>>,
    dropped: AtomicU64,
}

impl EventBus {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn subscribe(&self) -> Receiver<BusEvent> {
        self.subscribe_with_capacity(SUBSCRIBER_CAPACITY)
    }

    pub fn subscribe_with_capacity(&self, capacity: usize) -> Receiver<BusEvent> {
        let (tx, rx) = sync_channel(capacity);
        if let Ok(mut subs) = self.subscribers.lock() {
            subs.push(tx);
        }
        rx
    }

    pub fn publish(&self, event: BusEvent) {
        let Ok(mut subs) = self.subscribers.lock() else {
            return;
        };
        subs.retain(|tx| match tx.try_send(event.clone()) {
            Ok(()) => true,
            Err(TrySendError::Full(_)) => {
                self.dropped.fetch_add(1, Ordering::Relaxed);
                true
            }
            Err(TrySendError::Disconnected(_)) => false,
        });
    }

    #[cfg(test)]
    pub fn dropped_count(&self) -> u64 {
        self.dropped.load(Ordering::Relaxed)
    }

    #[cfg(test)]
    pub fn subscriber_count(&self) -> usize {
        self.subscribers.lock().map(|s| s.len()).unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn delivers_in_order_to_every_subscriber() {
        let bus = EventBus::new();
        let a = bus.subscribe();
        let b = bus.subscribe();
        for i in 0..5 {
            bus.publish(BusEvent::new("time.tick", "test", json!({ "i": i })));
        }
        for rx in [a, b] {
            let got: Vec<i64> = rx
                .try_iter()
                .map(|e| e.payload["i"].as_i64().unwrap())
                .collect();
            assert_eq!(got, vec![0, 1, 2, 3, 4]);
        }
    }

    #[test]
    fn full_subscriber_drops_without_blocking() {
        let bus = EventBus::new();
        let rx = bus.subscribe_with_capacity(2);
        for _ in 0..5 {
            bus.publish(BusEvent::new("time.tick", "test", json!({})));
        }
        assert_eq!(rx.try_iter().count(), 2);
        assert_eq!(bus.dropped_count(), 3);
    }

    #[test]
    fn disconnected_subscribers_are_pruned() {
        let bus = EventBus::new();
        let rx = bus.subscribe();
        let _keep = bus.subscribe();
        drop(rx);
        bus.publish(BusEvent::new("time.tick", "test", json!({})));
        assert_eq!(bus.subscriber_count(), 1);
    }
}
