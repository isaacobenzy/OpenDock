//! SQLite persistence. Each repository is a set of free functions over a `Connection`,
//! so they run the same against the app database and in-memory test databases.

pub mod activity;
pub mod cache;
pub mod calendar;
pub mod focus;
pub mod notes;
pub mod rules;
pub mod todos;

use std::path::Path;
use std::sync::Mutex;

use rusqlite::Connection;

pub type StoreResult<T> = Result<T, rusqlite::Error>;

/// Ordered schema migrations. Index + 1 is the resulting `user_version`.
/// Never edit a shipped migration; append a new one.
const MIGRATIONS: &[&str] = &[r#"
CREATE TABLE todos (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    completed_at INTEGER
);
CREATE TABLE notes (
    id INTEGER PRIMARY KEY,
    body TEXT NOT NULL,
    pinned INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE TABLE focus_sessions (
    id INTEGER PRIMARY KEY,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    planned_minutes INTEGER NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX focus_sessions_started ON focus_sessions(started_at);
CREATE TABLE rules (
    id TEXT PRIMARY KEY,
    body TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
);
CREATE TABLE activity (
    id INTEGER PRIMARY KEY,
    at INTEGER NOT NULL,
    rule_id TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    event TEXT NOT NULL,
    summary TEXT NOT NULL,
    undo TEXT,
    undone INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX activity_at ON activity(at DESC);
CREATE TABLE calendars (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    host TEXT NOT NULL,
    last_synced_at INTEGER,
    last_error TEXT
);
CREATE TABLE calendar_events (
    calendar_id INTEGER NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
    uid TEXT NOT NULL,
    title TEXT NOT NULL,
    location TEXT NOT NULL,
    starts_at INTEGER NOT NULL,
    ends_at INTEGER NOT NULL,
    all_day INTEGER NOT NULL,
    PRIMARY KEY (calendar_id, uid, starts_at)
);
CREATE INDEX calendar_events_start ON calendar_events(starts_at);
CREATE TABLE cache (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    fetched_at INTEGER NOT NULL
);
CREATE TABLE network_log (
    id INTEGER PRIMARY KEY,
    at INTEGER NOT NULL,
    widget TEXT NOT NULL,
    host TEXT NOT NULL,
    ok INTEGER NOT NULL
);
CREATE INDEX network_log_host ON network_log(widget, host);
"#];

pub const SCHEMA_VERSION: i64 = MIGRATIONS.len() as i64;

pub fn migrate(conn: &mut Connection) -> StoreResult<i64> {
    conn.pragma_update(None, "foreign_keys", "ON")?;
    let current: i64 = conn.pragma_query_value(None, "user_version", |r| r.get(0))?;
    if current > SCHEMA_VERSION {
        return Err(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_MISMATCH),
            Some(format!(
                "database schema {current} is newer than this OpenDock build ({SCHEMA_VERSION})"
            )),
        ));
    }
    for (index, sql) in MIGRATIONS.iter().enumerate().skip(current as usize) {
        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
        tx.pragma_update(None, "user_version", (index + 1) as i64)?;
        tx.commit()?;
    }
    Ok(SCHEMA_VERSION)
}

pub fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn open(path: &Path) -> StoreResult<Self> {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let mut conn = Connection::open(path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;
        conn.busy_timeout(std::time::Duration::from_secs(3))?;
        migrate(&mut conn)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    #[cfg(test)]
    pub fn open_in_memory() -> StoreResult<Self> {
        let mut conn = Connection::open_in_memory()?;
        migrate(&mut conn)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn with<T>(&self, f: impl FnOnce(&Connection) -> StoreResult<T>) -> Result<T, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| "database lock poisoned".to_string())?;
        f(&conn).map_err(|e| e.to_string())
    }
}

#[cfg(test)]
pub(crate) fn test_conn() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    migrate(&mut conn).unwrap();
    conn
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fresh_database_reaches_latest_version() {
        let mut conn = Connection::open_in_memory().unwrap();
        assert_eq!(migrate(&mut conn).unwrap(), SCHEMA_VERSION);
        let version: i64 = conn
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .unwrap();
        assert_eq!(version, SCHEMA_VERSION);
    }

    #[test]
    fn migrating_twice_is_a_no_op() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn).unwrap();
        conn.execute(
            "INSERT INTO todos (title, created_at) VALUES ('keep me', 1)",
            [],
        )
        .unwrap();
        migrate(&mut conn).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM todos", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn refuses_databases_from_newer_builds() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "user_version", SCHEMA_VERSION + 1)
            .unwrap();
        assert!(migrate(&mut conn).is_err());
    }

    #[test]
    fn file_database_round_trip() {
        let dir = std::env::temp_dir().join(format!("opendock-db-{}", now_ms()));
        let path = dir.join("opendock.db");
        {
            let db = Database::open(&path).unwrap();
            db.with(|c| todos::add(c, "persisted")).unwrap();
        }
        let db = Database::open(&path).unwrap();
        let items = db.with(todos::list).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].title, "persisted");
        drop(db);
        let _ = std::fs::remove_dir_all(dir);
    }
}
