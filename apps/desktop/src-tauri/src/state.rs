use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Emitter};

use crate::engine::bus::{BusEvent, EventBus};
use crate::platform::taskbar::TaskbarController;
use crate::platform::{MediaState, SystemStats, VolumeState, WindowsSnapshot};
use crate::services::focus::FocusTimer;
use crate::services::weather::WeatherSnapshot;
use crate::settings::{AppSettings, SettingsStore};
use crate::store::Database;

/// Facts other services read without asking the OS again.
#[derive(Default)]
pub struct LiveState {
    pub media: Mutex<MediaState>,
    pub stats: Mutex<Option<SystemStats>>,
    pub weather: Mutex<Option<WeatherSnapshot>>,
    pub fullscreen: AtomicBool,
    /// Width (or height when vertical) the dock content asked for, in logical pixels.
    pub dock_length: Mutex<Option<u32>>,
    pub windows: Mutex<WindowsSnapshot>,
    pub volume: Mutex<Option<VolumeState>>,
}

pub struct AppState {
    pub store: Mutex<SettingsStore>,
    pub settings: Arc<Mutex<AppSettings>>,
    pub db: Arc<Database>,
    pub bus: Arc<EventBus>,
    pub live: Arc<LiveState>,
    pub focus: Arc<FocusTimer>,
    pub taskbar: Arc<TaskbarController>,
}

impl AppState {
    pub fn settings(&self) -> AppSettings {
        self.settings.lock().map(|s| s.clone()).unwrap_or_default()
    }

    pub fn publish(&self, event: BusEvent) {
        self.bus.publish(event);
    }
}

/// Tells every window that a data topic changed so it can refetch.
pub fn notify_changed(app: &AppHandle, topic: &str) {
    let _ = app.emit("data:changed", topic);
}
