use serde_json::json;
use tauri::{AppHandle, Manager, State};

use crate::engine::bus::BusEvent;
use crate::platform::{self, MediaCommand, MediaState, SystemStats};
use crate::services::calendar as calendar_service;
use crate::services::focus::FocusState;
use crate::services::weather::{self, CityResult, WeatherSnapshot};
use crate::services::{emit_focus, Wakers};
use crate::state::{notify_changed, AppState};
use crate::store::calendar::{self, Calendar, CalendarEvent};
use crate::store::notes::{self, Note};
use crate::store::todos::{self, Todo};

fn clean_text(value: &str, max: usize, what: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(format!("{what} can't be empty"));
    }
    if trimmed.chars().count() > max {
        return Err(format!("{what} must be at most {max} characters"));
    }
    Ok(trimmed.to_string())
}

// ---------- media ----------

#[tauri::command]
pub fn get_media_state(state: State<'_, AppState>) -> MediaState {
    state
        .live
        .media
        .lock()
        .map(|m| m.clone())
        .unwrap_or_default()
}

#[tauri::command]
pub async fn media_control(command: MediaCommand) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || platform::media_command(command))
        .await
        .map_err(|e| e.to_string())?
}

// ---------- system ----------

#[tauri::command]
pub fn get_system_stats(state: State<'_, AppState>) -> Option<SystemStats> {
    state.live.stats.lock().ok().and_then(|s| s.clone())
}

#[tauri::command]
pub fn open_start_menu() -> Result<(), String> {
    platform::open_start_menu()
}

// ---------- focus ----------

#[tauri::command]
pub fn get_focus_state(state: State<'_, AppState>) -> FocusState {
    state.focus.snapshot(&state.db)
}

#[tauri::command]
pub fn focus_start(
    app: AppHandle,
    state: State<'_, AppState>,
    minutes: Option<u32>,
) -> Result<FocusState, String> {
    let minutes = minutes.unwrap_or(state.settings().widgets.focus.focus_minutes);
    state.focus.start(&state.db, &state.bus, minutes)?;
    emit_focus(&app, &state);
    Ok(state.focus.snapshot(&state.db))
}

#[tauri::command]
pub fn focus_stop(app: AppHandle, state: State<'_, AppState>) -> Result<FocusState, String> {
    state.focus.stop(&state.db, &state.bus)?;
    emit_focus(&app, &state);
    Ok(state.focus.snapshot(&state.db))
}

// ---------- todos ----------

#[tauri::command]
pub fn list_todos(state: State<'_, AppState>) -> Result<Vec<Todo>, String> {
    state.db.with(todos::list)
}

#[tauri::command]
pub fn add_todo(app: AppHandle, state: State<'_, AppState>, title: String) -> Result<Todo, String> {
    let title = clean_text(&title, 200, "A todo")?;
    let todo = state.db.with(|c| todos::add(c, &title))?;
    notify_changed(&app, "todos");
    Ok(todo)
}

#[tauri::command]
pub fn set_todo_done(
    app: AppHandle,
    state: State<'_, AppState>,
    id: i64,
    done: bool,
) -> Result<Option<Todo>, String> {
    let (todo, remaining) = state.db.with(|c| todos::set_done(c, id, done))?;
    if done {
        if let Some(t) = &todo {
            state.publish(BusEvent::new(
                "todos.completed",
                "todos",
                json!({ "title": t.title, "remaining": remaining }),
            ));
        }
    }
    notify_changed(&app, "todos");
    Ok(todo)
}

#[tauri::command]
pub fn rename_todo(
    app: AppHandle,
    state: State<'_, AppState>,
    id: i64,
    title: String,
) -> Result<Option<Todo>, String> {
    let title = clean_text(&title, 200, "A todo")?;
    let todo = state.db.with(|c| todos::rename(c, id, &title))?;
    notify_changed(&app, "todos");
    Ok(todo)
}

#[tauri::command]
pub fn delete_todo(app: AppHandle, state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.db.with(|c| todos::delete(c, id))?;
    notify_changed(&app, "todos");
    Ok(())
}

#[tauri::command]
pub fn clear_done_todos(app: AppHandle, state: State<'_, AppState>) -> Result<usize, String> {
    let removed = state.db.with(todos::clear_done)?;
    notify_changed(&app, "todos");
    Ok(removed)
}

// ---------- notes ----------

#[tauri::command]
pub fn list_notes(state: State<'_, AppState>) -> Result<Vec<Note>, String> {
    state.db.with(notes::list)
}

#[tauri::command]
pub fn create_note(
    app: AppHandle,
    state: State<'_, AppState>,
    body: String,
) -> Result<Note, String> {
    let body = clean_text(&body, 10_000, "A note")?;
    let note = state.db.with(|c| notes::create(c, &body))?;
    notify_changed(&app, "notes");
    Ok(note)
}

#[tauri::command]
pub fn update_note(
    app: AppHandle,
    state: State<'_, AppState>,
    id: i64,
    body: String,
) -> Result<Option<Note>, String> {
    let body = clean_text(&body, 10_000, "A note")?;
    let note = state.db.with(|c| notes::update(c, id, &body))?;
    notify_changed(&app, "notes");
    Ok(note)
}

#[tauri::command]
pub fn pin_note(
    app: AppHandle,
    state: State<'_, AppState>,
    id: i64,
    pinned: bool,
) -> Result<Option<Note>, String> {
    let note = state.db.with(|c| notes::set_pinned(c, id, pinned))?;
    notify_changed(&app, "notes");
    Ok(note)
}

#[tauri::command]
pub fn delete_note(app: AppHandle, state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.db.with(|c| notes::delete(c, id))?;
    notify_changed(&app, "notes");
    Ok(())
}

// ---------- weather ----------

#[tauri::command]
pub fn get_weather(state: State<'_, AppState>) -> Option<WeatherSnapshot> {
    state.live.weather.lock().ok().and_then(|w| w.clone())
}

#[tauri::command]
pub fn refresh_weather(app: AppHandle) {
    app.state::<Wakers>().wake_weather();
}

#[tauri::command]
pub async fn search_city(app: AppHandle, query: String) -> Result<Vec<CityResult>, String> {
    if query.chars().count() > 100 {
        return Err("search is too long".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        weather::search_city(&state.db, &query)
    })
    .await
    .map_err(|e| e.to_string())?
}

// ---------- calendar ----------

#[tauri::command]
pub fn list_calendars(state: State<'_, AppState>) -> Result<Vec<Calendar>, String> {
    state.db.with(calendar::list)
}

#[tauri::command]
pub async fn add_calendar(app: AppHandle, name: String, url: String) -> Result<i64, String> {
    if name.chars().count() > 60 || url.len() > 2048 {
        return Err("name or link is too long".into());
    }
    let id = {
        let state = app.state::<AppState>();
        calendar_service::add_calendar(&state.db, &name, &url)?
    };
    app.state::<Wakers>().wake_calendar();
    notify_changed(&app, "calendar");
    Ok(id)
}

#[tauri::command]
pub fn remove_calendar(app: AppHandle, state: State<'_, AppState>, id: i64) -> Result<(), String> {
    calendar_service::remove_calendar(&state.db, id)?;
    notify_changed(&app, "calendar");
    Ok(())
}

#[tauri::command]
pub fn sync_calendars(app: AppHandle) {
    app.state::<Wakers>().wake_calendar();
}

#[tauri::command]
pub fn upcoming_events(
    state: State<'_, AppState>,
    hours: Option<i64>,
) -> Result<Vec<CalendarEvent>, String> {
    calendar_service::upcoming(&state.db, hours.unwrap_or(48).clamp(1, 24 * 14))
}
