mod commands;
mod dock_layout;
mod geometry;
mod platform;
mod settings;

use std::sync::Mutex;

use commands::AppState;
use platform::{DockPlatform, NativePlatform};
use settings::{AppSettings, SettingsStore};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let platform = NativePlatform;

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .setup(move |app| {
            let config_dir = app
                .path()
                .app_config_dir()
                .map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;
            let store = SettingsStore::new(config_dir.join("settings.json"));
            let settings = match store.load() {
                Ok(settings) => settings,
                Err(error) => {
                    tracing::warn!(?error, "failed to load settings; using defaults");
                    AppSettings::default()
                }
            };

            app.manage(AppState {
                store: Mutex::new(store),
                settings: Mutex::new(settings.clone()),
            });

            if let Some(window) = app.get_webview_window("main") {
                dock_layout::apply_dock_layout(&window, &settings.dock)?;
                dock_layout::sync_autostart(app.handle(), &settings)?;
            }

            platform.start_fullscreen_watcher(app.handle().clone(), "main".to_string());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_settings,
            commands::apply_dock_layout_command,
            commands::get_current_monitor_id,
            commands::quit_app,
            commands::set_launch_at_startup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
