//! Taskbar changes are recoverable: save the original state, start a guard, then
//! change the shell. A failed restore keeps its marker and snapshot for retry.

use std::path::{Path, PathBuf};
use std::process::Child;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use super::imp;
use crate::settings::types::TaskbarMode;

pub const GUARD_FLAG: &str = "--taskbar-guard";
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
    pub error: Option<String>,
}

trait Shell: Send + Sync {
    fn autohide(&self) -> Option<bool>;
    fn visible(&self) -> Option<bool>;
    fn set_autohide(&self, enabled: bool) -> Result<(), String>;
    fn set_visible(&self, visible: bool) -> Result<(), String>;
    fn ensure_guard(&self, marker: &Path) -> Result<(), String>;
}

#[derive(Default)]
struct NativeShell {
    guard: Mutex<Option<Child>>,
}

impl Shell for NativeShell {
    fn autohide(&self) -> Option<bool> {
        imp::taskbar_autohide()
    }
    fn visible(&self) -> Option<bool> {
        imp::taskbar_visible()
    }
    fn set_autohide(&self, enabled: bool) -> Result<(), String> {
        imp::set_taskbar_autohide(enabled)
    }
    fn set_visible(&self, visible: bool) -> Result<(), String> {
        imp::set_taskbar_visible(visible)
    }
    fn ensure_guard(&self, marker: &Path) -> Result<(), String> {
        let mut guard = self
            .guard
            .lock()
            .map_err(|_| "taskbar guard lock poisoned")?;
        if let Some(child) = guard.as_mut() {
            if child.try_wait().map_err(|e| e.to_string())?.is_none() {
                return Ok(());
            }
        }
        *guard = Some(spawn_guard(marker)?);
        Ok(())
    }
}

struct Inner {
    mode: TaskbarMode,
    original: Option<Snapshot>,
    error: Option<String>,
}

pub struct TaskbarController {
    marker: PathBuf,
    inner: Mutex<Inner>,
    shell: Box<dyn Shell>,
}

fn read_marker(path: &Path) -> Result<Option<Snapshot>, String> {
    match std::fs::read_to_string(path) {
        Ok(raw) => serde_json::from_str(&raw).map(Some).map_err(|_| "The taskbar recovery file is damaged. Restore the Windows taskbar before trying again.".into()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

fn write_marker(path: &Path, snapshot: Snapshot) -> Result<(), String> {
    use std::io::Write;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let body = serde_json::to_string(&snapshot).map_err(|e| e.to_string())?;
    let mut file = std::fs::File::create(path).map_err(|e| e.to_string())?;
    file.write_all(body.as_bytes())
        .and_then(|_| file.sync_all())
        .map_err(|e| e.to_string())
}

fn remove_marker(path: &Path) -> Result<(), String> {
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

fn restore_snapshot(shell: &dyn Shell, snapshot: Snapshot) -> Result<(), String> {
    // Attempt both operations even if Explorer refuses the first one.
    let visible = shell.set_visible(true);
    let autohide = shell.set_autohide(snapshot.autohide);
    visible.and(autohide)
}

fn restore_marker(path: &Path, shell: &dyn Shell) -> Result<bool, String> {
    let Some(snapshot) = read_marker(path)? else {
        return Ok(false);
    };
    restore_snapshot(shell, snapshot)?;
    remove_marker(path)?;
    Ok(true)
}

pub fn restore_from_marker(path: &Path) -> bool {
    match restore_marker(path, &NativeShell::default()) {
        Ok(restored) => restored,
        Err(error) => {
            tracing::warn!(%error, "taskbar restore failed; keeping recovery marker");
            false
        }
    }
}

fn default_marker_path() -> Option<PathBuf> {
    let base = std::env::var_os("APPDATA")?;
    Some(
        PathBuf::from(base)
            .join(APP_IDENTIFIER)
            .join("taskbar-restore.json"),
    )
}

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

fn spawn_guard(marker: &Path) -> Result<Child, String> {
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
    command.spawn().map_err(|e| e.to_string())
}

impl TaskbarController {
    pub fn new(marker: PathBuf) -> Self {
        Self::with_shell(marker, Box::<NativeShell>::default())
    }

    fn with_shell(marker: PathBuf, shell: Box<dyn Shell>) -> Self {
        Self {
            marker,
            shell,
            inner: Mutex::new(Inner {
                mode: TaskbarMode::Normal,
                original: None,
                error: None,
            }),
        }
    }

    pub fn marker_path(&self) -> &Path {
        &self.marker
    }

    pub fn recover_previous_run(&self) -> bool {
        match restore_marker(&self.marker, self.shell.as_ref()) {
            Ok(restored) => restored,
            Err(error) => {
                if let Ok(mut inner) = self.inner.lock() {
                    inner.error = Some(error);
                }
                false
            }
        }
    }

    fn restore_inner(&self, inner: &mut Inner) -> Result<(), String> {
        // Stop re-hiding as soon as restoration is requested, even when it must retry.
        inner.mode = TaskbarMode::Normal;
        if let Some(original) = inner.original.or(read_marker(&self.marker)?) {
            inner.original = Some(original);
            restore_snapshot(self.shell.as_ref(), original)?;
            remove_marker(&self.marker)?;
            inner.original = None;
        }
        Ok(())
    }

    pub fn apply(&self, mode: TaskbarMode) -> Result<(), String> {
        if mode == TaskbarMode::Normal {
            return self.restore();
        }
        let mut inner = self.inner.lock().map_err(|_| "taskbar lock poisoned")?;
        let result = (|| {
            if inner.original.is_none() {
                let snapshot = match read_marker(&self.marker)? {
                    Some(snapshot) => snapshot,
                    None => Snapshot {
                        autohide: self
                            .shell
                            .autohide()
                            .ok_or("Taskbar control is not available on this system.")?,
                    },
                };
                write_marker(&self.marker, snapshot)?;
                inner.original = Some(snapshot);
            }
            self.shell.ensure_guard(&self.marker).map_err(|_| {
                "Could not start taskbar recovery. Keep the Windows taskbar and try again."
                    .to_string()
            })?;
            self.shell.set_autohide(true)?;
            self.shell.set_visible(!mode.hides_taskbar())?;
            inner.mode = mode;
            Ok::<(), String>(())
        })();
        match result {
            Ok(()) => {
                inner.error = None;
                Ok(())
            }
            Err(error) => {
                let message = match self.restore_inner(&mut inner) {
                    Ok(()) => error,
                    Err(_) => format!(
                        "{error} Windows could not restore the taskbar yet; recovery will retry."
                    ),
                };
                inner.error = Some(message.clone());
                Err(message)
            }
        }
    }

    pub fn restore(&self) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|_| "taskbar lock poisoned")?;
        let result = self.restore_inner(&mut inner);
        inner.error = result.as_ref().err().cloned();
        result
    }

    pub fn reassert(&self) {
        let Ok(mut inner) = self.inner.lock() else {
            return;
        };
        if inner.mode == TaskbarMode::Normal {
            if inner.original.is_some() && self.restore_inner(&mut inner).is_ok() {
                inner.error = None;
            }
            return;
        }
        let result = (|| {
            self.shell.ensure_guard(&self.marker)?;
            if self.shell.autohide() == Some(false) {
                self.shell.set_autohide(true)?;
            }
            if inner.mode.hides_taskbar() && self.shell.visible() == Some(true) {
                self.shell.set_visible(false)?;
            }
            Ok::<(), String>(())
        })();
        if let Err(error) = result {
            let _ = self.restore_inner(&mut inner);
            inner.error = Some(format!(
                "Taskbar replacement stopped: {error}. Open Dock settings to try again."
            ));
        }
    }

    pub fn status(&self) -> TaskbarStatus {
        let (mode, original, error) = self
            .inner
            .lock()
            .map(|i| (i.mode, i.original, i.error.clone()))
            .unwrap_or((
                TaskbarMode::Normal,
                None,
                Some("Taskbar state is unavailable.".into()),
            ));
        TaskbarStatus {
            supported: self.shell.autohide().is_some(),
            mode,
            autohide: self.shell.autohide(),
            visible: self.shell.visible(),
            original_autohide: original.map(|o| o.autohide),
            error,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    };

    #[derive(Default)]
    struct FakeState {
        autohide: bool,
        visible: bool,
        fail_guard: bool,
        fail_hide: bool,
        fail_restore: bool,
        calls: Vec<&'static str>,
    }
    struct FakeShell(Arc<Mutex<FakeState>>);
    impl Shell for FakeShell {
        fn autohide(&self) -> Option<bool> {
            Some(self.0.lock().unwrap().autohide)
        }
        fn visible(&self) -> Option<bool> {
            Some(self.0.lock().unwrap().visible)
        }
        fn set_autohide(&self, enabled: bool) -> Result<(), String> {
            let mut s = self.0.lock().unwrap();
            s.calls.push(if enabled { "autohide" } else { "normal" });
            s.autohide = enabled;
            Ok(())
        }
        fn set_visible(&self, visible: bool) -> Result<(), String> {
            let mut s = self.0.lock().unwrap();
            s.calls.push(if visible { "show" } else { "hide" });
            if (!visible && s.fail_hide) || (visible && s.fail_restore) {
                return Err("shell unavailable".into());
            }
            s.visible = visible;
            Ok(())
        }
        fn ensure_guard(&self, marker: &Path) -> Result<(), String> {
            assert!(marker.exists());
            let mut s = self.0.lock().unwrap();
            s.calls.push("guard");
            if s.fail_guard {
                Err("guard unavailable".into())
            } else {
                Ok(())
            }
        }
    }
    struct Fixture {
        controller: TaskbarController,
        state: Arc<Mutex<FakeState>>,
        dir: PathBuf,
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.dir);
        }
    }
    fn fixture() -> Fixture {
        static NEXT: AtomicUsize = AtomicUsize::new(0);
        let dir = std::env::temp_dir().join(format!(
            "opendock-taskbar-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        let state = Arc::new(Mutex::new(FakeState {
            visible: true,
            ..FakeState::default()
        }));
        let controller = TaskbarController::with_shell(
            dir.join("restore.json"),
            Box::new(FakeShell(state.clone())),
        );
        Fixture {
            controller,
            state,
            dir,
        }
    }

    #[test]
    fn saves_before_guard_and_hides_only_after_guard() {
        let f = fixture();
        f.controller.apply(TaskbarMode::Replace).unwrap();
        assert_eq!(f.state.lock().unwrap().calls, ["guard", "autohide", "hide"]);
        assert_eq!(
            read_marker(f.controller.marker_path()).unwrap(),
            Some(Snapshot { autohide: false })
        );
        f.controller.restore().unwrap();
        assert!(!f.controller.marker_path().exists());
        assert!(f.state.lock().unwrap().visible);
        assert!(!f.state.lock().unwrap().autohide);
    }

    #[test]
    fn guard_failure_never_hides_the_taskbar() {
        let f = fixture();
        f.state.lock().unwrap().fail_guard = true;
        assert!(f.controller.apply(TaskbarMode::Replace).is_err());
        assert!(!f.state.lock().unwrap().calls.contains(&"hide"));
        assert_eq!(f.controller.status().mode, TaskbarMode::Normal);
        assert!(f.controller.status().error.is_some());
    }

    #[test]
    fn partial_apply_rolls_back_autohide() {
        let f = fixture();
        f.state.lock().unwrap().fail_hide = true;
        assert!(f.controller.apply(TaskbarMode::Replace).is_err());
        assert!(!f.state.lock().unwrap().autohide);
        assert!(f.state.lock().unwrap().visible);
        assert!(!f.controller.marker_path().exists());
    }

    #[test]
    fn failed_restore_keeps_snapshot_and_retries_without_rehiding() {
        let f = fixture();
        f.controller.apply(TaskbarMode::Replace).unwrap();
        f.state.lock().unwrap().fail_restore = true;
        assert!(f.controller.restore().is_err());
        assert!(f.controller.marker_path().exists());
        assert_eq!(f.controller.status().original_autohide, Some(false));
        assert_eq!(f.controller.status().mode, TaskbarMode::Normal);
        f.state.lock().unwrap().fail_restore = false;
        f.controller.reassert();
        assert!(!f.controller.marker_path().exists());
        assert!(f.state.lock().unwrap().visible);
    }

    #[test]
    fn marker_restore_failure_retains_recovery_data() {
        let f = fixture();
        write_marker(f.controller.marker_path(), Snapshot { autohide: true }).unwrap();
        f.state.lock().unwrap().fail_restore = true;
        assert!(restore_marker(f.controller.marker_path(), f.controller.shell.as_ref()).is_err());
        assert!(f.controller.marker_path().exists());
        assert!(f.state.lock().unwrap().autohide);
    }

    #[test]
    fn repeated_modes_preserve_original_autohide() {
        let f = fixture();
        f.state.lock().unwrap().autohide = true;
        f.controller.apply(TaskbarMode::Replace).unwrap();
        f.controller.apply(TaskbarMode::Autohide).unwrap();
        f.controller.apply(TaskbarMode::Replace).unwrap();
        f.controller.restore().unwrap();
        assert!(f.state.lock().unwrap().autohide);
    }

    #[test]
    fn reassert_hides_returned_taskbars_and_guard_failure_restores() {
        let f = fixture();
        f.controller.apply(TaskbarMode::Replace).unwrap();
        f.state.lock().unwrap().visible = true;
        f.controller.reassert();
        assert!(!f.state.lock().unwrap().visible);
        f.state.lock().unwrap().fail_guard = true;
        f.controller.reassert();
        assert!(f.state.lock().unwrap().visible);
        assert_eq!(f.controller.status().mode, TaskbarMode::Normal);
    }

    #[test]
    fn corrupt_marker_is_not_overwritten() {
        let f = fixture();
        std::fs::create_dir_all(&f.dir).unwrap();
        std::fs::write(f.controller.marker_path(), "broken").unwrap();
        assert!(f.controller.apply(TaskbarMode::Replace).is_err());
        assert_eq!(
            std::fs::read_to_string(f.controller.marker_path()).unwrap(),
            "broken"
        );
        assert!(!f.state.lock().unwrap().calls.contains(&"hide"));
    }

    #[test]
    fn missing_marker_restores_nothing() {
        let f = fixture();
        assert!(!restore_marker(f.controller.marker_path(), f.controller.shell.as_ref()).unwrap());
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
