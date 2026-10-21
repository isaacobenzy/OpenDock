use tauri::{PhysicalPosition, PhysicalSize, WebviewWindow};

use crate::geometry::compute_dock_rect;
use crate::platform::{ensure_monitor, work_area_from_window};
use crate::settings::types::{AppSettings, DockSettings};

pub fn apply_dock_layout(window: &WebviewWindow, settings: &DockSettings) -> Result<(), String> {
    ensure_monitor(window, settings.monitor_id.as_deref())?;
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let work = work_area_from_window(window).ok_or_else(|| "no monitor work area".to_string())?;
    let rect = compute_dock_rect(work, settings.position, settings.size, settings.mode);

    let width = (rect.width as f64 * scale).round() as u32;
    let height = (rect.height as f64 * scale).round() as u32;
    let x = (rect.x as f64 * scale).round() as i32;
    let y = (rect.y as f64 * scale).round() as i32;

    window
        .set_size(PhysicalSize::new(width, height))
        .map_err(|e| e.to_string())?;
    window
        .set_position(PhysicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn sync_autostart(app: &tauri::AppHandle, settings: &AppSettings) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    let autostart = app.autolaunch();
    if settings.dock.launch_at_startup {
        autostart.enable().map_err(|e| e.to_string())
    } else {
        autostart.disable().map_err(|e| e.to_string())
    }
}
