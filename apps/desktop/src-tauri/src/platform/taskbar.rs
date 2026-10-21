//! Taskbar auto-hide and hide integration with a guaranteed restore.
//!
//! Restoring is layered so the user's taskbar always comes back:
//! 1. Normal exit and switching back to "normal" restore immediately.
//! 2. A panic hook restores before the process aborts.
//! 3. A guard process waits on our PID and restores if we die without cleaning up
//!    (crash, `taskkill /f`, debugger stop).
//! 4. On the next launch, a leftover marker file is restored before anything else.
//!
//! The marker file holds the user's original settings and exists only while OpenDock
//! has changed the taskbar.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use super::imp;
use crate::settings::types::TaskbarMode;

pub const GUARD_FLAG: &str = "--taskbar-guard";
/// Run by the uninstaller: put the taskbar back even if OpenDock is gone.
pub const RESTORE_FLAG: &str = "--restore-taskbar";
const APP_IDENTIFIER: &str = "com.opendock.app";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub autohide: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TaskbarStatus {
    pub supported: bool,
    pub mode: TaskbarMode,
    pub autohide: Option<bool>,
    pub visible: Option<bool>,
    pub original_autohide: Option<bool>,
}

struct Inner {
    mode: TaskbarMode,
    original: Option<Snapshot>,
    guard_spawned: bool,
}

pub struct TaskbarController {
    marker: PathBuf,
    inner: Mutex<Inner>,
}

fn read_marker(path: &Path) -> Option<Snapshot> {
    let raw = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn write_marker(path: &Path, snapshot: Snapshot) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let body = serde_json::to_string(&snapshot).map_err(|e| e.to_string())?;
    std::fs::write(path, body).map_err(|e| e.to_string())
}

/// Puts the taskbar back the way the marker says and deletes the marker.
/// Safe to call from any process, any number of times.
pub fn restore_from_marker(path: &Path) -> bool {
    let Some(snapshot) = read_marker(path) else {
        return false;
    };
    let _ = imp::set_taskbar_visible(true);
    let _ = imp::set_taskbar_autohide(snapshot.autohide);
    let _ = std::fs::remove_file(path);
    true
}

/// Where the app keeps the marker, worked out without a running Tauri app.
fn default_marker_path() -> Option<PathBuf> {
    let base = std::env::var_os("APPDATA")?;
    Some(
        PathBuf::from(base)
            .join(APP_IDENTIFIER)
            .join("taskbar-restore.json"),
    )
}

/// Entry point for the guard and restore helpers. Returns true if `args` asked for one,
/// in which case the caller must exit instead of starting the app.
pub fn run_guard_from_args(args: &[String]) -> bool {
    if args.get(1).map(String::as_str) == Some(RESTORE_FLAG) {
        let restored = default_marker_path().is_some_and(|path| restore_from_marker(&path));
        if !restored {
            let _ = imp::set_taskbar_visible(true);
        }
        return true;
    }
    if args.get(1).map(String::as_str) != Some(GUARD_FLAG) {
        return false;
    }
    let (Some(pid), Some(marker)) = (args.get(2).and_then(|p| p.parse().ok()), args.get(3)) else {
        return true;
    };
    imp::wait_for_process_exit(pid);
    restore_from_marker(Path::new(marker));
    true
}

fn spawn_guard(marker: &Path) -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let mut command = std::process::Command::new(exe);
    command
        .arg(GUARD_FLAG)
        .arg(std::process::id().to_string())
        .arg(marker);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        const DETACHED_PROCESS: u32 = 0x0000_0008;
        command.creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS);
    }
    command.spawn().map(|_| ()).map_err(|e| e.to_string())
}

impl TaskbarController {
    pub fn new(marker: PathBuf) -> Self {
        Self {
            marker,
            inner: Mutex::new(Inner {
                mode: TaskbarMode::Normal,
                original: None,
                guard_spawned: false,
            }),
        }
    }

    pub fn marker_path(&self) -> &Path {
        &self.marker
    }

    pub fn supported() -> bool {
        imp::taskbar_autohide().is_some()
    }

    /// Restores a taskbar left changed by a previous run that did not exit cleanly.
    pub fn recover_previous_run(&self) -> bool {
        let recovered = restore_from_marker(&self.marker);
        if recovered {
            tracing::warn!("restored the taskbar after an unclean exit");
        }
        recovered
    }

    pub fn apply(&self, mode: TaskbarMode) -> Result<(), String> {
        if mode == TaskbarMode::Normal {
            return self.restore();
        }
        let mut inner = self.inner.lock().map_err(|_| "taskbar lock poisoned")?;
        if inner.original.is_none() {
            let autohide = imp::taskbar_autohide()
                .ok_or_else(|| "taskbar control is not available on this system".to_string())?;
            let snapshot = Snapshot { autohide };
            write_marker(&self.marker, snapshot)?;
            inner.original = Some(snapshot);
        }
        if !inner.guard_spawned {
            match spawn_guard(&self.marker) {
                Ok(()) => inner.guard_spawned = true,
                Err(error) => tracing::warn!(?error, "could not start the taskbar guard"),
            }
        }
        imp::set_taskbar_autohide(true)?;
        imp::set_taskbar_visible(!mode.hides_taskbar())?;
        inner.mode = mode;
        Ok(())
    }

    pub fn restore(&self) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|_| "taskbar lock poisoned")?;
        inner.mode = TaskbarMode::Normal;
        if let Some(original) = inner.original.take() {
            imp::set_taskbar_visible(true)?;
            imp::set_taskbar_autohide(original.autohide)?;
        }
        let _ = std::fs::remove_file(&self.marker);
        Ok(())
    }

    /// Explorer restarts and some shell actions bring the taskbar back; re-apply quietly.
    pub fn reassert(&self) {
        let Ok(inner) = self.inner.lock() else {
            return;
        };
        match inner.mode {
            TaskbarMode::Normal => {}
            TaskbarMode::Autohide => {
                if imp::taskbar_autohide() == Some(false) {
                    let _ = imp::set_taskbar_autohide(true);
                }
            }
            TaskbarMode::Hidden | TaskbarMode::Replace => {
                if imp::taskbar_autohide() == Some(false) {
                    let _ = imp::set_taskbar_autohide(true);
                }
                if imp::taskbar_visible() == Some(true) {
                    let _ = imp::set_taskbar_visible(false);
                }
            }
        }
    }

    pub fn status(&self) -> TaskbarStatus {
        let (mode, original) = self
            .inner
            .lock()
            .map(|i| (i.mode, i.original))
            .unwrap_or((TaskbarMode::Normal, None));
        TaskbarStatus {
            supported: Self::supported(),
            mode,
            autohide: imp::taskbar_autohide(),
            visible: imp::taskbar_visible(),
            original_autohide: original.map(|o| o.autohide),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn marker_round_trip() {
        let dir = std::env::temp_dir().join(format!("opendock-taskbar-{}", std::process::id()));
        let path = dir.join("taskbar-restore.json");
        write_marker(&path, Snapshot { autohide: true }).unwrap();
        assert_eq!(read_marker(&path), Some(Snapshot { autohide: true }));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn missing_marker_restores_nothing() {
        let path = std::env::temp_dir().join("opendock-no-such-marker.json");
        assert!(!restore_from_marker(&path));
    }

    #[test]
    fn guard_args_are_recognised() {
        assert!(!run_guard_from_args(&["opendock".into()]));
        assert!(run_guard_from_args(&[
            "opendock".into(),
            GUARD_FLAG.into(),
            "not-a-pid".into()
        ]));
    }
}
