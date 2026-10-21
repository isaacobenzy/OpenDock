mod commands;
mod dock_layout;
mod engine;
mod geometry;
mod net;
mod platform;
mod secrets;
mod services;
mod settings;
mod state;
mod store;

use std::sync::{Arc, Mutex};

use platform::taskbar::{self, TaskbarController};
use services::automation::Automation;
use services::focus::FocusTimer;
use services::windows::WindowRegistry;
use settings::{AppSettings, SettingsStore};
use state::{AppState, LiveState};
use tauri::{Manager, RunEvent};

/// Runs the taskbar guard if this process was started as one. Call before anything else.
pub fn run_taskbar_guard_if_requested() -> bool {
    let args: Vec<String> = std::env::args().collect();
    taskbar::run_guard_from_args(&args)
}

fn install_panic_restore(marker: std::path::PathBuf) {
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        taskbar::restore_from_marker(&marker);
        previous(info);
    }));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .setup(|app| {
            let config_dir = app
                .path()
                .app_config_dir()
                .map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;
            let data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;

            let taskbar = Arc::new(TaskbarController::new(
                config_dir.join("taskbar-restore.json"),
            ));
            taskbar.recover_previous_run();
            install_panic_restore(taskbar.marker_path().to_path_buf());

            let store = SettingsStore::new(config_dir.join("settings.json"));
            let settings = store.load().unwrap_or_else(|error| {
                tracing::warn!(?error, "failed to load settings; using defaults");
                AppSettings::default()
            });

            let db = Arc::new(
                store::Database::open(&data_dir.join("opendock.db"))
                    .map_err(|e| -> Box<dyn std::error::Error> { e.into() })?,
            );
            db.with(|c| store::rules::seed_once(c, &engine::rules::recipes()))?;
            db.with(store::focus::close_abandoned)?;

            if let Err(error) = taskbar.apply(settings.taskbar.mode) {
                tracing::warn!(%error, "could not apply the taskbar mode");
            }

            app.manage(AppState {
                store: Mutex::new(store),
                settings: Arc::new(Mutex::new(settings.clone())),
                db,
                bus: Arc::new(engine::bus::EventBus::new()),
                live: Arc::new(LiveState::default()),
                focus: Arc::new(FocusTimer::default()),
                taskbar,
            });
            app.manage(WindowRegistry::default());
            app.manage(services::apps::AppCatalog::default());
            let automation = Arc::new(Automation::default());
            app.manage(automation.clone());

            if let Some(window) = app.get_webview_window("main") {
                dock_layout::apply_dock_layout(&window, &settings, None)?;
                dock_layout::sync_autostart(app.handle(), &settings)?;
            }

            services::automation::start(app.handle().clone(), automation);
            services::start_all(app.handle());
            if !settings.onboarded {
                if let Err(error) = services::windows::open_hub(app.handle(), "welcome") {
                    tracing::warn!(%error, "could not open the welcome page");
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_settings,
            commands::apply_dock_layout_command,
            commands::set_dock_length,
            commands::get_current_monitor_id,
            commands::quit_app,
            commands::set_launch_at_startup,
            commands::get_taskbar_status,
            commands::widgets::get_media_state,
            commands::widgets::media_control,
            commands::widgets::get_system_stats,
            commands::widgets::open_start_menu,
            commands::widgets::get_focus_state,
            commands::widgets::focus_start,
            commands::widgets::focus_stop,
            commands::widgets::list_todos,
            commands::widgets::add_todo,
            commands::widgets::set_todo_done,
            commands::widgets::rename_todo,
            commands::widgets::delete_todo,
            commands::widgets::clear_done_todos,
            commands::widgets::list_notes,
            commands::widgets::create_note,
            commands::widgets::update_note,
            commands::widgets::pin_note,
            commands::widgets::delete_note,
            commands::widgets::get_weather,
            commands::widgets::refresh_weather,
            commands::widgets::search_city,
            commands::widgets::list_calendars,
            commands::widgets::add_calendar,
            commands::widgets::remove_calendar,
            commands::widgets::sync_calendars,
            commands::widgets::upcoming_events,
            commands::automation::list_rules,
            commands::automation::list_recipes,
            commands::automation::save_rule,
            commands::automation::set_rule_enabled,
            commands::automation::delete_rule,
            commands::automation::dry_run_rule,
            commands::automation::list_activity,
            commands::automation::undo_activity,
            commands::automation::clear_activity,
            commands::automation::get_privacy_ledger,
            commands::windows::open_hub,
            commands::windows::get_hub_page,
            commands::windows::show_flyout,
            commands::windows::get_flyout_request,
            commands::windows::resize_flyout,
            commands::windows::hide_flyout,
            commands::windows::take_pending_toasts,
            commands::windows::hide_toast,
            commands::apps::list_windows,
            commands::apps::window_action,
            commands::apps::get_app_icon,
            commands::apps::list_installed_apps,
            commands::apps::list_taskbar_pins,
            commands::apps::launch_app,
            commands::apps::get_volume,
            commands::apps::set_volume,
            commands::apps::set_muted,
            commands::apps::send_shortcut,
            commands::apps::power_action,
            commands::apps::show_thumbnails,
            commands::apps::clear_thumbnails,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app, event| match event {
        RunEvent::ExitRequested { api, code, .. } => {
            // Closing the hub or a popup must not quit the dock; only an explicit exit does.
            if code.is_none() {
                api.prevent_exit();
            }
        }
        RunEvent::Exit => {
            platform::clear_thumbnails();
            if let Some(dock) = app.get_webview_window("main") {
                let _ = platform::reserve_edge(&dock, None);
            }
            if let Some(state) = app.try_state::<AppState>() {
                if let Err(error) = state.taskbar.restore() {
                    tracing::warn!(%error, "could not restore the taskbar on exit");
                }
            }
        }
        _ => {}
    });
}
