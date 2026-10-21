use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::Serialize;

use super::StoreResult;

const KEEP_ROWS: i64 = 500;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEntry {
    pub id: i64,
    pub at: i64,
    pub rule_id: String,
    pub rule_name: String,
    pub event: String,
    pub summary: String,
    /// JSON list of reverse operations; present only when the run can be undone.
    #[serde(skip)]
    pub undo: Option<String>,
    pub can_undo: bool,
    pub undone: bool,
}

fn from_row(row: &Row) -> rusqlite::Result<ActivityEntry> {
    let undo: Option<String> = row.get(6)?;
    let undone: bool = row.get(7)?;
    Ok(ActivityEntry {
        id: row.get(0)?,
        at: row.get(1)?,
        rule_id: row.get(2)?,
        rule_name: row.get(3)?,
        event: row.get(4)?,
        summary: row.get(5)?,
        can_undo: undo.is_some() && !undone,
        undo,
        undone,
    })
}

const COLUMNS: &str = "id, at, rule_id, rule_name, event, summary, undo, undone";

pub struct NewEntry<'a> {
    pub at: i64,
    pub rule_id: &'a str,
    pub rule_name: &'a str,
    pub event: &'a str,
    pub summary: &'a str,
    pub undo: Option<String>,
}

pub fn record(conn: &Connection, entry: NewEntry) -> StoreResult<i64> {
    conn.execute(
        "INSERT INTO activity (at, rule_id, rule_name, event, summary, undo)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            entry.at,
            entry.rule_id,
            entry.rule_name,
            entry.event,
            entry.summary,
            entry.undo
        ],
    )?;
    let id = conn.last_insert_rowid();
    conn.execute(
        "DELETE FROM activity WHERE id <= (SELECT id FROM activity ORDER BY id DESC LIMIT 1 OFFSET ?1)",
        [KEEP_ROWS],
    )?;
    Ok(id)
}

pub fn list(conn: &Connection, limit: i64) -> StoreResult<Vec<ActivityEntry>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLUMNS} FROM activity ORDER BY at DESC, id DESC LIMIT ?1"
    ))?;
    let rows = stmt.query_map([limit], from_row)?;
    rows.collect()
}

pub fn get(conn: &Connection, id: i64) -> StoreResult<Option<ActivityEntry>> {
    conn.query_row(
        &format!("SELECT {COLUMNS} FROM activity WHERE id = ?1"),
        [id],
        from_row,
    )
    .optional()
}

pub fn mark_undone(conn: &Connection, id: i64) -> StoreResult<()> {
    conn.execute("UPDATE activity SET undone = 1 WHERE id = ?1", [id])?;
    Ok(())
}

pub fn clear(conn: &Connection) -> StoreResult<()> {
    conn.execute("DELETE FROM activity", [])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::test_conn;

    #[test]
    fn records_undo_and_trims() {
        let conn = test_conn();
        let id = record(
            &conn,
            NewEntry {
                at: 5,
                rule_id: "meeting-mode",
                rule_name: "Meeting mode",
                event: "calendar.event.starting",
                summary: "Paused media",
                undo: Some("[]".into()),
            },
        )
        .unwrap();
        assert!(get(&conn, id).unwrap().unwrap().can_undo);
        mark_undone(&conn, id).unwrap();
        assert!(!get(&conn, id).unwrap().unwrap().can_undo);

        for i in 0..(KEEP_ROWS + 20) {
            record(
                &conn,
                NewEntry {
                    at: 10 + i,
                    rule_id: "r",
                    rule_name: "R",
                    event: "e.x",
                    summary: "s",
                    undo: None,
                },
            )
            .unwrap();
        }
        assert_eq!(list(&conn, 10_000).unwrap().len() as i64, KEEP_ROWS);
    }
}
