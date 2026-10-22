//! Everything OS-specific lives under this module. Code outside `platform` must not use
//! `cfg(windows)`; it calls these functions, which fall back to safe no-ops elsewhere.

#[cfg(not(windows))]
mod fallback;
pub mod taskbar;
#[cfg(windows)]
mod win;
#[cfg(windows)]
mod win_apps;
#[cfg(windows)]
mod win_system;

#[cfg(not(windows))]
use fallback as imp;
#[cfg(not(windows))]
use fallback as apps_imp;
#[cfg(not(windows))]
use fallback as sys_imp;
#[cfg(windows)]
use win as imp;
#[cfg(windows)]
use win_apps as apps_imp;
#[cfg(windows)]
use win_system as sys_imp;

use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::WebviewWindow;

use crate::geometry::{DockPosition, WorkArea};

pub use apps_imp::{
    activate_window, builtin_apps, clear_thumbnails, close_window, foreground_window, launch_path,
    list_windows, minimize_window, resolve_shortcut, start_menu_dirs, taskbar_pin_dir, window_pid,
};
pub use imp::{
    foreground_fullscreen, media_command, media_state, open_start_menu, set_system_dark_mode,
    system_dark_mode,
};
pub use sys_imp::{power_action, send_shortcut, set_muted, set_volume, volume};

/// A top-level window the user would expect to see on a taskbar.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppWindow {
    pub id: i64,
    pub title: String,
    /// Lower-cased executable path; windows of one app share it.
    pub app_id: String,
    pub exe: String,
    pub app_name: String,
    pub minimized: bool,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WindowsSnapshot {
    pub windows: Vec<AppWindow>,
    /// The window the user was last working in, ignoring OpenDock's own windows.
    pub active: Option<i64>,
}

/// Something the launcher can start: a Start menu shortcut, an executable or a URI.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ShellApp {
    pub name: String,
    pub path: String,
    /// The executable a shortcut points at, used to match running windows.
    pub target: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VolumeState {
    pub level: u8,
    pub muted: bool,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum WindowAction {
    Activate,
    Minimize,
    Close,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Shortcut {
    QuickSettings,
    Notifications,
    ShowDesktop,
    TaskView,
    Search,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PowerAction {
    Lock,
    Sleep,
    SignOut,
    Restart,
    ShutDown,
}

impl PowerAction {
    /// Sign-out, restart and shut down can kill OpenDock before it exits normally.
    pub fn ends_session(self) -> bool {
        matches!(self, Self::SignOut | Self::Restart | Self::ShutDown)
    }
}

/// Where a live window preview goes inside a popup, in CSS pixels.
#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailSlot {
    pub id: i64,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Encodes straight RGBA pixels as a PNG data URL.
pub fn png_data_url(width: u32, height: u32, rgba: &[u8]) -> Option<String> {
    if width == 0 || height == 0 || rgba.len() != (width * height * 4) as usize {
        return None;
    }
    let mut bytes = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut bytes, width, height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().ok()?;
        writer.write_image_data(rgba).ok()?;
    }
    Some(format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    ))
}

pub fn app_icon_data_url(path: &str) -> Option<String> {
    let (width, height, rgba) = apps_imp::icon_rgba(path)?;
    png_data_url(width, height, &rgba)
}

/// Fits a `source` sized image inside `slot` (left, top, right, bottom), centred, never
/// scaled up.
pub fn fit_rect(source: (i32, i32), slot: [i32; 4]) -> [i32; 4] {
    let [left, top, right, bottom] = slot;
    let (slot_w, slot_h) = ((right - left).max(1), (bottom - top).max(1));
    let (src_w, src_h) = (source.0.max(1), source.1.max(1));
    let scale = (slot_w as f64 / src_w as f64)
        .min(slot_h as f64 / src_h as f64)
        .min(1.0);
    let w = (src_w as f64 * scale).round() as i32;
    let h = (src_h as f64 * scale).round() as i32;
    let x = left + (slot_w - w) / 2;
    let y = top + (slot_h - h) / 2;
    [x, y, x + w, y + h]
}

/// Draws live previews of other windows into `window` at the given slots.
pub fn set_thumbnails(window: &WebviewWindow, slots: &[ThumbnailSlot]) -> usize {
    let Some(handle) = raw_handle(window) else {
        return 0;
    };
    let scale = window.scale_factor().unwrap_or(1.0);
    let physical: Vec<(isize, [i32; 4])> = slots
        .iter()
        .map(|s| {
            let px = |v: f64| (v * scale).round() as i32;
            (
                s.id as isize,
                [px(s.x), px(s.y), px(s.x + s.width), px(s.y + s.height)],
            )
        })
        .collect();
    apps_imp::set_thumbnails(handle, &physical)
}

/// The strip along `edge` of `monitor` (left, top, right, bottom) that is `thickness` deep.
pub fn edge_band(edge: DockPosition, monitor: [i32; 4], thickness: i32) -> [i32; 4] {
    let [left, top, right, bottom] = monitor;
    match edge {
        DockPosition::Bottom => [left, bottom - thickness, right, bottom],
        DockPosition::Top => [left, top, right, top + thickness],
        DockPosition::Left => [left, top, left + thickness, bottom],
        DockPosition::Right => [right - thickness, top, right, bottom],
    }
}

/// Reserves a screen edge for the dock so maximised windows stop at it, like the taskbar.
/// `None` gives the space back.
pub fn reserve_edge(
    window: &WebviewWindow,
    reservation: Option<(DockPosition, f64)>,
) -> Result<(), String> {
    let Some(handle) = raw_handle(window) else {
        return Ok(());
    };
    let Some((edge, thickness)) = reservation else {
        apps_imp::set_appbar(handle, None);
        return Ok(());
    };
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "no monitor".to_string())?;
    let pos = monitor.position();
    let size = monitor.size();
    let rect = [
        pos.x,
        pos.y,
        pos.x + size.width as i32,
        pos.y + size.height as i32,
    ];
    let depth = (thickness * monitor.scale_factor()).round() as i32;
    apps_imp::set_appbar(handle, Some((edge, edge_band(edge, rect, depth))));
    Ok(())
}

/// The whole monitor in logical pixels, for laying out a dock that owns its edge.
pub fn monitor_area_from_window(window: &WebviewWindow) -> Option<WorkArea> {
    let monitor = window.current_monitor().ok().flatten()?;
    let scale = monitor.scale_factor();
    let pos = monitor.position();
    let size = monitor.size();
    Some(WorkArea {
        x: (pos.x as f64 / scale).round() as i32,
        y: (pos.y as f64 / scale).round() as i32,
        width: (size.width as f64 / scale).round() as u32,
        height: (size.height as f64 / scale).round() as u32,
    })
}

pub fn app_icon_for_window(id: i64) -> Option<String> {
    let (width, height, rgba) = apps_imp::window_icon_rgba(id as isize)?;
    png_data_url(width, height, &rgba)
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MediaState {
    pub available: bool,
    pub playing: bool,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub app: String,
    pub can_next: bool,
    pub can_previous: bool,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MediaCommand {
    Play,
    Pause,
    Toggle,
    Next,
    Previous,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Battery {
    pub percent: u8,
    pub charging: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SystemStats {
    pub cpu: Option<f32>,
    pub memory: Option<f32>,
    pub memory_used_gb: Option<f32>,
    pub memory_total_gb: Option<f32>,
    pub battery: Option<Battery>,
}

/// CPU load needs two samples; this keeps the previous counters.
#[derive(Default)]
pub struct CpuSampler {
    last: Option<(u64, u64)>,
}

impl CpuSampler {
    pub fn sample(&mut self) -> Option<f32> {
        let now = imp::cpu_times()?;
        let previous = self.last.replace(now)?;
        let idle = now.0.saturating_sub(previous.0) as f64;
        let total = now.1.saturating_sub(previous.1) as f64;
        if total <= 0.0 {
            return None;
        }
        Some((((1.0 - idle / total) * 100.0).clamp(0.0, 100.0) * 10.0).round() as f32 / 10.0)
    }
}

pub fn system_stats(cpu: &mut CpuSampler) -> SystemStats {
    let memory = imp::memory();
    let gb = |bytes: u64| ((bytes as f64 / 1_073_741_824.0) * 10.0).round() as f32 / 10.0;
    SystemStats {
        cpu: cpu.sample(),
        memory: memory.map(|m| m.0),
        memory_used_gb: memory.map(|m| gb(m.1.saturating_sub(m.2))),
        memory_total_gb: memory.map(|m| gb(m.1)),
        battery: imp::battery(),
    }
}

/// Native handle of a Tauri window, as an integer, for OS calls.
pub fn raw_handle(window: &WebviewWindow) -> Option<isize> {
    #[cfg(windows)]
    {
        window.hwnd().ok().map(|h| h.0 as isize)
    }
    #[cfg(not(windows))]
    {
        let _ = window;
        None
    }
}

/// Shows a window without stealing focus from the app the user is typing in.
pub fn show_without_focus(window: &WebviewWindow) {
    match raw_handle(window) {
        Some(handle) => imp::show_no_activate(handle),
        None => {
            let _ = window.show();
        }
    }
}

pub fn work_area_from_window(window: &WebviewWindow) -> Option<crate::geometry::WorkArea> {
    let monitor = window.current_monitor().ok().flatten()?;
    let scale = monitor.scale_factor();
    let work = monitor.work_area();
    let pos = work.position;
    let size = work.size;

    let to_logical = |v: u32| (v as f64 / scale).round() as u32;
    let to_logical_i = |v: i32| (v as f64 / scale).round() as i32;

    Some(crate::geometry::WorkArea {
        x: to_logical_i(pos.x),
        y: to_logical_i(pos.y),
        width: to_logical(size.width),
        height: to_logical(size.height),
    })
}

pub fn ensure_monitor(window: &WebviewWindow, monitor_id: Option<&str>) -> Result<(), String> {
    let Some(id) = monitor_id else {
        return Ok(());
    };
    let monitors = window.available_monitors().map_err(|e| e.to_string())?;
    let Some(monitor) = monitors
        .into_iter()
        .find(|m| m.name().is_some_and(|name| name == id))
    else {
        tracing::warn!(
            monitor_id = id,
            "configured monitor missing; using current monitor"
        );
        return Ok(());
    };
    let pos = monitor.work_area().position;
    window
        .set_position(tauri::PhysicalPosition::new(pos.x, pos.y))
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn monitor_id(window: &WebviewWindow) -> Option<String> {
    let monitor = window.current_monitor().ok().flatten()?;
    monitor.name().map(|s| s.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fit_keeps_aspect_and_centres() {
        assert_eq!(fit_rect((1600, 900), [0, 0, 320, 200]), [0, 10, 320, 190]);
        assert_eq!(fit_rect((100, 50), [10, 10, 330, 210]), [120, 85, 220, 135]);
    }

    #[test]
    fn edge_bands_hug_the_monitor() {
        let monitor = [0, 0, 1920, 1080];
        assert_eq!(
            edge_band(DockPosition::Bottom, monitor, 76),
            [0, 1004, 1920, 1080]
        );
        assert_eq!(edge_band(DockPosition::Top, monitor, 76), [0, 0, 1920, 76]);
        assert_eq!(edge_band(DockPosition::Left, monitor, 76), [0, 0, 76, 1080]);
        assert_eq!(
            edge_band(DockPosition::Right, monitor, 76),
            [1844, 0, 1920, 1080]
        );
    }

    #[test]
    fn only_session_ending_power_actions_restore_the_taskbar_first() {
        assert!(!PowerAction::Lock.ends_session());
        assert!(!PowerAction::Sleep.ends_session());
        assert!(PowerAction::SignOut.ends_session());
        assert!(PowerAction::Restart.ends_session());
        assert!(PowerAction::ShutDown.ends_session());
    }

    #[test]
    fn png_data_urls() {
        let pixels = vec![255u8; 2 * 2 * 4];
        let url = png_data_url(2, 2, &pixels).unwrap();
        assert!(url.starts_with("data:image/png;base64,iVBOR"));
        assert!(png_data_url(2, 2, &pixels[..4]).is_none());
    }
}
