//! Volume, shell shortcuts and power actions: the parts of the taskbar's tray the dock
//! takes over when it replaces the taskbar.

use std::os::windows::process::CommandExt;

use windows::Win32::Foundation::{BOOL, BOOLEAN};
use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
use windows::Win32::Media::Audio::{eConsole, eRender, IMMDeviceEnumerator, MMDeviceEnumerator};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
};
use windows::Win32::System::Power::SetSuspendState;
use windows::Win32::System::Shutdown::LockWorkStation;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VIRTUAL_KEY, VK_LWIN,
    VK_TAB,
};

use super::{PowerAction, Shortcut, VolumeState};

fn endpoint() -> Option<IAudioEndpointVolume> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let devices: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).ok()?;
        let device = devices.GetDefaultAudioEndpoint(eRender, eConsole).ok()?;
        device
            .Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None)
            .ok()
    }
}

pub fn volume() -> Option<VolumeState> {
    let endpoint = endpoint()?;
    unsafe {
        let level = endpoint.GetMasterVolumeLevelScalar().ok()?;
        let muted = endpoint.GetMute().ok()?.as_bool();
        Some(VolumeState {
            level: (level * 100.0).round().clamp(0.0, 100.0) as u8,
            muted,
        })
    }
}

pub fn set_volume(level: u8) -> Result<VolumeState, String> {
    let endpoint = endpoint().ok_or_else(|| "no audio output found".to_string())?;
    unsafe {
        endpoint
            .SetMasterVolumeLevelScalar(f32::from(level.min(100)) / 100.0, std::ptr::null())
            .map_err(|e| e.to_string())?;
        if level > 0 {
            let _ = endpoint.SetMute(BOOL(0), std::ptr::null());
        }
    }
    volume().ok_or_else(|| "no audio output found".to_string())
}

pub fn set_muted(muted: bool) -> Result<VolumeState, String> {
    let endpoint = endpoint().ok_or_else(|| "no audio output found".to_string())?;
    unsafe {
        endpoint
            .SetMute(BOOL::from(muted), std::ptr::null())
            .map_err(|e| e.to_string())?;
    }
    volume().ok_or_else(|| "no audio output found".to_string())
}

fn send_keys(keys: &[VIRTUAL_KEY]) -> Result<(), String> {
    let key = |vk: VIRTUAL_KEY, up: bool| INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: vk,
                dwFlags: if up {
                    KEYEVENTF_KEYUP
                } else {
                    Default::default()
                },
                ..Default::default()
            },
        },
    };
    let inputs: Vec<INPUT> = keys
        .iter()
        .map(|&k| key(k, false))
        .chain(keys.iter().rev().map(|&k| key(k, true)))
        .collect();
    let sent = unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
    if sent as usize == inputs.len() {
        Ok(())
    } else {
        Err("Windows blocked the shortcut".into())
    }
}

pub fn send_shortcut(shortcut: Shortcut) -> Result<(), String> {
    let letter = |c: u8| VIRTUAL_KEY(u16::from(c));
    match shortcut {
        Shortcut::QuickSettings => send_keys(&[VK_LWIN, letter(b'A')]),
        Shortcut::Notifications => send_keys(&[VK_LWIN, letter(b'N')]),
        Shortcut::ShowDesktop => send_keys(&[VK_LWIN, letter(b'D')]),
        Shortcut::TaskView => send_keys(&[VK_LWIN, VK_TAB]),
        Shortcut::Search => send_keys(&[VK_LWIN, letter(b'S')]),
    }
}

fn shutdown_exe(args: &[&str]) -> Result<(), String> {
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    std::process::Command::new("shutdown.exe")
        .args(args)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

pub fn power_action(action: PowerAction) -> Result<(), String> {
    match action {
        PowerAction::Lock => unsafe { LockWorkStation() }.map_err(|e| e.to_string()),
        PowerAction::Sleep => {
            let ok = unsafe { SetSuspendState(BOOLEAN(0), BOOLEAN(0), BOOLEAN(0)) };
            if ok.as_bool() {
                Ok(())
            } else {
                Err("this PC can't sleep right now".into())
            }
        }
        PowerAction::SignOut => shutdown_exe(&["/l"]),
        PowerAction::Restart => shutdown_exe(&["/r", "/t", "0"]),
        PowerAction::ShutDown => shutdown_exe(&["/s", "/t", "0"]),
    }
}
