use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::Serialize;

use super::{now_ms, StoreResult};

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: i64,
    pub body: String,
    pub pinned: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

fn from_row(row: &Row) -> rusqlite::Result<Note> {
    Ok(Note {
        id: row.get(0)?,
        body: row.get(1)?,
        pinned: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}

const COLUMNS: &str = "id, body, pinned, created_at, updated_at";

pub fn list(conn: &Connection) -> StoreResult<Vec<Note>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLUMNS} FROM notes ORDER BY pinned DESC, updated_at DESC LIMIT 200"
    ))?;
    let rows = stmt.query_map([], from_row)?;
    rows.collect()
}

pub fn get(conn: &Connection, id: i64) -> StoreResult<Option<Note>> {
    conn.query_row(
        &format!("SELECT {COLUMNS} FROM notes WHERE id = ?1"),
        [id],
        from_row,
    )
    .optional()
}

pub fn create(conn: &Connection, body: &str) -> StoreResult<Note> {
    let now = now_ms();
    conn.execute(
        "INSERT INTO notes (body, created_at, updated_at) VALUES (?1, ?2, ?2)",
        params![body, now],
    )?;
    get(conn, conn.last_insert_rowid()).map(|n| n.expect("inserted note"))
}

pub fn update(conn: &Connection, id: i64, body: &str) -> StoreResult<Option<Note>> {
    conn.execute(
        "UPDATE notes SET body = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, body, now_ms()],
    )?;
    get(conn, id)
}

pub fn set_pinned(conn: &Connection, id: i64, pinned: bool) -> StoreResult<Option<Note>> {
    conn.execute(
        "UPDATE notes SET pinned = ?2 WHERE id = ?1",
        params![id, pinned],
    )?;
    get(conn, id)
}

pub fn delete(conn: &Connection, id: i64) -> StoreResult<()> {
    conn.execute("DELETE FROM notes WHERE id = ?1", [id])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::test_conn;

    #[test]
    fn pinned_notes_come_first() {
        let conn = test_conn();
        let a = create(&conn, "first").unwrap();
        let _b = create(&conn, "second").unwrap();
        set_pinned(&conn, a.id, true).unwrap();
        assert_eq!(list(&conn).unwrap()[0].id, a.id);
        update(&conn, a.id, "first, edited").unwrap();
        assert_eq!(get(&conn, a.id).unwrap().unwrap().body, "first, edited");
        delete(&conn, a.id).unwrap();
        assert_eq!(list(&conn).unwrap().len(), 1);
    }
}
