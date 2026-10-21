//! Running windows, app icons, launching, live previews and the dock's reserved edge.

use std::collections::HashMap;
use std::ffi::c_void;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

use windows::core::{w, Interface, HSTRING, PCWSTR, PWSTR};
use windows::Win32::Foundation::{CloseHandle, BOOL, HWND, LPARAM, RECT, WPARAM};
use windows::Win32::Graphics::Dwm::{
    DwmGetWindowAttribute, DwmQueryThumbnailSourceSize, DwmRegisterThumbnail,
    DwmUnregisterThumbnail, DwmUpdateThumbnailProperties, DWMWA_CLOAKED, DWM_THUMBNAIL_PROPERTIES,
    DWM_TNP_OPACITY, DWM_TNP_RECTDESTINATION, DWM_TNP_SOURCECLIENTAREAONLY, DWM_TNP_VISIBLE,
};
use windows::Win32::Graphics::Gdi::{
    CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, GetObjectW, BITMAP, BITMAPINFO,
    BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HDC, HGDIOBJ,
};
use windows::Win32::Storage::FileSystem::{
    GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW, FILE_FLAGS_AND_ATTRIBUTES,
};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, IPersistFile, CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED,
    STGM_READ,
};
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::Controls::{IImageList, ILD_TRANSPARENT};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VK_MENU,
};
use windows::Win32::UI::Shell::{
    IShellLinkW, SHAppBarMessage, SHGetFileInfoW, SHGetImageList, ShellExecuteW, ShellLink,
    ABE_BOTTOM, ABE_LEFT, ABE_RIGHT, ABE_TOP, ABM_NEW, ABM_QUERYPOS, ABM_REMOVE, ABM_SETPOS,
    APPBARDATA, SHFILEINFOW, SHGFI_SYSICONINDEX, SHIL_EXTRALARGE,
};
use windows::Win32::UI::WindowsAndMessaging::{
    BringWindowToTop, DestroyIcon, EnumChildWindows, EnumWindows, GetClassLongPtrW, GetClassNameW,
    GetForegroundWindow, GetIconInfo, GetWindow, GetWindowLongPtrW, GetWindowTextLengthW,
    GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindow, IsWindowVisible, PostMessageW,
    SendMessageTimeoutW, SetForegroundWindow, ShowWindow, GCLP_HICON, GWL_EXSTYLE, GW_OWNER, HICON,
    ICONINFO, ICON_BIG, SMTO_ABORTIFHUNG, SW_MINIMIZE, SW_RESTORE, SW_SHOWNORMAL, WM_APP, WM_CLOSE,
    WM_GETICON, WS_EX_APPWINDOW, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
};

use super::{AppWindow, ShellApp};
use crate::geometry::DockPosition;

fn hwnd(raw: isize) -> HWND {
    HWND(raw as *mut c_void)
}

fn com_init() {
    // Already-initialised threads report a mode mismatch, which is fine for these calls.
    let _ = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
}

// ---------- windows ----------

fn class_name(window: HWND) -> String {
    let mut buf = [0u16; 128];
    let len = unsafe { GetClassNameW(window, &mut buf) };
    String::from_utf16_lossy(&buf[..len.max(0) as usize])
}

fn window_text(window: HWND) -> String {
    let len = unsafe { GetWindowTextLengthW(window) };
    if len <= 0 {
        return String::new();
    }
    let mut buf = vec![0u16; len as usize + 1];
    let copied = unsafe { GetWindowTextW(window, &mut buf) };
    String::from_utf16_lossy(&buf[..copied.max(0) as usize])
}

fn is_cloaked(window: HWND) -> bool {
    let mut cloaked: u32 = 0;
    let result = unsafe {
        DwmGetWindowAttribute(
            window,
            DWMWA_CLOAKED,
            &mut cloaked as *mut u32 as *mut c_void,
            std::mem::size_of::<u32>() as u32,
        )
    };
    result.is_ok() && cloaked != 0
}

fn pid_of(window: HWND) -> u32 {
    let mut pid = 0u32;
    unsafe { GetWindowThreadProcessId(window, Some(&mut pid)) };
    pid
}

pub fn window_pid(raw: isize) -> u32 {
    pid_of(hwnd(raw))
}

fn process_path(pid: u32) -> Option<String> {
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buf = [0u16; 1024];
        let mut len = buf.len() as u32;
        let result = QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_WIN32,
            PWSTR(buf.as_mut_ptr()),
            &mut len,
        );
        let _ = CloseHandle(handle);
        result.ok()?;
        Some(String::from_utf16_lossy(&buf[..len as usize]))
    }
}

/// Store apps run inside ApplicationFrameHost; the real process owns a child window.
fn hosted_app_path(frame: HWND, frame_pid: u32) -> Option<String> {
    unsafe extern "system" fn find(child: HWND, lparam: LPARAM) -> BOOL {
        let (frame_pid, found) = &mut *(lparam.0 as *mut (u32, u32));
        let pid = pid_of(child);
        if pid != 0 && pid != *frame_pid {
            *found = pid;
            return BOOL(0);
        }
        BOOL(1)
    }
    let mut search = (frame_pid, 0u32);
    unsafe {
        let _ = EnumChildWindows(
            frame,
            Some(find),
            LPARAM(&mut search as *mut (u32, u32) as isize),
        );
    }
    (search.1 != 0).then(|| process_path(search.1)).flatten()
}

fn names() -> &'static Mutex<HashMap<String, String>> {
    static NAMES: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
    NAMES.get_or_init(|| Mutex::new(HashMap::new()))
}

fn file_description(path: &str) -> Option<String> {
    unsafe {
        let wide = HSTRING::from(path);
        let size = GetFileVersionInfoSizeW(&wide, None);
        if size == 0 {
            return None;
        }
        let mut data = vec![0u8; size as usize];
        GetFileVersionInfoW(&wide, 0, size, data.as_mut_ptr() as *mut c_void).ok()?;
        let mut ptr: *mut c_void = std::ptr::null_mut();
        let mut len = 0u32;
        if !VerQueryValueW(
            data.as_ptr() as *const c_void,
            w!("\\VarFileInfo\\Translation"),
            &mut ptr,
            &mut len,
        )
        .as_bool()
            || len < 4
        {
            return None;
        }
        let pair = ptr as *const u16;
        let key = HSTRING::from(format!(
            "\\StringFileInfo\\{:04x}{:04x}\\FileDescription",
            *pair,
            *pair.add(1)
        ));
        if !VerQueryValueW(data.as_ptr() as *const c_void, &key, &mut ptr, &mut len).as_bool()
            || len == 0
        {
            return None;
        }
        let text =
            String::from_utf16_lossy(std::slice::from_raw_parts(ptr as *const u16, len as usize));
        let text = text.trim_end_matches('\0').trim().to_string();
        (!text.is_empty() && text.chars().count() <= 40).then_some(text)
    }
}

fn exe_stem(path: &str) -> String {
    let file = path.rsplit(['\\', '/']).next().unwrap_or(path);
    let stem = file.rsplit_once('.').map(|(stem, _)| stem).unwrap_or(file);
    let mut chars = stem.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().chain(chars).collect(),
        None => String::new(),
    }
}

fn app_name(exe: &str, title: &str) -> String {
    if exe.is_empty() {
        return title.to_string();
    }
    if let Some(name) = names().lock().ok().and_then(|n| n.get(exe).cloned()) {
        return name;
    }
    let name = file_description(exe).unwrap_or_else(|| exe_stem(exe));
    if let Ok(mut cache) = names().lock() {
        cache.insert(exe.to_string(), name.clone());
    }
    name
}

fn describe(window: HWND, own_pid: u32) -> Option<AppWindow> {
    unsafe {
        if !IsWindowVisible(window).as_bool() {
            return None;
        }
        if matches!(GetWindow(window, GW_OWNER), Ok(owner) if !owner.is_invalid()) {
            return None;
        }
        let ex = GetWindowLongPtrW(window, GWL_EXSTYLE) as u32;
        let app_window = ex & WS_EX_APPWINDOW.0 != 0;
        if !app_window && ex & (WS_EX_TOOLWINDOW.0 | WS_EX_NOACTIVATE.0) != 0 {
            return None;
        }
        if is_cloaked(window) {
            return None;
        }
        if matches!(
            class_name(window).as_str(),
            "Progman" | "WorkerW" | "Shell_TrayWnd" | "Shell_SecondaryTrayWnd"
        ) {
            return None;
        }
        let title = window_text(window);
        if title.is_empty() {
            return None;
        }
        let pid = pid_of(window);
        if pid == own_pid {
            return None;
        }
        let mut exe = process_path(pid).unwrap_or_default();
        if exe
            .to_ascii_lowercase()
            .ends_with("\\applicationframehost.exe")
        {
            if let Some(real) = hosted_app_path(window, pid) {
                exe = real;
            }
        }
        let name = if exe
            .to_ascii_lowercase()
            .ends_with("\\applicationframehost.exe")
        {
            title.clone()
        } else {
            app_name(&exe, &title)
        };
        Some(AppWindow {
            id: window.0 as i64,
            app_id: exe.to_lowercase(),
            exe,
            app_name: name,
            minimized: IsIconic(window).as_bool(),
            title,
        })
    }
}

pub fn list_windows(own_pid: u32) -> Vec<AppWindow> {
    unsafe extern "system" fn collect(window: HWND, lparam: LPARAM) -> BOOL {
        let list = &mut *(lparam.0 as *mut Vec<HWND>);
        list.push(window);
        BOOL(1)
    }
    let mut all: Vec<HWND> = Vec::new();
    unsafe {
        let _ = EnumWindows(Some(collect), LPARAM(&mut all as *mut Vec<HWND> as isize));
    }
    all.into_iter()
        .filter_map(|window| describe(window, own_pid))
        .collect()
}

pub fn foreground_window() -> Option<isize> {
    let window = unsafe { GetForegroundWindow() };
    (!window.is_invalid()).then_some(window.0 as isize)
}

fn tap_alt() {
    let key = |flags| INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: VK_MENU,
                dwFlags: flags,
                ..Default::default()
            },
        },
    };
    let inputs = [key(Default::default()), key(KEYEVENTF_KEYUP)];
    unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
}

fn live_window(raw: isize) -> Result<HWND, String> {
    let window = hwnd(raw);
    if unsafe { IsWindow(window).as_bool() } {
        Ok(window)
    } else {
        Err("that window has closed".into())
    }
}

pub fn activate_window(raw: isize) -> Result<(), String> {
    let window = live_window(raw)?;
    unsafe {
        if IsIconic(window).as_bool() {
            let _ = ShowWindow(window, SW_RESTORE);
        }
        if !SetForegroundWindow(window).as_bool() {
            // Windows only lets the app with recent input hand over focus; an Alt tap counts.
            tap_alt();
            let _ = SetForegroundWindow(window);
        }
        let _ = BringWindowToTop(window);
    }
    Ok(())
}

pub fn minimize_window(raw: isize) -> Result<(), String> {
    let window = live_window(raw)?;
    unsafe {
        let _ = ShowWindow(window, SW_MINIMIZE);
    }
    Ok(())
}

pub fn close_window(raw: isize) -> Result<(), String> {
    let window = live_window(raw)?;
    unsafe { PostMessageW(window, WM_CLOSE, WPARAM(0), LPARAM(0)) }.map_err(|e| e.to_string())
}

// ---------- icons ----------

unsafe fn hicon_rgba(icon: HICON) -> Option<(u32, u32, Vec<u8>)> {
    let mut info = ICONINFO::default();
    GetIconInfo(icon, &mut info).ok()?;
    let (color, mask) = (info.hbmColor, info.hbmMask);
    let pixels = (|| {
        if color.is_invalid() {
            return None;
        }
        let mut bitmap = BITMAP::default();
        let read = GetObjectW(
            HGDIOBJ(color.0),
            std::mem::size_of::<BITMAP>() as i32,
            Some(&mut bitmap as *mut BITMAP as *mut c_void),
        );
        if read == 0 || bitmap.bmWidth <= 0 || bitmap.bmHeight <= 0 {
            return None;
        }
        let (width, height) = (bitmap.bmWidth, bitmap.bmHeight);
        let header = || BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };
        let len = (width * height * 4) as usize;
        let mut buf = vec![0u8; len];
        let dc = CreateCompatibleDC(HDC::default());
        let mut bi = header();
        let lines = GetDIBits(
            dc,
            color,
            0,
            height as u32,
            Some(buf.as_mut_ptr() as *mut c_void),
            &mut bi,
            DIB_RGB_COLORS,
        );
        let has_alpha = buf.chunks_exact(4).any(|p| p[3] != 0);
        if lines > 0 && !has_alpha && !mask.is_invalid() {
            let mut mask_buf = vec![0u8; len];
            let mut bi = header();
            GetDIBits(
                dc,
                mask,
                0,
                height as u32,
                Some(mask_buf.as_mut_ptr() as *mut c_void),
                &mut bi,
                DIB_RGB_COLORS,
            );
            for (pixel, m) in buf.chunks_exact_mut(4).zip(mask_buf.chunks_exact(4)) {
                pixel[3] = if m[0] == 0 { 255 } else { 0 };
            }
        }
        let _ = DeleteDC(dc);
        if lines == 0 {
            return None;
        }
        for pixel in buf.chunks_exact_mut(4) {
            pixel.swap(0, 2);
        }
        Some((width as u32, height as u32, buf))
    })();
    if !color.is_invalid() {
        let _ = DeleteObject(HGDIOBJ(color.0));
    }
    if !mask.is_invalid() {
        let _ = DeleteObject(HGDIOBJ(mask.0));
    }
    pixels
}

/// The 48px shell icon for a file, shortcut or folder.
pub fn icon_rgba(path: &str) -> Option<(u32, u32, Vec<u8>)> {
    com_init();
    unsafe {
        let mut info = SHFILEINFOW::default();
        let found = SHGetFileInfoW(
            &HSTRING::from(path),
            FILE_FLAGS_AND_ATTRIBUTES(0),
            Some(&mut info),
            std::mem::size_of::<SHFILEINFOW>() as u32,
            SHGFI_SYSICONINDEX,
        );
        if found == 0 {
            return None;
        }
        let list: IImageList = SHGetImageList(SHIL_EXTRALARGE as i32).ok()?;
        let icon = list.GetIcon(info.iIcon, ILD_TRANSPARENT.0).ok()?;
        let pixels = hicon_rgba(icon);
        let _ = DestroyIcon(icon);
        pixels
    }
}

/// The icon a window draws in its title bar; Store apps only have this one.
pub fn window_icon_rgba(raw: isize) -> Option<(u32, u32, Vec<u8>)> {
    let window = live_window(raw).ok()?;
    unsafe {
        let mut result = 0usize;
        SendMessageTimeoutW(
            window,
            WM_GETICON,
            WPARAM(ICON_BIG as usize),
            LPARAM(0),
            SMTO_ABORTIFHUNG,
            150,
            Some(&mut result),
        );
        if result == 0 {
            result = GetClassLongPtrW(window, GCLP_HICON);
        }
        if result == 0 {
            return None;
        }
        // The window owns this icon; it must not be destroyed here.
        hicon_rgba(HICON(result as *mut c_void))
    }
}

// ---------- launching ----------

pub fn launch_path(path: &str) -> Result<(), String> {
    let result = unsafe {
        ShellExecuteW(
            HWND::default(),
            w!("open"),
            &HSTRING::from(path),
            PCWSTR::null(),
            PCWSTR::null(),
            SW_SHOWNORMAL,
        )
    };
    if result.0 as isize > 32 {
        Ok(())
    } else {
        Err(format!("Windows could not open {path}"))
    }
}

pub fn resolve_shortcut(path: &str) -> Option<String> {
    com_init();
    unsafe {
        let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER).ok()?;
        let file: IPersistFile = link.cast().ok()?;
        file.Load(&HSTRING::from(path), STGM_READ).ok()?;
        let mut buf = [0u16; 1024];
        link.GetPath(&mut buf, std::ptr::null_mut(), 0).ok()?;
        let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
        let target = String::from_utf16_lossy(&buf[..len]);
        (!target.is_empty()).then_some(target)
    }
}

fn env_path(var: &str, tail: &str) -> Option<PathBuf> {
    std::env::var_os(var).map(|base| PathBuf::from(base).join(tail))
}

pub fn start_menu_dirs() -> Vec<PathBuf> {
    [
        env_path("ProgramData", r"Microsoft\Windows\Start Menu\Programs"),
        env_path("APPDATA", r"Microsoft\Windows\Start Menu\Programs"),
    ]
    .into_iter()
    .flatten()
    .collect()
}

pub fn taskbar_pin_dir() -> Option<PathBuf> {
    env_path(
        "APPDATA",
        r"Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar",
    )
}

pub fn builtin_apps() -> Vec<ShellApp> {
    let windir = std::env::var("WINDIR").unwrap_or_else(|_| r"C:\Windows".into());
    let system = format!(r"{windir}\System32");
    vec![
        ShellApp {
            name: "File Explorer".into(),
            path: format!(r"{windir}\explorer.exe"),
            target: Some(format!(r"{windir}\explorer.exe")),
        },
        ShellApp {
            name: "Settings".into(),
            path: "ms-settings:".into(),
            target: None,
        },
        ShellApp {
            name: "Task Manager".into(),
            path: format!(r"{system}\Taskmgr.exe"),
            target: Some(format!(r"{system}\Taskmgr.exe")),
        },
        ShellApp {
            name: "Calculator".into(),
            path: format!(r"{system}\calc.exe"),
            target: None,
        },
    ]
}

// ---------- live previews ----------

static THUMBNAILS: Mutex<Vec<isize>> = Mutex::new(Vec::new());

pub fn clear_thumbnails() {
    if let Ok(mut thumbnails) = THUMBNAILS.lock() {
        for thumbnail in thumbnails.drain(..) {
            let _ = unsafe { DwmUnregisterThumbnail(thumbnail) };
        }
    }
}

pub fn set_thumbnails(destination: isize, slots: &[(isize, [i32; 4])]) -> usize {
    clear_thumbnails();
    let mut registered = Vec::new();
    for (source, slot) in slots {
        let Ok(source) = live_window(*source) else {
            continue;
        };
        unsafe {
            let Ok(thumbnail) = DwmRegisterThumbnail(hwnd(destination), source) else {
                continue;
            };
            let size = DwmQueryThumbnailSourceSize(thumbnail).unwrap_or_default();
            let [left, top, right, bottom] = super::fit_rect((size.cx, size.cy), *slot);
            let properties = DWM_THUMBNAIL_PROPERTIES {
                dwFlags: DWM_TNP_RECTDESTINATION
                    | DWM_TNP_VISIBLE
                    | DWM_TNP_OPACITY
                    | DWM_TNP_SOURCECLIENTAREAONLY,
                rcDestination: RECT {
                    left,
                    top,
                    right,
                    bottom,
                },
                opacity: 255,
                fVisible: BOOL(1),
                fSourceClientAreaOnly: BOOL(0),
                ..Default::default()
            };
            if DwmUpdateThumbnailProperties(thumbnail, &properties).is_ok() {
                registered.push(thumbnail);
            } else {
                let _ = DwmUnregisterThumbnail(thumbnail);
            }
        }
    }
    let count = registered.len();
    if let Ok(mut thumbnails) = THUMBNAILS.lock() {
        *thumbnails = registered;
    }
    count
}

// ---------- reserved edge ----------

static APPBAR: Mutex<Option<isize>> = Mutex::new(None);
const APPBAR_CALLBACK: u32 = WM_APP + 0x51;

fn appbar_data(handle: isize) -> APPBARDATA {
    APPBARDATA {
        cbSize: std::mem::size_of::<APPBARDATA>() as u32,
        hWnd: hwnd(handle),
        uCallbackMessage: APPBAR_CALLBACK,
        ..Default::default()
    }
}

pub fn set_appbar(handle: isize, band: Option<(DockPosition, [i32; 4])>) {
    let Ok(mut current) = APPBAR.lock() else {
        return;
    };
    if let Some(previous) = *current {
        if band.is_none() || previous != handle {
            let mut data = appbar_data(previous);
            unsafe { SHAppBarMessage(ABM_REMOVE, &mut data) };
            *current = None;
        }
    }
    let Some((edge, [left, top, right, bottom])) = band else {
        return;
    };
    let mut data = appbar_data(handle);
    if current.is_none() {
        if unsafe { SHAppBarMessage(ABM_NEW, &mut data) } == 0 {
            tracing::warn!("the shell refused to reserve a screen edge for the dock");
            return;
        }
        *current = Some(handle);
    }
    data.uEdge = match edge {
        DockPosition::Bottom => ABE_BOTTOM,
        DockPosition::Top => ABE_TOP,
        DockPosition::Left => ABE_LEFT,
        DockPosition::Right => ABE_RIGHT,
    };
    data.rc = RECT {
        left,
        top,
        right,
        bottom,
    };
    let (width, height) = (right - left, bottom - top);
    unsafe { SHAppBarMessage(ABM_QUERYPOS, &mut data) };
    // The shell may move the band past other bars; keep its depth.
    match edge {
        DockPosition::Bottom => data.rc.top = data.rc.bottom - height,
        DockPosition::Top => data.rc.bottom = data.rc.top + height,
        DockPosition::Left => data.rc.right = data.rc.left + width,
        DockPosition::Right => data.rc.left = data.rc.right - width,
    }
    unsafe { SHAppBarMessage(ABM_SETPOS, &mut data) };
}
