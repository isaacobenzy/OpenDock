use rusqlite::{params, Connection};
use serde::Serialize;

use super::StoreResult;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FocusDay {
    /// Local midnight of the day, in milliseconds.
    pub day_start: i64,
    pub minutes: i64,
    pub sessions: i64,
}

pub fn start(conn: &Connection, started_at: i64, planned_minutes: u32) -> StoreResult<i64> {
    conn.execute(
        "INSERT INTO focus_sessions (started_at, planned_minutes) VALUES (?1, ?2)",
        params![started_at, planned_minutes],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn finish(conn: &Connection, id: i64, ended_at: i64, completed: bool) -> StoreResult<()> {
    conn.execute(
        "UPDATE focus_sessions SET ended_at = ?2, completed = ?3 WHERE id = ?1 AND ended_at IS NULL",
        params![id, ended_at, completed],
    )?;
    Ok(())
}

/// Closes sessions left open by a crash so they don't count forever.
pub fn close_abandoned(conn: &Connection) -> StoreResult<usize> {
    conn.execute(
        "UPDATE focus_sessions
         SET ended_at = MIN(started_at + planned_minutes * 60000, started_at + 6 * 3600000)
         WHERE ended_at IS NULL",
        [],
    )
}

/// Focused minutes per day for the `days` days ending today, oldest first.
pub fn history(
    conn: &Connection,
    today_start: i64,
    days: i64,
    now: i64,
) -> StoreResult<Vec<FocusDay>> {
    let day_ms = 86_400_000_i64;
    let mut out = Vec::with_capacity(days as usize);
    let mut stmt = conn.prepare(
        "SELECT COALESCE(SUM(MIN(COALESCE(ended_at, ?3), ?2) - MAX(started_at, ?1)), 0), COUNT(*)
         FROM focus_sessions
         WHERE started_at < ?2 AND COALESCE(ended_at, ?3) > ?1",
    )?;
    for offset in (0..days).rev() {
        let start = today_start - offset * day_ms;
        let end = start + day_ms;
        let (ms, sessions): (i64, i64) =
            stmt.query_row(params![start, end, now], |r| Ok((r.get(0)?, r.get(1)?)))?;
        out.push(FocusDay {
            day_start: start,
            minutes: ms.max(0) / 60_000,
            sessions,
        });
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::test_conn;

    #[test]
    fn history_sums_sessions_per_day() {
        let conn = test_conn();
        let day = 86_400_000;
        let today = 10 * day;
        let a = start(&conn, today + 1_000, 25).unwrap();
        finish(&conn, a, today + 1_000 + 25 * 60_000, true).unwrap();
        let b = start(&conn, today - day + 5_000, 50).unwrap();
        finish(&conn, b, today - day + 5_000 + 30 * 60_000, false).unwrap();
        let running = start(&conn, today + 2 * 3_600_000, 25).unwrap();
        let now = today + 2 * 3_600_000 + 10 * 60_000;
        let hist = history(&conn, today, 3, now).unwrap();
        assert_eq!(hist.len(), 3);
        assert_eq!(hist[1].minutes, 30);
        assert_eq!(hist[2].minutes, 35);
        assert_eq!(hist[2].sessions, 2);
        assert_eq!(close_abandoned(&conn).unwrap(), 1);
        let _ = running;
    }
}
