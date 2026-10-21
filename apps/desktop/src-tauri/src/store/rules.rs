use rusqlite::{params, Connection};

use super::{cache, now_ms, StoreResult};
use crate::engine::rules::Rule;

const SEEDED_KEY: &str = "rules.seeded";

/// Loads rules in Studio order. Rows that no longer parse are skipped and logged, so a
/// bad row never takes the whole engine down.
pub fn list(conn: &Connection) -> StoreResult<Vec<Rule>> {
    let mut stmt = conn.prepare("SELECT id, body FROM rules ORDER BY position ASC, id ASC")?;
    let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
    let mut out = Vec::new();
    for row in rows {
        let (id, body) = row?;
        match serde_json::from_str::<Rule>(&body) {
            Ok(rule) => out.push(rule),
            Err(error) => tracing::warn!(rule = id, ?error, "skipping unreadable rule"),
        }
    }
    Ok(out)
}

pub fn upsert(conn: &Connection, rule: &Rule) -> StoreResult<()> {
    let body = serde_json::to_string(rule)
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "INSERT INTO rules (id, body, position, updated_at)
         VALUES (?1, ?2, (SELECT COALESCE(MAX(position), -1) + 1 FROM rules), ?3)
         ON CONFLICT(id) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at",
        params![rule.id, body, now_ms()],
    )?;
    Ok(())
}

pub fn delete(conn: &Connection, id: &str) -> StoreResult<()> {
    conn.execute("DELETE FROM rules WHERE id = ?1", [id])?;
    Ok(())
}

/// Inserts the built-in recipes once, on first run. Deleted recipes stay deleted.
pub fn seed_once(conn: &Connection, recipes: &[Rule]) -> StoreResult<bool> {
    if cache::get(conn, SEEDED_KEY)?.is_some() {
        return Ok(false);
    }
    for rule in recipes {
        upsert(conn, rule)?;
    }
    cache::put(conn, SEEDED_KEY, "1")?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::rules::recipes;
    use crate::store::test_conn;

    #[test]
    fn seeds_once_and_keeps_order() {
        let conn = test_conn();
        let all = recipes();
        assert!(seed_once(&conn, &all).unwrap());
        assert!(!seed_once(&conn, &all).unwrap());
        let ids: Vec<String> = list(&conn).unwrap().into_iter().map(|r| r.id).collect();
        let expected: Vec<String> = all.iter().map(|r| r.id.clone()).collect();
        assert_eq!(ids, expected);
    }

    #[test]
    fn upsert_updates_in_place() {
        let conn = test_conn();
        let mut rule = recipes().remove(0);
        upsert(&conn, &rule).unwrap();
        rule.enabled = false;
        upsert(&conn, &rule).unwrap();
        let stored = list(&conn).unwrap();
        assert_eq!(stored.len(), 1);
        assert!(!stored[0].enabled);
        delete(&conn, &rule.id).unwrap();
        assert!(list(&conn).unwrap().is_empty());
    }
}
