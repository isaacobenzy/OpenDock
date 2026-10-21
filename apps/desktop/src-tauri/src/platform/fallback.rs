//! Non-Windows stand-ins. Linux and macOS modules will replace these (see the roadmap).

use std::path::PathBuf;

use super::{
    AppWindow, Battery, MediaCommand, MediaState, PowerAction, ShellApp, Shortcut, VolumeState,
};
use crate::geometry::DockPosition;

const WINDOWS_ONLY: &str = "this is only available on Windows for now";

pub fn list_windows(_own_pid: u32) -> Vec<AppWindow> {
    Vec::new()
}

pub fn foreground_window() -> Option<isize> {
    None
}

pub fn window_pid(_raw: isize) -> u32 {
    0
}

pub fn activate_window(_raw: isize) -> Result<(), String> {
    Err(WINDOWS_ONLY.into())
}

pub fn minimize_window(_raw: isize) -> Result<(), String> {
    Err(WINDOWS_ONLY.into())
}

pub fn close_window(_raw: isize) -> Result<(), String> {
    Err(WINDOWS_ONLY.into())
}

pub fn icon_rgba(_path: &str) -> Option<(u32, u32, Vec<u8>)> {
    None
}

pub fn window_icon_rgba(_raw: isize) -> Option<(u32, u32, Vec<u8>)> {
    None
}

pub fn launch_path(_path: &str) -> Result<(), String> {
    Err(WINDOWS_ONLY.into())
}

pub fn resolve_shortcut(_path: &str) -> Option<String> {
    None
}

pub fn start_menu_dirs() -> Vec<PathBuf> {
    Vec::new()
}

pub fn taskbar_pin_dir() -> Option<PathBuf> {
    None
}

pub fn builtin_apps() -> Vec<ShellApp> {
    Vec::new()
}

pub fn clear_thumbnails() {}

pub fn set_thumbnails(_destination: isize, _slots: &[(isize, [i32; 4])]) -> usize {
    0
}

pub fn set_appbar(_handle: isize, _band: Option<(DockPosition, [i32; 4])>) {}

pub fn volume() -> Option<VolumeState> {
    None
}

pub fn set_volume(_level: u8) -> Result<VolumeState, String> {
    Err(WINDOWS_ONLY.into())
}

pub fn set_muted(_muted: bool) -> Result<VolumeState, String> {
    Err(WINDOWS_ONLY.into())
}

pub fn send_shortcut(_shortcut: Shortcut) -> Result<(), String> {
    Err(WINDOWS_ONLY.into())
}

pub fn power_action(_action: PowerAction) -> Result<(), String> {
    Err(WINDOWS_ONLY.into())
}

pub fn foreground_fullscreen(_own: Option<isize>) -> bool {
    false
}

pub fn taskbar_autohide() -> Option<bool> {
    None
}

pub fn set_taskbar_autohide(_enabled: bool) -> Result<(), String> {
    Err("taskbar control is only available on Windows".into())
}

pub fn taskbar_visible() -> Option<bool> {
    None
}

pub fn set_taskbar_visible(_visible: bool) -> Result<(), String> {
    Err("taskbar control is only available on Windows".into())
}

pub fn wait_for_process_exit(pid: u32) {
    let _ = pid;
}

pub fn show_no_activate(_raw: isize) {}

pub fn open_start_menu() -> Result<(), String> {
    Err("Start is only available on Windows".into())
}

pub fn cpu_times() -> Option<(u64, u64)> {
    None
}

pub fn memory() -> Option<(f32, u64, u64)> {
    None
}

pub fn battery() -> Option<Battery> {
    None
}

pub fn system_dark_mode() -> Option<bool> {
    None
}

pub fn set_system_dark_mode(_dark: bool) -> Result<(), String> {
    Err("changing the system theme is only available on Windows".into())
}

pub fn media_state() -> MediaState {
    MediaState::default()
}

pub fn media_command(_command: MediaCommand) -> Result<bool, String> {
    Err("media control is only available on Windows".into())
}
