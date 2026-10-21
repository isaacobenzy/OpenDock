use rusqlite::{params, Connection, Row};
use serde::Serialize;

use super::{now_ms, StoreResult};
use crate::engine::ical::Occurrence;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Calendar {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub host: String,
    pub last_synced_at: Option<i64>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEvent {
    pub calendar_id: i64,
    pub calendar_name: String,
    pub color: String,
    pub uid: String,
    pub title: String,
    pub location: String,
    pub starts_at: i64,
    pub ends_at: i64,
    pub all_day: bool,
}

fn calendar_from_row(row: &Row) -> rusqlite::Result<Calendar> {
    Ok(Calendar {
        id: row.get(0)?,
        name: row.get(1)?,
        color: row.get(2)?,
        host: row.get(3)?,
        last_synced_at: row.get(4)?,
        last_error: row.get(5)?,
    })
}

pub fn list(conn: &Connection) -> StoreResult<Vec<Calendar>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, color, host, last_synced_at, last_error FROM calendars ORDER BY id",
    )?;
    let rows = stmt.query_map([], calendar_from_row)?;
    rows.collect()
}

pub fn add(conn: &Connection, name: &str, color: &str, host: &str) -> StoreResult<i64> {
    conn.execute(
        "INSERT INTO calendars (name, color, host) VALUES (?1, ?2, ?3)",
        params![name, color, host],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn delete(conn: &Connection, id: i64) -> StoreResult<()> {
    conn.execute("DELETE FROM calendars WHERE id = ?1", [id])?;
    Ok(())
}

pub fn mark_synced(conn: &Connection, id: i64, error: Option<&str>) -> StoreResult<()> {
    if error.is_some() {
        conn.execute(
            "UPDATE calendars SET last_error = ?2 WHERE id = ?1",
            params![id, error],
        )?;
    } else {
        conn.execute(
            "UPDATE calendars SET last_synced_at = ?2, last_error = NULL WHERE id = ?1",
            params![id, now_ms()],
        )?;
    }
    Ok(())
}

/// Replaces the cached window of events for one calendar atomically.
pub fn replace_events(
    conn: &Connection,
    calendar_id: i64,
    events: &[Occurrence],
) -> StoreResult<()> {
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "DELETE FROM calendar_events WHERE calendar_id = ?1",
        [calendar_id],
    )?;
    {
        let mut stmt = tx.prepare(
            "INSERT OR REPLACE INTO calendar_events
             (calendar_id, uid, title, location, starts_at, ends_at, all_day)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        )?;
        for ev in events {
            stmt.execute(params![
                calendar_id,
                ev.uid,
                ev.title,
                ev.location,
                ev.start.timestamp_millis(),
                ev.end.timestamp_millis(),
                ev.all_day
            ])?;
        }
    }
    tx.commit()
}

/// Events overlapping `[from, to)` across all calendars.
pub fn between(conn: &Connection, from: i64, to: i64) -> StoreResult<Vec<CalendarEvent>> {
    let mut stmt = conn.prepare(
        "SELECT e.calendar_id, c.name, c.color, e.uid, e.title, e.location, e.starts_at, e.ends_at, e.all_day
         FROM calendar_events e JOIN calendars c ON c.id = e.calendar_id
         WHERE e.ends_at > ?1 AND e.starts_at < ?2
         ORDER BY e.all_day ASC, e.starts_at ASC LIMIT 200",
    )?;
    let rows = stmt.query_map(params![from, to], |r| {
        Ok(CalendarEvent {
            calendar_id: r.get(0)?,
            calendar_name: r.get(1)?,
            color: r.get(2)?,
            uid: r.get(3)?,
            title: r.get(4)?,
            location: r.get(5)?,
            starts_at: r.get(6)?,
            ends_at: r.get(7)?,
            all_day: r.get(8)?,
        })
    })?;
    rows.collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::test_conn;
    use chrono::{TimeZone, Utc};

    fn occ(uid: &str, start_h: u32) -> Occurrence {
        let start = Utc.with_ymd_and_hms(2026, 10, 21, start_h, 0, 0).unwrap();
        Occurrence {
            uid: uid.into(),
            title: uid.into(),
            location: String::new(),
            start,
            end: start + chrono::Duration::hours(1),
            all_day: false,
        }
    }

    #[test]
    fn replace_and_query_window() {
        let conn = test_conn();
        let id = add(&conn, "Work", "#7CF2C8", "calendar.google.com").unwrap();
        replace_events(&conn, id, &[occ("a", 9), occ("b", 14)]).unwrap();
        let from = Utc
            .with_ymd_and_hms(2026, 10, 21, 12, 0, 0)
            .unwrap()
            .timestamp_millis();
        let to = from + 86_400_000;
        let found = between(&conn, from, to).unwrap();
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].title, "b");
        assert_eq!(found[0].calendar_name, "Work");

        replace_events(&conn, id, &[occ("c", 15)]).unwrap();
        assert_eq!(between(&conn, from, to).unwrap()[0].title, "c");

        mark_synced(&conn, id, Some("timeout")).unwrap();
        assert_eq!(
            list(&conn).unwrap()[0].last_error.as_deref(),
            Some("timeout")
        );
        delete(&conn, id).unwrap();
        assert!(between(&conn, from, to).unwrap().is_empty());
    }
}
