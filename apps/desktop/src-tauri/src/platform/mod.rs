use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

pub trait DockPlatform: Send + Sync {
    fn start_fullscreen_watcher(&self, app: AppHandle, window_label: String);
}

pub struct NativePlatform;

impl DockPlatform for NativePlatform {
    fn start_fullscreen_watcher(&self, app: AppHandle, window_label: String) {
        #[cfg(windows)]
        {
            windows_impl::start_fullscreen_watcher(app, window_label);
        }
        #[cfg(not(windows))]
        {
            let _ = (app, window_label);
        }
    }
}

#[cfg(windows)]
mod windows_impl {
    use super::*;
    use windows::Win32::Foundation::RECT;
    use windows::Win32::Graphics::Gdi::{MonitorFromWindow, MONITOR_DEFAULTTONEAREST};
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetMonitorInfoW, GetWindowRect, MONITORINFO,
    };

    pub fn start_fullscreen_watcher(app: AppHandle, window_label: String) {
        thread::spawn(move || {
            let hidden = Arc::new(AtomicBool::new(false));
            loop {
                thread::sleep(Duration::from_millis(350));
                let Some(window) = app.get_webview_window(&window_label) else {
                    break;
                };
                let dock_hwnd = window.hwnd().ok().map(|h| h.0 as isize);
                let fullscreen = is_foreign_fullscreen(dock_hwnd);
                let was_hidden = hidden.load(Ordering::Relaxed);
                if fullscreen && !was_hidden {
                    let _ = window.hide();
                    hidden.store(true, Ordering::Relaxed);
                    let _ = app.emit("dock:fullscreen-hidden", ());
                } else if !fullscreen && was_hidden {
                    let _ = window.show();
                    hidden.store(false, Ordering::Relaxed);
                    let _ = app.emit("dock:fullscreen-visible", ());
                }
            }
        });
    }

    fn is_foreign_fullscreen(dock_hwnd: Option<isize>) -> bool {
        unsafe {
            let fg = GetForegroundWindow();
            if fg.0 == 0 {
                return false;
            }
            if dock_hwnd.is_some_and(|h| fg.0 as isize == h) {
                return false;
            }
            let mut window_rect = RECT::default();
            if GetWindowRect(fg, &mut window_rect).is_err() {
                return false;
            }
            let monitor = MonitorFromWindow(fg, MONITOR_DEFAULTTONEAREST);
            let mut info = MONITORINFO {
                cbSize: std::mem::size_of::<MONITORINFO>() as u32,
                ..Default::default()
            };
            if GetMonitorInfoW(monitor, &mut info).is_err() {
                return false;
            }
            rects_equal(window_rect, info.rcMonitor)
        }
    }

    fn rects_equal(a: RECT, b: RECT) -> bool {
        a.left == b.left && a.top == b.top && a.right == b.right && a.bottom == b.bottom
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
