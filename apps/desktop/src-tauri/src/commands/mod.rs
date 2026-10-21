pub mod apps;
pub mod automation;
pub mod widgets;
pub mod windows;

use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};

use crate::dock_layout::{apply_dock_layout, sync_autostart};
use crate::platform::monitor_id;
use crate::platform::taskbar::TaskbarStatus;
use crate::services::Wakers;
use crate::settings::AppSettings;
use crate::state::AppState;

fn relayout_dock(app: &AppHandle, state: &AppState, settings: &AppSettings) -> Result<(), String> {
    let Some(dock) = app.get_webview_window("main") else {
        return Ok(());
    };
    let length = state.live.dock_length.lock().ok().and_then(|l| *l);
    apply_dock_layout(&dock, settings, length)
}

/// Validates, saves and applies settings, then tells every window. Shared by commands
/// and by automations that change settings.
pub fn persist_settings(
    app: &AppHandle,
    state: &AppState,
    settings: AppSettings,
) -> Result<AppSettings, String> {
    settings.validate()?;
    let previous = state.settings();
    let taskbar_changed = previous.taskbar.mode != settings.taskbar.mode;
    if taskbar_changed {
        state.taskbar.apply(settings.taskbar.mode)?;
    }
    {
        let store = state
            .store
            .lock()
            .map_err(|_| "store lock poisoned".to_string())?;
        store.save(&settings).map_err(|e| e.to_string())?;
    }
    if let Ok(mut current) = state.settings.lock() {
        *current = settings.clone();
    }
    relayout_dock(app, state, &settings)?;
    if previous.dock.launch_at_startup != settings.dock.launch_at_startup {
        sync_autostart(app, &settings)?;
    }
    if taskbar_changed {
        let app = app.clone();
        thread::spawn(move || {
            // The work area updates asynchronously after the taskbar changes.
            thread::sleep(Duration::from_millis(600));
            let state = app.state::<AppState>();
            let current = state.settings();
            let _ = relayout_dock(&app, &state, &current);
        });
    }
    if previous.widgets.weather != settings.widgets.weather {
        app.state::<Wakers>().wake_weather();
    }
    let _ = app.emit("settings:changed", &settings);
    Ok(settings)
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> AppSettings {
    state.settings()
}

#[tauri::command]
pub fn save_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: AppSettings,
) -> Result<AppSettings, String> {
    persist_settings(&app, &state, settings)
}

#[tauri::command]
pub fn apply_dock_layout_command(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let settings = state.settings();
    relayout_dock(&app, &state, &settings)
}

/// The dock reports how long its content is so a pill can hug its widgets.
#[tauri::command]
pub fn set_dock_length(
    app: AppHandle,
    state: State<'_, AppState>,
    length: u32,
) -> Result<(), String> {
    let length = length.clamp(120, 8000);
    {
        let mut slot = state
            .live
            .dock_length
            .lock()
            .map_err(|_| "dock lock poisoned".to_string())?;
        if *slot == Some(length) {
            return Ok(());
        }
        *slot = Some(length);
    }
    let settings = state.settings();
    relayout_dock(&app, &state, &settings)
}

#[tauri::command]
pub fn get_current_monitor_id(window: WebviewWindow) -> Option<String> {
    monitor_id(&window)
}

#[tauri::command]
pub fn quit_app(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
pub fn set_launch_at_startup(
    app: AppHandle,
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<bool, String> {
    let mut settings = state.settings();
    settings.dock.launch_at_startup = enabled;
    persist_settings(&app, &state, settings)?;
    Ok(enabled)
}

#[tauri::command]
pub fn get_taskbar_status(state: State<'_, AppState>) -> TaskbarStatus {
    state.taskbar.status()
}
