//! Secondary windows: the hub (gallery, Studio, settings), the widget flyout above the
//! dock, and the toast strip. They are created lazily and reused.

use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

use super::automation::ToastPayload;
use crate::geometry::DockPosition;
use crate::platform;
use crate::state::AppState;

pub const HUB: &str = "hub";
pub const FLYOUT: &str = "flyout";
pub const TOAST: &str = "toast";

const FLYOUT_WIDTH: f64 = 360.0;
const LAUNCHER_WIDTH: f64 = 440.0;
const PREVIEW_WIDTH: f64 = 420.0;

fn flyout_width(kind: &str) -> f64 {
    match kind {
        "start" => LAUNCHER_WIDTH,
        "app" => PREVIEW_WIDTH,
        _ => FLYOUT_WIDTH,
    }
}
const TOAST_WIDTH: f64 = 420.0;
const TOAST_HEIGHT: f64 = 64.0;
const GAP: f64 = 10.0;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FlyoutRequest {
    /// A widget id, or "menu" for the dock menu.
    pub kind: String,
    /// The widget a "menu" was opened on, if any.
    #[serde(default)]
    pub target: Option<String>,
    /// Horizontal (or vertical when docked at a side) anchor inside the dock, logical px.
    pub anchor: f64,
}

#[derive(Default)]
pub struct WindowRegistry {
    pub hub_page: Mutex<String>,
    pub flyout: Mutex<Option<FlyoutRequest>>,
    pub flyout_height: Mutex<f64>,
    pub pending_toasts: Mutex<Vec<ToastPayload>>,
}

fn dock_position(app: &AppHandle) -> DockPosition {
    app.state::<AppState>().settings().dock.position
}

fn builder<'a>(
    app: &'a AppHandle,
    label: &'a str,
) -> WebviewWindowBuilder<'a, tauri::Wry, AppHandle> {
    WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
}

pub fn open_hub(app: &AppHandle, page: &str) -> Result<(), String> {
    let registry = app.state::<WindowRegistry>();
    if let Ok(mut current) = registry.hub_page.lock() {
        *current = page.to_string();
    }
    if let Some(window) = app.get_webview_window(HUB) {
        let _ = window.emit("hub:navigate", page);
        let _ = window.unminimize();
        window.show().map_err(|e| e.to_string())?;
        return window.set_focus().map_err(|e| e.to_string());
    }
    let window = builder(app, HUB)
        .title("OpenDock")
        .inner_size(1120.0, 740.0)
        .min_inner_size(860.0, 560.0)
        .center()
        .visible(true)
        .build()
        .map_err(|e| e.to_string())?;
    let _ = window.set_focus();
    Ok(())
}

fn flyout_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(FLYOUT) {
        return Ok(window);
    }
    builder(app, FLYOUT)
        .title("OpenDock panel")
        .inner_size(FLYOUT_WIDTH, 420.0)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .visible(false)
        .build()
        .map_err(|e| e.to_string())
}

/// Places a popup next to the dock, centred on `anchor`, clamped to the monitor.
fn place_near_dock(
    app: &AppHandle,
    window: &WebviewWindow,
    width: f64,
    height: f64,
    anchor: Option<f64>,
) -> Result<(), String> {
    let dock = app
        .get_webview_window("main")
        .ok_or_else(|| "dock window missing".to_string())?;
    let scale = dock.scale_factor().map_err(|e| e.to_string())?;
    let pos = dock.outer_position().map_err(|e| e.to_string())?;
    let size = dock.outer_size().map_err(|e| e.to_string())?;
    let monitor = dock
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "no monitor".to_string())?;
    let area_pos = monitor.position();
    let area_size = monitor.size();

    let w = (width * scale).round() as i32;
    let h = (height * scale).round() as i32;
    let gap = (GAP * scale).round() as i32;
    let (dx, dy, dw, dh) = (pos.x, pos.y, size.width as i32, size.height as i32);
    let anchor_px = anchor.map(|a| (a * scale).round() as i32);

    let (mut x, mut y) = match dock_position(app) {
        DockPosition::Bottom => (dx + anchor_px.unwrap_or(dw / 2) - w / 2, dy - h - gap),
        DockPosition::Top => (dx + anchor_px.unwrap_or(dw / 2) - w / 2, dy + dh + gap),
        DockPosition::Left => (dx + dw + gap, dy + anchor_px.unwrap_or(dh / 2) - h / 2),
        DockPosition::Right => (dx - w - gap, dy + anchor_px.unwrap_or(dh / 2) - h / 2),
    };
    let margin = gap;
    let min_x = area_pos.x + margin;
    let max_x = area_pos.x + area_size.width as i32 - w - margin;
    let min_y = area_pos.y + margin;
    let max_y = area_pos.y + area_size.height as i32 - h - margin;
    x = x.clamp(min_x, max_x.max(min_x));
    y = y.clamp(min_y, max_y.max(min_y));

    window
        .set_size(PhysicalSize::new(w as u32, h as u32))
        .map_err(|e| e.to_string())?;
    window
        .set_position(PhysicalPosition::new(x, y))
        .map_err(|e| e.to_string())
}

pub fn show_flyout(app: &AppHandle, request: FlyoutRequest) -> Result<(), String> {
    let registry = app.state::<WindowRegistry>();
    let height = registry.flyout_height.lock().map(|h| *h).unwrap_or(420.0);
    if let Ok(mut current) = registry.flyout.lock() {
        *current = Some(request.clone());
    }
    platform::clear_thumbnails();
    let window = flyout_window(app)?;
    place_near_dock(
        app,
        &window,
        flyout_width(&request.kind),
        height.max(120.0),
        Some(request.anchor),
    )?;
    let _ = window.emit("flyout:show", &request);
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}

pub fn resize_flyout(app: &AppHandle, height: f64) -> Result<(), String> {
    let height = height.clamp(120.0, 640.0);
    let registry = app.state::<WindowRegistry>();
    if let Ok(mut h) = registry.flyout_height.lock() {
        *h = height;
    }
    let (anchor, width) = registry
        .flyout
        .lock()
        .ok()
        .and_then(|f| f.as_ref().map(|r| (Some(r.anchor), flyout_width(&r.kind))))
        .unwrap_or((None, FLYOUT_WIDTH));
    if let Some(window) = app.get_webview_window(FLYOUT) {
        place_near_dock(app, &window, width, height, anchor)?;
    }
    Ok(())
}

pub fn hide_flyout(app: &AppHandle) {
    platform::clear_thumbnails();
    if let Some(window) = app.get_webview_window(FLYOUT) {
        let _ = window.hide();
    }
}

fn toast_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(TOAST) {
        return Ok(window);
    }
    builder(app, TOAST)
        .title("OpenDock notification")
        .inner_size(TOAST_WIDTH, TOAST_HEIGHT)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .focused(false)
        .visible(false)
        .build()
        .map_err(|e| e.to_string())
}

pub fn show_toast(app: &AppHandle, toast: ToastPayload) {
    let registry = app.state::<WindowRegistry>();
    let created = app.get_webview_window(TOAST).is_none();
    if created {
        if let Ok(mut pending) = registry.pending_toasts.lock() {
            pending.push(toast.clone());
        }
    }
    let window = match toast_window(app) {
        Ok(w) => w,
        Err(error) => {
            tracing::warn!(%error, "could not open the toast window");
            return;
        }
    };
    if let Err(error) = place_near_dock(app, &window, TOAST_WIDTH, TOAST_HEIGHT, None) {
        tracing::warn!(%error, "could not place the toast window");
    }
    if !created {
        let _ = window.emit("toast:show", &toast);
    }
    platform::show_without_focus(&window);
}

pub fn take_pending_toasts(app: &AppHandle) -> Vec<ToastPayload> {
    app.state::<WindowRegistry>()
        .pending_toasts
        .lock()
        .map(|mut p| std::mem::take(&mut *p))
        .unwrap_or_default()
}

pub fn hide_toast(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(TOAST) {
        let _ = window.hide();
    }
}
