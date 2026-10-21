use std::sync::Arc;

use serde::Deserialize;
use serde_json::Value;
use tauri::{AppHandle, State};

use crate::engine::bus::BusEvent;
use crate::engine::rules::{self, Decision, Rule};
use crate::services::automation::{self as runtime, Automation};
use crate::state::{notify_changed, AppState};
use crate::store::activity::{self, ActivityEntry};
use crate::store::cache::{self, LedgerRow};
use crate::store::rules as rule_store;

fn reload(app: &AppHandle, state: &AppState, automation: &Automation) {
    automation.reload(state);
    notify_changed(app, "rules");
}

#[tauri::command]
pub fn list_rules(state: State<'_, AppState>) -> Result<Vec<Rule>, String> {
    state.db.with(rule_store::list)
}

#[tauri::command]
pub fn list_recipes() -> Vec<Rule> {
    rules::recipes()
}

#[tauri::command]
pub fn save_rule(
    app: AppHandle,
    state: State<'_, AppState>,
    automation: State<'_, Arc<Automation>>,
    rule: Rule,
) -> Result<Rule, String> {
    rule.validate()?;
    state.db.with(|c| rule_store::upsert(c, &rule))?;
    automation.forget(&rule.id);
    reload(&app, &state, &automation);
    Ok(rule)
}

#[tauri::command]
pub fn set_rule_enabled(
    app: AppHandle,
    state: State<'_, AppState>,
    automation: State<'_, Arc<Automation>>,
    id: String,
    enabled: bool,
) -> Result<(), String> {
    let mut rule = state
        .db
        .with(rule_store::list)?
        .into_iter()
        .find(|r| r.id == id)
        .ok_or_else(|| format!("no rule {id}"))?;
    rule.enabled = enabled;
    state.db.with(|c| rule_store::upsert(c, &rule))?;
    reload(&app, &state, &automation);
    Ok(())
}

#[tauri::command]
pub fn delete_rule(
    app: AppHandle,
    state: State<'_, AppState>,
    automation: State<'_, Arc<Automation>>,
    id: String,
) -> Result<(), String> {
    state.db.with(|c| rule_store::delete(c, &id))?;
    automation.forget(&id);
    reload(&app, &state, &automation);
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct SampleEvent {
    pub name: String,
    #[serde(default)]
    pub payload: Value,
}

#[tauri::command]
pub fn dry_run_rule(
    state: State<'_, AppState>,
    rule: Rule,
    event: SampleEvent,
) -> Result<Decision, String> {
    rule.validate()?;
    let payload = if event.payload.is_object() {
        event.payload
    } else {
        Value::Object(Default::default())
    };
    let event = BusEvent::new(&event.name, "studio", payload);
    Ok(runtime::dry_run(&state, &rule, &event))
}

#[tauri::command]
pub fn list_activity(
    state: State<'_, AppState>,
    limit: Option<i64>,
) -> Result<Vec<ActivityEntry>, String> {
    state
        .db
        .with(|c| activity::list(c, limit.unwrap_or(100).clamp(1, 500)))
}

#[tauri::command]
pub fn undo_activity(app: AppHandle, state: State<'_, AppState>, id: i64) -> Result<(), String> {
    runtime::undo(&app, &state, id)
}

#[tauri::command]
pub fn clear_activity(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    state.db.with(activity::clear)?;
    notify_changed(&app, "activity");
    Ok(())
}

#[tauri::command]
pub fn get_privacy_ledger(state: State<'_, AppState>) -> Result<Vec<LedgerRow>, String> {
    state.db.with(cache::ledger)
}
