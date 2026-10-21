import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "@opendock/config-schema";

export async function getSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_settings");
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  return invoke<AppSettings>("save_settings", { settings });
}

export async function applyDockLayout(): Promise<void> {
  return invoke("apply_dock_layout_command");
}

export async function getCurrentMonitorId(): Promise<string | null> {
  return invoke<string | null>("get_current_monitor_id");
}

export async function quitApp(): Promise<void> {
  return invoke("quit_app");
}

export async function setLaunchAtStartup(enabled: boolean): Promise<boolean> {
  return invoke<boolean>("set_launch_at_startup", { enabled });
}
