use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};

use crate::platform::{
    self, PowerAction, ShellApp, Shortcut, ThumbnailSlot, VolumeState, WindowAction,
    WindowsSnapshot,
};
use crate::services::apps::{is_launchable, taskbar_pins, AppCatalog};
use crate::state::AppState;

const MAX_PATH_CHARS: usize = 1024;
const MAX_THUMBNAILS: usize = 12;

fn known_window(state: &AppState, id: i64) -> Result<(), String> {
    let listed = state
        .live
        .windows
        .lock()
        .map(|w| w.windows.iter().any(|w| w.id == id))
        .unwrap_or(false);
    if listed {
        Ok(())
    } else {
        Err("that window isn't open any more".into())
    }
}

#[tauri::command]
pub fn list_windows(state: State<'_, AppState>) -> WindowsSnapshot {
    state
        .live
        .windows
        .lock()
        .map(|w| w.clone())
        .unwrap_or_default()
}

#[tauri::command]
pub fn window_action(
    state: State<'_, AppState>,
    id: i64,
    action: WindowAction,
) -> Result<(), String> {
    known_window(&state, id)?;
    let handle = id as isize;
    match action {
        WindowAction::Activate => platform::activate_window(handle),
        WindowAction::Minimize => platform::minimize_window(handle),
        WindowAction::Close => platform::close_window(handle),
    }
}

#[tauri::command]
pub async fn get_app_icon(
    catalog: State<'_, AppCatalog>,
    path: String,
    window: Option<i64>,
) -> Result<Option<String>, String> {
    if path.is_empty() || path.chars().count() > MAX_PATH_CHARS {
        return Ok(None);
    }
    Ok(catalog.icon(&path, window))
}

#[tauri::command]
pub async fn list_installed_apps(catalog: State<'_, AppCatalog>) -> Result<Vec<ShellApp>, String> {
    Ok(catalog.installed())
}

#[tauri::command]
pub async fn list_taskbar_pins() -> Result<Vec<ShellApp>, String> {
    Ok(taskbar_pins())
}

#[tauri::command]
pub async fn launch_app(
    state: State<'_, AppState>,
    catalog: State<'_, AppCatalog>,
    path: String,
) -> Result<(), String> {
    if path.chars().count() > MAX_PATH_CHARS {
        return Err("that path is too long".into());
    }
    let windows = state
        .live
        .windows
        .lock()
        .map(|w| w.windows.clone())
        .unwrap_or_default();
    let settings = state.settings();
    let installed = catalog.installed();
    if !is_launchable(&path, &settings, &installed, &windows) {
        return Err("OpenDock only starts pinned or installed apps".into());
    }
    platform::launch_path(&path)
}

fn store_volume(app: &AppHandle, volume: VolumeState) -> VolumeState {
    let state = app.state::<AppState>();
    if let Ok(mut slot) = state.live.volume.lock() {
        *slot = Some(volume);
    }
    let _ = app.emit("volume:state", Some(volume));
    volume
}

#[tauri::command]
pub async fn get_volume(state: State<'_, AppState>) -> Result<Option<VolumeState>, String> {
    let cached = state.live.volume.lock().ok().and_then(|v| *v);
    Ok(cached.or_else(platform::volume))
}

#[tauri::command]
pub async fn set_volume(app: AppHandle, level: u8) -> Result<VolumeState, String> {
    platform::set_volume(level.min(100)).map(|v| store_volume(&app, v))
}

#[tauri::command]
pub async fn set_muted(app: AppHandle, muted: bool) -> Result<VolumeState, String> {
    platform::set_muted(muted).map(|v| store_volume(&app, v))
}

#[tauri::command]
pub fn send_shortcut(shortcut: Shortcut) -> Result<(), String> {
    platform::send_shortcut(shortcut)
}

#[tauri::command]
pub fn power_action(
    app: AppHandle,
    state: State<'_, AppState>,
    action: PowerAction,
) -> Result<(), String> {
    if action.ends_session() {
        // Windows may not give OpenDock time to clean up, so hand the taskbar back first.
        if let Err(error) = state.taskbar.restore() {
            tracing::warn!(%error, "could not restore the taskbar before shutting down");
        }
        if let Some(dock) = app.get_webview_window("main") {
            let _ = platform::reserve_edge(&dock, None);
        }
    }
    platform::power_action(action)
}

#[tauri::command]
pub fn show_thumbnails(
    window: WebviewWindow,
    state: State<'_, AppState>,
    slots: Vec<ThumbnailSlot>,
) -> usize {
    let slots: Vec<ThumbnailSlot> = slots
        .into_iter()
        .filter(|s| known_window(&state, s.id).is_ok())
        .filter(|s| s.width > 0.0 && s.height > 0.0)
        .take(MAX_THUMBNAILS)
        .collect();
    platform::set_thumbnails(&window, &slots)
}

#[tauri::command]
pub fn clear_thumbnails() {
    platform::clear_thumbnails();
}
