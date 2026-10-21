use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use super::{now_ms, StoreResult};

pub fn get(conn: &Connection, key: &str) -> StoreResult<Option<(String, i64)>> {
    conn.query_row(
        "SELECT value, fetched_at FROM cache WHERE key = ?1",
        [key],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )
    .optional()
}

pub fn put(conn: &Connection, key: &str, value: &str) -> StoreResult<()> {
    conn.execute(
        "INSERT INTO cache (key, value, fetched_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, fetched_at = excluded.fetched_at",
        params![key, value, now_ms()],
    )?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LedgerRow {
    pub widget: String,
    pub host: String,
    pub requests: i64,
    pub failures: i64,
    pub last_at: i64,
}

/// Privacy Ledger: every outbound request is recorded with the widget that made it.
pub fn log_request(conn: &Connection, widget: &str, host: &str, ok: bool) -> StoreResult<()> {
    conn.execute(
        "INSERT INTO network_log (at, widget, host, ok) VALUES (?1, ?2, ?3, ?4)",
        params![now_ms(), widget, host, ok],
    )?;
    conn.execute(
        "DELETE FROM network_log WHERE at < ?1",
        [now_ms() - 30 * 86_400_000],
    )?;
    Ok(())
}

pub fn ledger(conn: &Connection) -> StoreResult<Vec<LedgerRow>> {
    let mut stmt = conn.prepare(
        "SELECT widget, host, COUNT(*), SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END), MAX(at)
         FROM network_log GROUP BY widget, host ORDER BY MAX(at) DESC",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(LedgerRow {
            widget: r.get(0)?,
            host: r.get(1)?,
            requests: r.get(2)?,
            failures: r.get(3)?,
            last_at: r.get(4)?,
        })
    })?;
    rows.collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::test_conn;

    #[test]
    fn cache_upserts() {
        let conn = test_conn();
        assert!(get(&conn, "k").unwrap().is_none());
        put(&conn, "k", "1").unwrap();
        put(&conn, "k", "2").unwrap();
        assert_eq!(get(&conn, "k").unwrap().unwrap().0, "2");
    }

    #[test]
    fn ledger_groups_by_widget_and_host() {
        let conn = test_conn();
        log_request(&conn, "weather", "api.open-meteo.com", true).unwrap();
        log_request(&conn, "weather", "api.open-meteo.com", false).unwrap();
        log_request(&conn, "calendar", "calendar.google.com", true).unwrap();
        let rows = ledger(&conn).unwrap();
        let weather = rows.iter().find(|r| r.widget == "weather").unwrap();
        assert_eq!(weather.requests, 2);
        assert_eq!(weather.failures, 1);
        assert_eq!(rows.len(), 2);
    }
}
