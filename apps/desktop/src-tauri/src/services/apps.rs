//! Running windows, installed apps and volume: what the dock needs to stand in for the
//! taskbar.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use serde_json::json;
use tauri::{AppHandle, Emitter, Manager};

use crate::engine::bus::BusEvent;
use crate::platform::{self, AppWindow, ShellApp, WindowsSnapshot};
use crate::settings::AppSettings;
use crate::state::AppState;

const WINDOW_POLL: Duration = Duration::from_millis(450);
const VOLUME_POLL: Duration = Duration::from_millis(1000);
const INDEX_TTL: Duration = Duration::from_secs(120);
const MAX_SCAN_DEPTH: usize = 4;

#[derive(Default)]
pub struct AppCatalog {
    icons: Mutex<HashMap<String, Option<String>>>,
    index: Mutex<Option<(Instant, Vec<ShellApp>)>>,
}

impl AppCatalog {
    /// Start menu shortcuts plus a few built-in Windows apps, cached for a couple of minutes.
    pub fn installed(&self) -> Vec<ShellApp> {
        if let Ok(index) = self.index.lock() {
            if let Some((at, apps)) = index.as_ref() {
                if at.elapsed() < INDEX_TTL {
                    return apps.clone();
                }
            }
        }
        let mut apps = platform::builtin_apps();
        let taken: HashSet<String> = apps.iter().map(|a| a.name.to_lowercase()).collect();
        apps.extend(
            scan_shortcuts(&platform::start_menu_dirs(), platform::resolve_shortcut)
                .into_iter()
                .filter(|a| !taken.contains(&a.name.to_lowercase())),
        );
        apps.sort_by_key(|a| a.name.to_lowercase());
        if let Ok(mut index) = self.index.lock() {
            *index = Some((Instant::now(), apps.clone()));
        }
        apps
    }

    pub fn icon(&self, path: &str, window: Option<i64>) -> Option<String> {
        let key = path.to_lowercase();
        if let Some(hit) = self.icons.lock().ok().and_then(|i| i.get(&key).cloned()) {
            return hit;
        }
        // Store apps live under WindowsApps, where the file icon is a generic one.
        let packaged = key.contains("\\windowsapps\\");
        let icon = if packaged {
            window
                .and_then(platform::app_icon_for_window)
                .or_else(|| platform::app_icon_data_url(path))
        } else {
            platform::app_icon_data_url(path)
                .or_else(|| window.and_then(platform::app_icon_for_window))
        };
        if let Ok(mut icons) = self.icons.lock() {
            if icons.len() > 512 {
                icons.clear();
            }
            icons.insert(key, icon.clone());
        }
        icon
    }
}

fn is_noise(name: &str) -> bool {
    let lower = name.to_lowercase();
    [
        "uninstall",
        "readme",
        "read me",
        "help",
        "documentation",
        "release notes",
        "license",
        "website",
    ]
    .iter()
    .any(|word| lower.contains(word))
}

/// Walks Start menu folders for app shortcuts. `resolve` maps a shortcut to its target.
pub fn scan_shortcuts(dirs: &[PathBuf], resolve: impl Fn(&str) -> Option<String>) -> Vec<ShellApp> {
    let mut seen = HashSet::new();
    let mut apps = Vec::new();
    let mut stack: Vec<(PathBuf, usize)> = dirs.iter().map(|d| (d.clone(), 0)).collect();
    while let Some((dir, depth)) = stack.pop() {
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if depth < MAX_SCAN_DEPTH {
                    stack.push((path, depth + 1));
                }
                continue;
            }
            if let Some(app) = shortcut_app(&path, &resolve) {
                if seen.insert(app.name.to_lowercase()) {
                    apps.push(app);
                }
            }
        }
    }
    apps.sort_by_key(|a| a.name.to_lowercase());
    apps
}

fn shortcut_app(path: &Path, resolve: &impl Fn(&str) -> Option<String>) -> Option<ShellApp> {
    let is_link = path
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("lnk"));
    if !is_link {
        return None;
    }
    let name = path.file_stem()?.to_string_lossy().trim().to_string();
    if name.is_empty() || is_noise(&name) {
        return None;
    }
    let path = path.to_string_lossy().to_string();
    let target = resolve(&path);
    // Shortcuts to documents and web pages aren't apps.
    if target
        .as_ref()
        .is_some_and(|t| !t.to_lowercase().ends_with(".exe"))
    {
        return None;
    }
    Some(ShellApp { name, path, target })
}

/// The apps pinned to the Windows taskbar, so a new dock can start with the same ones.
pub fn taskbar_pins() -> Vec<ShellApp> {
    let Some(dir) = platform::taskbar_pin_dir() else {
        return Vec::new();
    };
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let resolve = platform::resolve_shortcut;
    let mut pins: Vec<ShellApp> = entries
        .flatten()
        .filter_map(|e| shortcut_app(&e.path(), &resolve))
        .collect();
    pins.sort_by_key(|a| a.name.to_lowercase());
    pins
}

/// Only things the user pinned, installed apps and already-running programs may be started.
pub fn is_launchable(
    path: &str,
    settings: &AppSettings,
    installed: &[ShellApp],
    windows: &[AppWindow],
) -> bool {
    let key = path.to_lowercase();
    settings
        .apps
        .pinned
        .iter()
        .any(|p| p.path.to_lowercase() == key)
        || installed.iter().any(|a| a.path.to_lowercase() == key)
        || windows.iter().any(|w| w.app_id == key)
}

/// Which window counts as "the one you're using". Clicking the dock focuses OpenDock, so
/// its own windows keep the previous answer.
pub fn next_active(
    previous: Option<i64>,
    foreground: Option<i64>,
    windows: &[AppWindow],
    is_own: impl Fn(i64) -> bool,
) -> Option<i64> {
    let listed = |id: i64| windows.iter().any(|w| w.id == id);
    match foreground {
        Some(id) if listed(id) => Some(id),
        Some(id) if is_own(id) => previous.filter(|&p| listed(p)),
        _ => None,
    }
}

/// Keeps windows in the order they first appeared so icons don't jump around.
pub fn keep_order(previous: &[AppWindow], current: Vec<AppWindow>) -> Vec<AppWindow> {
    let mut by_id: HashMap<i64, AppWindow> = current.iter().map(|w| (w.id, w.clone())).collect();
    let mut ordered: Vec<AppWindow> = previous
        .iter()
        .filter_map(|w| by_id.remove(&w.id))
        .collect();
    ordered.extend(current.into_iter().filter(|w| by_id.contains_key(&w.id)));
    ordered
}

fn find(snapshot: &WindowsSnapshot, id: Option<i64>) -> Option<&AppWindow> {
    id.and_then(|id| snapshot.windows.iter().find(|w| w.id == id))
}

fn publish_changes(state: &AppState, before: &WindowsSnapshot, after: &WindowsSnapshot) {
    let known: HashSet<i64> = before.windows.iter().map(|w| w.id).collect();
    for window in after.windows.iter().filter(|w| !known.contains(&w.id)) {
        state.publish(BusEvent::new(
            "app.window.opened",
            "apps",
            json!({ "app": window.app_name, "title": window.title }),
        ));
    }
    let was = find(before, before.active).map(|w| w.app_id.clone());
    if let Some(now) = find(after, after.active) {
        if was.as_deref() != Some(now.app_id.as_str()) {
            state.publish(BusEvent::new(
                "app.window.focused",
                "apps",
                json!({ "app": now.app_name, "title": now.title }),
            ));
        }
    }
}

pub fn spawn_windows(app: AppHandle) {
    thread::spawn(move || {
        let own = std::process::id();
        let mut first = true;
        loop {
            let state = app.state::<AppState>();
            let before = state
                .live
                .windows
                .lock()
                .map(|w| w.clone())
                .unwrap_or_default();
            let current = platform::list_windows(own);
            let foreground = platform::foreground_window().map(|h| h as i64);
            let active = next_active(before.active, foreground, &current, |id| {
                platform::window_pid(id as isize) == own
            });
            let after = WindowsSnapshot {
                windows: keep_order(&before.windows, current),
                active,
            };
            if after != before {
                if !first {
                    publish_changes(&state, &before, &after);
                }
                if let Ok(mut slot) = state.live.windows.lock() {
                    *slot = after.clone();
                }
                let _ = app.emit("windows:changed", &after);
            }
            first = false;
            thread::sleep(WINDOW_POLL);
        }
    });
}

pub fn spawn_volume(app: AppHandle) {
    thread::spawn(move || loop {
        let current = platform::volume();
        let state = app.state::<AppState>();
        let changed = state
            .live
            .volume
            .lock()
            .map(|mut slot| {
                let changed = *slot != current;
                *slot = current;
                changed
            })
            .unwrap_or(false);
        if changed {
            let _ = app.emit("volume:state", current);
        }
        thread::sleep(VOLUME_POLL);
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn window(id: i64, app: &str) -> AppWindow {
        AppWindow {
            id,
            title: format!("{app} {id}"),
            app_id: format!("c:\\apps\\{app}.exe"),
            exe: format!("C:\\Apps\\{app}.exe"),
            app_name: app.into(),
            minimized: false,
        }
    }

    #[test]
    fn own_windows_keep_the_previous_active_window() {
        let windows = vec![window(1, "code"), window(2, "chrome")];
        assert_eq!(next_active(None, Some(2), &windows, |_| false), Some(2));
        assert_eq!(
            next_active(Some(2), Some(99), &windows, |id| id == 99),
            Some(2)
        );
        assert_eq!(next_active(Some(2), Some(42), &windows, |_| false), None);
        assert_eq!(
            next_active(Some(7), Some(99), &windows, |id| id == 99),
            None
        );
        assert_eq!(next_active(Some(1), None, &windows, |_| false), None);
    }

    #[test]
    fn order_is_stable_and_new_windows_go_last() {
        let before = vec![window(1, "a"), window(2, "b")];
        let now = vec![window(3, "c"), window(2, "b"), window(1, "a")];
        let ids: Vec<i64> = keep_order(&before, now).iter().map(|w| w.id).collect();
        assert_eq!(ids, vec![1, 2, 3]);
        let closed = keep_order(&before, vec![window(2, "b")]);
        assert_eq!(closed.len(), 1);
    }

    #[test]
    fn launching_is_limited_to_known_apps() {
        let mut settings = AppSettings::default();
        settings
            .apps
            .pinned
            .push(crate::settings::types::PinnedApp {
                name: "Notes".into(),
                path: "C:\\Pinned\\Notes.lnk".into(),
                target: None,
            });
        let installed = vec![ShellApp {
            name: "Paint".into(),
            path: "C:\\Start\\Paint.lnk".into(),
            target: None,
        }];
        let windows = vec![window(1, "code")];
        assert!(is_launchable(
            "c:\\pinned\\notes.lnk",
            &settings,
            &installed,
            &windows
        ));
        assert!(is_launchable(
            "C:\\Start\\Paint.lnk",
            &settings,
            &installed,
            &windows
        ));
        assert!(is_launchable(
            "C:\\Apps\\code.exe",
            &settings,
            &installed,
            &windows
        ));
        assert!(!is_launchable(
            "C:\\Temp\\evil.exe",
            &settings,
            &installed,
            &windows
        ));
    }

    #[test]
    fn scanning_finds_shortcuts_and_skips_noise() {
        let root = std::env::temp_dir().join(format!("opendock-scan-{}", std::process::id()));
        let nested = root.join("Tools");
        fs::create_dir_all(&nested).unwrap();
        for file in [
            "Editor.lnk",
            "Uninstall Editor.lnk",
            "notes.txt",
            "Tools/Profiler.lnk",
            "Tools/Manual.lnk",
        ] {
            fs::write(root.join(file), b"").unwrap();
        }
        let resolve = |path: &str| {
            if path.ends_with("Manual.lnk") {
                Some("C:\\Docs\\manual.pdf".to_string())
            } else {
                None
            }
        };
        let names: Vec<String> = scan_shortcuts(std::slice::from_ref(&root), resolve)
            .into_iter()
            .map(|a| a.name)
            .collect();
        assert_eq!(names, vec!["Editor", "Profiler"]);
        let _ = fs::remove_dir_all(root);
    }
}
