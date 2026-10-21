use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::Serialize;

use super::{now_ms, StoreResult};

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Todo {
    pub id: i64,
    pub title: String,
    pub done: bool,
    pub created_at: i64,
    pub completed_at: Option<i64>,
}

fn from_row(row: &Row) -> rusqlite::Result<Todo> {
    Ok(Todo {
        id: row.get(0)?,
        title: row.get(1)?,
        done: row.get(2)?,
        created_at: row.get(3)?,
        completed_at: row.get(4)?,
    })
}

const COLUMNS: &str = "id, title, done, created_at, completed_at";

/// Open todos first (oldest first), then the most recently completed.
pub fn list(conn: &Connection) -> StoreResult<Vec<Todo>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLUMNS} FROM todos ORDER BY done ASC,
         CASE WHEN done = 0 THEN created_at END ASC,
         CASE WHEN done = 1 THEN completed_at END DESC
         LIMIT 200"
    ))?;
    let rows = stmt.query_map([], from_row)?;
    rows.collect()
}

pub fn get(conn: &Connection, id: i64) -> StoreResult<Option<Todo>> {
    conn.query_row(
        &format!("SELECT {COLUMNS} FROM todos WHERE id = ?1"),
        [id],
        from_row,
    )
    .optional()
}

pub fn add(conn: &Connection, title: &str) -> StoreResult<Todo> {
    conn.execute(
        "INSERT INTO todos (title, created_at) VALUES (?1, ?2)",
        params![title, now_ms()],
    )?;
    let id = conn.last_insert_rowid();
    get(conn, id).map(|t| t.expect("inserted todo"))
}

/// Returns the updated todo and how many open todos remain.
pub fn set_done(conn: &Connection, id: i64, done: bool) -> StoreResult<(Option<Todo>, i64)> {
    let completed_at = done.then(now_ms);
    conn.execute(
        "UPDATE todos SET done = ?2, completed_at = ?3 WHERE id = ?1",
        params![id, done, completed_at],
    )?;
    Ok((get(conn, id)?, open_count(conn)?))
}

pub fn rename(conn: &Connection, id: i64, title: &str) -> StoreResult<Option<Todo>> {
    conn.execute(
        "UPDATE todos SET title = ?2 WHERE id = ?1",
        params![id, title],
    )?;
    get(conn, id)
}

pub fn delete(conn: &Connection, id: i64) -> StoreResult<()> {
    conn.execute("DELETE FROM todos WHERE id = ?1", [id])?;
    Ok(())
}

pub fn clear_done(conn: &Connection) -> StoreResult<usize> {
    conn.execute("DELETE FROM todos WHERE done = 1", [])
}

pub fn open_count(conn: &Connection) -> StoreResult<i64> {
    conn.query_row("SELECT COUNT(*) FROM todos WHERE done = 0", [], |r| {
        r.get(0)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::test_conn;

    #[test]
    fn crud_and_ordering() {
        let conn = test_conn();
        let a = add(&conn, "write tests").unwrap();
        let b = add(&conn, "ship it").unwrap();
        assert_eq!(open_count(&conn).unwrap(), 2);

        let (done, remaining) = set_done(&conn, a.id, true).unwrap();
        assert!(done.unwrap().completed_at.is_some());
        assert_eq!(remaining, 1);

        let titles: Vec<String> = list(&conn).unwrap().into_iter().map(|t| t.title).collect();
        assert_eq!(titles, vec!["ship it", "write tests"]);

        rename(&conn, b.id, "ship v1").unwrap();
        assert_eq!(get(&conn, b.id).unwrap().unwrap().title, "ship v1");

        assert_eq!(clear_done(&conn).unwrap(), 1);
        delete(&conn, b.id).unwrap();
        assert!(list(&conn).unwrap().is_empty());
    }
}
