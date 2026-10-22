use std::ffi::c_void;

use windows::core::{w, HSTRING, PCWSTR};
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSession as Session,
    GlobalSystemMediaTransportControlsSessionManager as SessionManager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus as PlaybackStatus,
};
use windows::Win32::Foundation::{CloseHandle, BOOL, FILETIME, HWND, LPARAM, RECT, WPARAM};
use windows::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
};
use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
use windows::Win32::System::Registry::{
    RegGetValueW, RegSetKeyValueW, HKEY_CURRENT_USER, REG_DWORD, RRF_RT_REG_DWORD,
};
use windows::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};
use windows::Win32::System::Threading::{
    GetSystemTimes, OpenProcess, WaitForSingleObject, INFINITE, PROCESS_SYNCHRONIZE,
};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VK_LWIN,
};
use windows::Win32::UI::Shell::{
    SHAppBarMessage, ABM_GETSTATE, ABM_SETSTATE, ABS_ALWAYSONTOP, ABS_AUTOHIDE, APPBARDATA,
};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, FindWindowW, GetClassNameW, GetForegroundWindow, GetWindowRect, IsWindowVisible,
    SendMessageTimeoutW, ShowWindow, HWND_BROADCAST, SMTO_ABORTIFHUNG, SW_HIDE, SW_SHOWNA,
    SW_SHOWNOACTIVATE, WM_SETTINGCHANGE,
};

use super::{Battery, MediaCommand, MediaState};

fn hwnd(raw: isize) -> HWND {
    HWND(raw as *mut c_void)
}

// ---------- fullscreen ----------

pub fn foreground_fullscreen(own: Option<isize>) -> bool {
    unsafe {
        let fg = GetForegroundWindow();
        if fg.is_invalid() {
            return false;
        }
        if own.is_some_and(|h| fg.0 as isize == h) {
            return false;
        }
        if is_shell_window(fg) {
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
        if !GetMonitorInfoW(monitor, &mut info).as_bool() {
            return false;
        }
        let m = info.rcMonitor;
        window_rect.left <= m.left
            && window_rect.top <= m.top
            && window_rect.right >= m.right
            && window_rect.bottom >= m.bottom
    }
}

fn class_name(window: HWND) -> String {
    let mut buf = [0u16; 128];
    let len = unsafe { GetClassNameW(window, &mut buf) };
    String::from_utf16_lossy(&buf[..len.max(0) as usize])
}

/// The desktop and shell windows cover the whole monitor but are not "fullscreen apps".
fn is_shell_window(window: HWND) -> bool {
    matches!(
        class_name(window).as_str(),
        "Progman" | "WorkerW" | "Shell_TrayWnd" | "Shell_SecondaryTrayWnd"
    )
}

// ---------- taskbar ----------

fn primary_taskbar() -> Option<HWND> {
    unsafe { FindWindowW(w!("Shell_TrayWnd"), PCWSTR::null()).ok() }
}

fn all_taskbars() -> Vec<HWND> {
    unsafe extern "system" fn collect(window: HWND, lparam: LPARAM) -> BOOL {
        let list = &mut *(lparam.0 as *mut Vec<HWND>);
        if matches!(
            class_name(window).as_str(),
            "Shell_TrayWnd" | "Shell_SecondaryTrayWnd"
        ) {
            list.push(window);
        }
        BOOL(1)
    }
    let mut list: Vec<HWND> = Vec::new();
    unsafe {
        let _ = EnumWindows(Some(collect), LPARAM(&mut list as *mut Vec<HWND> as isize));
    }
    list
}

fn appbar_data() -> APPBARDATA {
    APPBARDATA {
        cbSize: std::mem::size_of::<APPBARDATA>() as u32,
        hWnd: primary_taskbar().unwrap_or_default(),
        ..Default::default()
    }
}

pub fn taskbar_autohide() -> Option<bool> {
    primary_taskbar()?;
    let mut data = appbar_data();
    let state = unsafe { SHAppBarMessage(ABM_GETSTATE, &mut data) } as u32;
    Some(state & ABS_AUTOHIDE != 0)
}

pub fn set_taskbar_autohide(enabled: bool) -> Result<(), String> {
    if primary_taskbar().is_none() {
        return Err("Windows taskbar not found".into());
    }
    let mut data = appbar_data();
    let flags = if enabled {
        ABS_AUTOHIDE
    } else {
        ABS_ALWAYSONTOP
    };
    data.lParam = LPARAM(flags as isize);
    unsafe {
        SHAppBarMessage(ABM_SETSTATE, &mut data);
    }
    Ok(())
}

pub fn taskbar_visible() -> Option<bool> {
    let bars = all_taskbars();
    (!bars.is_empty()).then(|| {
        bars.iter()
            .any(|bar| unsafe { IsWindowVisible(*bar).as_bool() })
    })
}

pub fn set_taskbar_visible(visible: bool) -> Result<(), String> {
    let bars = all_taskbars();
    if bars.is_empty() {
        return Err("Windows taskbar not found".into());
    }
    for bar in bars {
        unsafe {
            let _ = ShowWindow(bar, if visible { SW_SHOWNA } else { SW_HIDE });
        }
    }
    Ok(())
}

// ---------- process guard ----------

pub fn wait_for_process_exit(pid: u32) {
    unsafe {
        match OpenProcess(PROCESS_SYNCHRONIZE, false, pid) {
            Ok(handle) => {
                WaitForSingleObject(handle, INFINITE);
                let _ = CloseHandle(handle);
            }
            Err(_) => {
                // The parent is already gone.
            }
        }
    }
}

// ---------- window helpers ----------

pub fn show_no_activate(raw: isize) {
    unsafe {
        let _ = ShowWindow(hwnd(raw), SW_SHOWNOACTIVATE);
    }
}

pub fn open_start_menu() -> Result<(), String> {
    let key = |flags| INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: VK_LWIN,
                dwFlags: flags,
                ..Default::default()
            },
        },
    };
    let inputs = [key(Default::default()), key(KEYEVENTF_KEYUP)];
    let sent = unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
    if sent == inputs.len() as u32 {
        Ok(())
    } else {
        Err("could not open Start".into())
    }
}

// ---------- system stats ----------

fn filetime(ft: FILETIME) -> u64 {
    (u64::from(ft.dwHighDateTime) << 32) | u64::from(ft.dwLowDateTime)
}

/// Returns (idle, total) CPU time counters.
pub fn cpu_times() -> Option<(u64, u64)> {
    let (mut idle, mut kernel, mut user) = (
        FILETIME::default(),
        FILETIME::default(),
        FILETIME::default(),
    );
    unsafe { GetSystemTimes(Some(&mut idle), Some(&mut kernel), Some(&mut user)).ok()? };
    // Kernel time already includes idle time.
    Some((filetime(idle), filetime(kernel) + filetime(user)))
}

/// Returns (load percent, total bytes, available bytes).
pub fn memory() -> Option<(f32, u64, u64)> {
    let mut status = MEMORYSTATUSEX {
        dwLength: std::mem::size_of::<MEMORYSTATUSEX>() as u32,
        ..Default::default()
    };
    unsafe { GlobalMemoryStatusEx(&mut status).ok()? };
    Some((
        status.dwMemoryLoad as f32,
        status.ullTotalPhys,
        status.ullAvailPhys,
    ))
}

pub fn battery() -> Option<Battery> {
    let mut status = SYSTEM_POWER_STATUS::default();
    unsafe { GetSystemPowerStatus(&mut status).ok()? };
    const NO_BATTERY: u8 = 128;
    const UNKNOWN: u8 = 255;
    if status.BatteryFlag & NO_BATTERY != 0 || status.BatteryLifePercent == UNKNOWN {
        return None;
    }
    Some(Battery {
        percent: status.BatteryLifePercent.min(100),
        charging: status.ACLineStatus == 1,
    })
}

// ---------- theme ----------

const PERSONALIZE: PCWSTR = w!("Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize");

fn read_dword(name: PCWSTR) -> Option<u32> {
    let mut value: u32 = 0;
    let mut size = std::mem::size_of::<u32>() as u32;
    let status = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            PERSONALIZE,
            name,
            RRF_RT_REG_DWORD,
            None,
            Some(&mut value as *mut u32 as *mut c_void),
            Some(&mut size),
        )
    };
    status.is_ok().then_some(value)
}

fn write_dword(name: PCWSTR, value: u32) -> Result<(), String> {
    let status = unsafe {
        RegSetKeyValueW(
            HKEY_CURRENT_USER,
            PERSONALIZE,
            name,
            REG_DWORD.0,
            Some(&value as *const u32 as *const c_void),
            std::mem::size_of::<u32>() as u32,
        )
    };
    status.ok().map_err(|e| e.to_string())
}

pub fn system_dark_mode() -> Option<bool> {
    read_dword(w!("AppsUseLightTheme")).map(|light| light == 0)
}

pub fn set_system_dark_mode(dark: bool) -> Result<(), String> {
    let light = u32::from(!dark);
    write_dword(w!("AppsUseLightTheme"), light)?;
    write_dword(w!("SystemUsesLightTheme"), light)?;
    let area = HSTRING::from("ImmersiveColorSet");
    unsafe {
        SendMessageTimeoutW(
            HWND_BROADCAST,
            WM_SETTINGCHANGE,
            WPARAM(0),
            LPARAM(area.as_ptr() as isize),
            SMTO_ABORTIFHUNG,
            200,
            None,
        );
    }
    Ok(())
}

// ---------- media ----------

fn current_session() -> Option<Session> {
    let manager = SessionManager::RequestAsync().ok()?.get().ok()?;
    manager.GetCurrentSession().ok()
}

fn friendly_app_name(id: &str) -> String {
    let tail = id.rsplit('!').next().unwrap_or(id);
    let tail = tail.trim_end_matches(".exe").trim_end_matches(".EXE");
    let tail = tail.rsplit('\\').next().unwrap_or(tail);
    let lower = tail.to_ascii_lowercase();
    let known = [
        ("spotify", "Spotify"),
        ("chrome", "Chrome"),
        ("msedge", "Edge"),
        ("firefox", "Firefox"),
        ("brave", "Brave"),
        ("zunemusic", "Media Player"),
        ("microsoft.media.player", "Media Player"),
        ("vlc", "VLC"),
        ("applemusic", "Apple Music"),
        ("itunes", "iTunes"),
    ];
    for (needle, name) in known {
        if lower.contains(needle) {
            return name.to_string();
        }
    }
    let mut chars = tail.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().chain(chars).collect(),
        None => String::new(),
    }
}

pub fn media_state() -> MediaState {
    let Some(session) = current_session() else {
        return MediaState::default();
    };
    let mut state = MediaState {
        available: true,
        app: session
            .SourceAppUserModelId()
            .map(|id| friendly_app_name(&id.to_string_lossy()))
            .unwrap_or_default(),
        ..Default::default()
    };
    if let Ok(props) = session.TryGetMediaPropertiesAsync().and_then(|op| op.get()) {
        state.title = props
            .Title()
            .map(|s| s.to_string_lossy())
            .unwrap_or_default();
        state.artist = props
            .Artist()
            .map(|s| s.to_string_lossy())
            .unwrap_or_default();
        state.album = props
            .AlbumTitle()
            .map(|s| s.to_string_lossy())
            .unwrap_or_default();
    }
    if let Ok(info) = session.GetPlaybackInfo() {
        state.playing = info
            .PlaybackStatus()
            .map(|s| s == PlaybackStatus::Playing)
            .unwrap_or(false);
        if let Ok(controls) = info.Controls() {
            state.can_next = controls.IsNextEnabled().unwrap_or(false);
            state.can_previous = controls.IsPreviousEnabled().unwrap_or(false);
        }
    }
    state
}

pub fn media_command(command: MediaCommand) -> Result<bool, String> {
    let session = current_session().ok_or_else(|| "nothing is playing".to_string())?;
    let op = match command {
        MediaCommand::Play => session.TryPlayAsync(),
        MediaCommand::Pause => session.TryPauseAsync(),
        MediaCommand::Toggle => session.TryTogglePlayPauseAsync(),
        MediaCommand::Next => session.TrySkipNextAsync(),
        MediaCommand::Previous => session.TrySkipPreviousAsync(),
    };
    op.and_then(|o| o.get()).map_err(|e| e.to_string())
}
