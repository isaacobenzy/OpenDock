use std::sync::Mutex;

use chrono::{Local, TimeZone};
use serde::Serialize;
use serde_json::json;

use crate::engine::bus::{BusEvent, EventBus};
use crate::store::focus::{self, FocusDay};
use crate::store::{now_ms, Database};

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Phase {
    Idle,
    Focus,
    Break,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusState {
    pub phase: Phase,
    pub started_at: Option<i64>,
    pub ends_at: Option<i64>,
    pub planned_minutes: u32,
    pub today_minutes: i64,
    pub history: Vec<FocusDay>,
}

struct Inner {
    phase: Phase,
    started_at: i64,
    ends_at: i64,
    minutes: u32,
    session_id: Option<i64>,
}

pub struct FocusTimer {
    inner: Mutex<Inner>,
}

pub fn today_start_ms() -> i64 {
    let today = Local::now().date_naive();
    today
        .and_hms_opt(0, 0, 0)
        .and_then(|naive| Local.from_local_datetime(&naive).earliest())
        .map(|d| d.timestamp_millis())
        .unwrap_or_else(now_ms)
}

impl Default for FocusTimer {
    fn default() -> Self {
        Self {
            inner: Mutex::new(Inner {
                phase: Phase::Idle,
                started_at: 0,
                ends_at: 0,
                minutes: 0,
                session_id: None,
            }),
        }
    }
}

impl FocusTimer {
    pub fn is_focusing(&self) -> bool {
        self.inner
            .lock()
            .map(|i| i.phase == Phase::Focus)
            .unwrap_or(false)
    }

    pub fn start(&self, db: &Database, bus: &EventBus, minutes: u32) -> Result<(), String> {
        let minutes = minutes.clamp(1, 180);
        self.finish_focus(db, bus, false)?;
        let now = now_ms();
        let id = db.with(|c| focus::start(c, now, minutes))?;
        let mut inner = self.inner.lock().map_err(|_| "focus lock poisoned")?;
        *inner = Inner {
            phase: Phase::Focus,
            started_at: now,
            ends_at: now + i64::from(minutes) * 60_000,
            minutes,
            session_id: Some(id),
        };
        drop(inner);
        bus.publish(BusEvent::new(
            "focus.session.started",
            "focus",
            json!({ "minutes": minutes }),
        ));
        Ok(())
    }

    /// Stops a focus round early, or cancels a break.
    pub fn stop(&self, db: &Database, bus: &EventBus) -> Result<(), String> {
        self.finish_focus(db, bus, false)?;
        if let Ok(mut inner) = self.inner.lock() {
            inner.phase = Phase::Idle;
        }
        Ok(())
    }

    fn finish_focus(&self, db: &Database, bus: &EventBus, completed: bool) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|_| "focus lock poisoned")?;
        if inner.phase != Phase::Focus {
            return Ok(());
        }
        let now = now_ms();
        let ended = if completed { inner.ends_at } else { now };
        if let Some(id) = inner.session_id.take() {
            db.with(|c| focus::finish(c, id, ended, completed))?;
        }
        let focused = ((ended - inner.started_at).max(0) / 60_000) as u32;
        inner.phase = Phase::Idle;
        drop(inner);
        bus.publish(BusEvent::new(
            "focus.session.ended",
            "focus",
            json!({ "minutes": focused, "completed": completed }),
        ));
        Ok(())
    }

    /// Advances the timer. Returns true when the phase changed.
    pub fn tick(&self, db: &Database, bus: &EventBus, break_minutes: u32) -> bool {
        let (phase, ends_at) = match self.inner.lock() {
            Ok(i) => (i.phase, i.ends_at),
            Err(_) => return false,
        };
        let now = now_ms();
        if now < ends_at {
            return false;
        }
        match phase {
            Phase::Idle => false,
            Phase::Focus => {
                if self.finish_focus(db, bus, true).is_err() {
                    return false;
                }
                if let Ok(mut inner) = self.inner.lock() {
                    inner.phase = Phase::Break;
                    inner.started_at = now;
                    inner.minutes = break_minutes;
                    inner.ends_at = now + i64::from(break_minutes) * 60_000;
                }
                true
            }
            Phase::Break => {
                if let Ok(mut inner) = self.inner.lock() {
                    inner.phase = Phase::Idle;
                }
                true
            }
        }
    }

    pub fn snapshot(&self, db: &Database) -> FocusState {
        let (phase, started_at, ends_at, minutes) = self
            .inner
            .lock()
            .map(|i| (i.phase, i.started_at, i.ends_at, i.minutes))
            .unwrap_or((Phase::Idle, 0, 0, 0));
        let history = db
            .with(|c| focus::history(c, today_start_ms(), 7, now_ms()))
            .unwrap_or_default();
        FocusState {
            phase,
            started_at: (phase != Phase::Idle).then_some(started_at),
            ends_at: (phase != Phase::Idle).then_some(ends_at),
            planned_minutes: minutes,
            today_minutes: history.last().map(|d| d.minutes).unwrap_or(0),
            history,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn start_and_stop_publish_events_and_store_sessions() {
        let db = Database::open_in_memory().unwrap();
        let bus = EventBus::new();
        let rx = bus.subscribe();
        let timer = FocusTimer::default();
        timer.start(&db, &bus, 25).unwrap();
        assert!(timer.is_focusing());
        assert_eq!(timer.snapshot(&db).phase, Phase::Focus);
        timer.stop(&db, &bus).unwrap();
        assert!(!timer.is_focusing());
        let names: Vec<String> = rx.try_iter().map(|e| e.name).collect();
        assert_eq!(names, vec!["focus.session.started", "focus.session.ended"]);
        assert_eq!(timer.snapshot(&db).history.len(), 7);
    }
}
