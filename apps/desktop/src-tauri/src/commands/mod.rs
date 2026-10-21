use std::sync::Mutex;

use tauri::{AppHandle, Manager, State, WebviewWindow};

use crate::dock_layout::{apply_dock_layout, sync_autostart};
use crate::platform::monitor_id;
use crate::settings::{AppSettings, SettingsStore};

pub struct AppState {
    pub store: Mutex<SettingsStore>,
    pub settings: Mutex<AppSettings>,
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    state
        .settings
        .lock()
        .map(|s| s.clone())
        .map_err(|_| "settings lock poisoned".to_string())
}

#[tauri::command]
pub fn save_settings(
    app: AppHandle,
    window: WebviewWindow,
    state: State<'_, AppState>,
    settings: AppSettings,
) -> Result<AppSettings, String> {
    settings.validate()?;
    {
        let store = state
            .store
            .lock()
            .map_err(|_| "store lock poisoned".to_string())?;
        store.save(&settings).map_err(|e| e.to_string())?;
    }
    {
        let mut current = state
            .settings
            .lock()
            .map_err(|_| "settings lock poisoned".to_string())?;
        *current = settings.clone();
    }
    apply_dock_layout(&window, &settings.dock)?;
    sync_autostart(&app, &settings)?;
    Ok(settings)
}

#[tauri::command]
pub fn apply_dock_layout_command(
    window: WebviewWindow,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| "settings lock poisoned".to_string())?;
    apply_dock_layout(&window, &settings.dock)
}

#[tauri::command]
pub fn get_current_monitor_id(window: WebviewWindow) -> Result<Option<String>, String> {
    Ok(monitor_id(&window))
}

#[tauri::command]
pub fn quit_app(app: AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}

#[tauri::command]
pub fn set_launch_at_startup(
    app: AppHandle,
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<bool, String> {
    let mut settings = state
        .settings
        .lock()
        .map_err(|_| "settings lock poisoned".to_string())?;
    settings.dock.launch_at_startup = enabled;
    settings.validate()?;
    {
        let store = state
            .store
            .lock()
            .map_err(|_| "store lock poisoned".to_string())?;
        store.save(&settings).map_err(|e| e.to_string())?;
    }
    sync_autostart(&app, &settings)?;
    Ok(enabled)
}
