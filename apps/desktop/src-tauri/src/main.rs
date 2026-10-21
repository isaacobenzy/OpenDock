// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if opendock_desktop_lib::run_taskbar_guard_if_requested() {
        return;
    }
    opendock_desktop_lib::run()
}
