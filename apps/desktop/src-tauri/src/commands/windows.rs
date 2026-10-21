use tauri::{AppHandle, State};

use crate::services::automation::ToastPayload;
use crate::services::windows::{self as dock_windows, FlyoutRequest, WindowRegistry};

const HUB_PAGES: [&str; 8] = [
    "welcome",
    "apps",
    "widgets",
    "automations",
    "activity",
    "dock",
    "privacy",
    "calendars",
];

// Window-creating commands are async: building a webview inside a synchronous command
// deadlocks on Windows.

#[tauri::command]
pub async fn open_hub(app: AppHandle, page: Option<String>) -> Result<(), String> {
    let page = page.unwrap_or_else(|| "widgets".into());
    if !HUB_PAGES.contains(&page.as_str()) {
        return Err(format!("unknown page {page}"));
    }
    dock_windows::hide_flyout(&app);
    dock_windows::open_hub(&app, &page)
}

#[tauri::command]
pub fn get_hub_page(registry: State<'_, WindowRegistry>) -> String {
    registry
        .hub_page
        .lock()
        .map(|p| p.clone())
        .unwrap_or_else(|_| "widgets".into())
}

#[tauri::command]
pub async fn show_flyout(app: AppHandle, request: FlyoutRequest) -> Result<(), String> {
    dock_windows::show_flyout(&app, request)
}

#[tauri::command]
pub fn get_flyout_request(registry: State<'_, WindowRegistry>) -> Option<FlyoutRequest> {
    registry.flyout.lock().ok().and_then(|f| f.clone())
}

#[tauri::command]
pub fn resize_flyout(app: AppHandle, height: f64) -> Result<(), String> {
    dock_windows::resize_flyout(&app, height)
}

#[tauri::command]
pub fn hide_flyout(app: AppHandle) {
    dock_windows::hide_flyout(&app);
}

#[tauri::command]
pub fn take_pending_toasts(app: AppHandle) -> Vec<ToastPayload> {
    dock_windows::take_pending_toasts(&app)
}

#[tauri::command]
pub fn hide_toast(app: AppHandle) {
    dock_windows::hide_toast(&app);
}
