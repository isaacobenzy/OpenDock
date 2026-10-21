use tauri::{PhysicalPosition, PhysicalSize, WebviewWindow};

use crate::geometry::{compute_dock_rect, cross_axis_thickness, DOCK_MARGIN};
use crate::platform::{
    ensure_monitor, monitor_area_from_window, reserve_edge, work_area_from_window,
};
use crate::settings::types::{AppSettings, TaskbarMode};

pub fn apply_dock_layout(
    window: &WebviewWindow,
    settings: &AppSettings,
    content_length: Option<u32>,
) -> Result<(), String> {
    let dock = &settings.dock;
    ensure_monitor(window, dock.monitor_id.as_deref())?;
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    // A dock that replaces the taskbar owns its edge, so it lays out against the whole
    // monitor; otherwise the reserved strip would push it up every time.
    let replacing = settings.taskbar.mode == TaskbarMode::Replace;
    let area = if replacing {
        monitor_area_from_window(window)
    } else {
        work_area_from_window(window)
    }
    .ok_or_else(|| "no monitor work area".to_string())?;
    let rect = compute_dock_rect(area, dock.position, dock.size, dock.mode, content_length);

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

    let reservation = replacing.then(|| {
        let depth = cross_axis_thickness(dock.size) + 2 * DOCK_MARGIN as u32;
        (dock.position, f64::from(depth))
    });
    reserve_edge(window, reservation)
}

pub fn sync_autostart(app: &tauri::AppHandle, settings: &AppSettings) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    let autostart = app.autolaunch();
    let enabled = autostart.is_enabled().unwrap_or(false);
    if settings.dock.launch_at_startup == enabled {
        return Ok(());
    }
    if settings.dock.launch_at_startup {
        autostart.enable().map_err(|e| e.to_string())
    } else {
        autostart.disable().map_err(|e| e.to_string())
    }
}
