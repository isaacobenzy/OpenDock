use chrono::{Duration, Utc};
use serde_json::json;

use crate::engine::bus::{BusEvent, EventBus};
use crate::engine::ical;
use crate::net;
use crate::secrets;
use crate::store::calendar::{self, CalendarEvent};
use crate::store::{now_ms, Database};

const LOOKAHEAD_MINUTES: i64 = 15;
const PALETTE: [&str; 6] = [
    "#7CF2C8", "#8AB4FF", "#F7B267", "#F28FAD", "#C3A6FF", "#7FDBFF",
];

pub fn add_calendar(db: &Database, name: &str, url: &str) -> Result<i64, String> {
    let url = net::normalize_feed_url(url);
    if !url.starts_with("https://") {
        return Err("Paste the calendar's secret iCal address (https:// or webcal://).".into());
    }
    let host = net::host_of(&url).ok_or_else(|| "That doesn't look like a link.".to_string())?;
    let name = name.trim();
    let name = if name.is_empty() { host.as_str() } else { name };
    let count = db.with(|c| calendar::list(c).map(|l| l.len()))?;
    let color = PALETTE[count % PALETTE.len()];
    let id = db.with(|c| calendar::add(c, name, color, &host))?;
    if let Err(error) = secrets::set(&secrets::calendar_account(id), &url) {
        let _ = db.with(|c| calendar::delete(c, id));
        return Err(format!(
            "Could not save the link in the system keychain: {error}"
        ));
    }
    Ok(id)
}

pub fn remove_calendar(db: &Database, id: i64) -> Result<(), String> {
    secrets::delete(&secrets::calendar_account(id))?;
    db.with(|c| calendar::delete(c, id))
}

/// Downloads every calendar feed and caches the next two weeks of events.
pub fn sync_all(db: &Database) -> Result<usize, String> {
    let calendars = db.with(calendar::list)?;
    let from = Utc::now() - Duration::days(1);
    let to = Utc::now() + Duration::days(14);
    let mut synced = 0;
    for cal in calendars {
        let result = secrets::get(&secrets::calendar_account(cal.id)).and_then(|url| {
            let url = url
                .ok_or_else(|| "link missing from keychain; add the calendar again".to_string())?;
            let body = net::get_text(db, "calendar", &[cal.host.as_str()], &url)?;
            if !body.contains("BEGIN:VCALENDAR") {
                return Err("the link did not return an iCal calendar".to_string());
            }
            Ok(ical::occurrences(&body, from, to))
        });
        match result {
            Ok(events) => {
                db.with(|c| calendar::replace_events(c, cal.id, &events))?;
                db.with(|c| calendar::mark_synced(c, cal.id, None))?;
                synced += 1;
            }
            Err(error) => {
                tracing::warn!(calendar = cal.id, %error, "calendar sync failed");
                db.with(|c| calendar::mark_synced(c, cal.id, Some(&error)))?;
            }
        }
    }
    Ok(synced)
}

pub fn upcoming(db: &Database, hours: i64) -> Result<Vec<CalendarEvent>, String> {
    let now = now_ms();
    db.with(|c| calendar::between(c, now - 60 * 60_000, now + hours * 3_600_000))
}

/// Publishes `calendar.event.starting` for timed events starting within the lookahead.
pub fn publish_starting(db: &Database, bus: &EventBus) {
    let now = now_ms();
    let Ok(events) = db.with(|c| calendar::between(c, now, now + LOOKAHEAD_MINUTES * 60_000))
    else {
        return;
    };
    for ev in events
        .into_iter()
        .filter(|e| !e.all_day && e.starts_at >= now - 60_000)
    {
        let minutes = ((ev.starts_at - now).max(0) + 59_999) / 60_000;
        bus.publish(
            BusEvent::new(
                "calendar.event.starting",
                "calendar",
                json!({
                    "title": ev.title,
                    "location": ev.location,
                    "calendar": ev.calendar_name,
                    "minutesUntil": minutes,
                    "startsAt": ev.starts_at,
                }),
            )
            .with_dedupe(format!("{}:{}:{}", ev.calendar_id, ev.uid, ev.starts_at)),
        );
    }
}
