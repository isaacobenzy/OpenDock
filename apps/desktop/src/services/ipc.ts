import { invoke, isTauri } from "@tauri-apps/api/core";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { AppSettings, Rule, RuleAction } from "@opendock/config-schema";

// ---------- shapes returned by the Rust side ----------

export type MediaState = {
  available: boolean;
  playing: boolean;
  title: string;
  artist: string;
  album: string;
  app: string;
  canNext: boolean;
  canPrevious: boolean;
};
export type MediaCommand = "play" | "pause" | "toggle" | "next" | "previous";

export type Battery = { percent: number; charging: boolean };
export type SystemStats = {
  cpu: number | null;
  memory: number | null;
  memoryUsedGb: number | null;
  memoryTotalGb: number | null;
  battery: Battery | null;
};

export type FocusPhase = "idle" | "focus" | "break";
export type FocusDay = { dayStart: number; minutes: number; sessions: number };
export type FocusState = {
  phase: FocusPhase;
  startedAt: number | null;
  endsAt: number | null;
  plannedMinutes: number;
  todayMinutes: number;
  history: FocusDay[];
};

export type Todo = {
  id: number;
  title: string;
  done: boolean;
  createdAt: number;
  completedAt: number | null;
};
export type Note = { id: number; body: string; pinned: boolean; createdAt: number; updatedAt: number };

export type HourForecast = { time: number; temperature: number; precipitation: number; code: number };
export type DayForecast = { date: number; high: number; low: number; code: number; precipitation: number };
export type WeatherSnapshot = {
  city: string;
  unit: string;
  temperature: number;
  apparentTemperature: number;
  code: number;
  isDay: boolean;
  windSpeed: number;
  high: number;
  low: number;
  sunrise: number | null;
  sunset: number | null;
  hourly: HourForecast[];
  daily: DayForecast[];
  fetchedAt: number;
  stale: boolean;
  error: string | null;
};
export type CityResult = {
  name: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
};

export type Calendar = {
  id: number;
  name: string;
  color: string;
  host: string;
  lastSyncedAt: number | null;
  lastError: string | null;
};
export type CalendarEvent = {
  calendarId: number;
  calendarName: string;
  color: string;
  uid: string;
  title: string;
  location: string;
  startsAt: number;
  endsAt: number;
  allDay: boolean;
};

export type ActivityEntry = {
  id: number;
  at: number;
  ruleId: string;
  ruleName: string;
  event: string;
  summary: string;
  canUndo: boolean;
  undone: boolean;
};
export type LedgerRow = { widget: string; host: string; requests: number; failures: number; lastAt: number };
export type Decision =
  | { outcome: "fire"; actions: RuleAction[] }
  | { outcome: "skip"; reason: string };

export type TaskbarStatus = {
  supported: boolean;
  mode: AppSettings["taskbar"]["mode"];
  autohide: boolean | null;
  visible: boolean | null;
  originalAutohide: boolean | null;
};

export type FlyoutRequest = { kind: string; target?: string | null; anchor: number };
export type ToastPayload = {
  id: string;
  ruleName: string;
  text: string;
  activityId: number | null;
  canUndo: boolean;
};
export type BusEvent = {
  name: string;
  version: number;
  timestamp: number;
  source: string;
  payload: Record<string, unknown>;
  dedupeKey?: string;
};

export type AppWindow = {
  id: number;
  title: string;
  /** Lower-cased executable path; windows of one app share it. */
  appId: string;
  exe: string;
  appName: string;
  minimized: boolean;
};
export type WindowsSnapshot = { windows: AppWindow[]; active: number | null };
export type WindowAction = "activate" | "minimize" | "close";
export type ShellApp = { name: string; path: string; target: string | null };
export type VolumeState = { level: number; muted: boolean };
export type Shortcut = "quickSettings" | "notifications" | "showDesktop" | "taskView" | "search";
export type PowerAction = "lock" | "sleep" | "signOut" | "restart" | "shutDown";
export type ThumbnailSlot = { id: number; x: number; y: number; width: number; height: number };

export type HubPage =
  | "welcome"
  | "apps"
  | "widgets"
  | "automations"
  | "activity"
  | "dock"
  | "calendars"
  | "privacy";
export type DataTopic = "todos" | "notes" | "calendar" | "rules" | "activity";

// ---------- settings and dock ----------

export const getSettings = () => invoke<AppSettings>("get_settings");
export const saveSettings = (settings: AppSettings) =>
  invoke<AppSettings>("save_settings", { settings });
export const applyDockLayout = () => invoke<void>("apply_dock_layout_command");
export const setDockLength = (length: number) =>
  invoke<void>("set_dock_length", { length: Math.round(length) });
export const getCurrentMonitorId = () => invoke<string | null>("get_current_monitor_id");
export const quitApp = () => invoke<void>("quit_app");
export const setLaunchAtStartup = (enabled: boolean) =>
  invoke<boolean>("set_launch_at_startup", { enabled });
export const getTaskbarStatus = () => invoke<TaskbarStatus>("get_taskbar_status");

// ---------- widgets ----------

export const getMediaState = () => invoke<MediaState>("get_media_state");
export const mediaControl = (command: MediaCommand) => invoke<boolean>("media_control", { command });
export const getSystemStats = () => invoke<SystemStats | null>("get_system_stats");
export const openStartMenu = () => invoke<void>("open_start_menu");

export const getFocusState = () => invoke<FocusState>("get_focus_state");
export const focusStart = (minutes?: number) => invoke<FocusState>("focus_start", { minutes });
export const focusStop = () => invoke<FocusState>("focus_stop");

export const listTodos = () => invoke<Todo[]>("list_todos");
export const addTodo = (title: string) => invoke<Todo>("add_todo", { title });
export const setTodoDone = (id: number, done: boolean) =>
  invoke<Todo | null>("set_todo_done", { id, done });
export const renameTodo = (id: number, title: string) =>
  invoke<Todo | null>("rename_todo", { id, title });
export const deleteTodo = (id: number) => invoke<void>("delete_todo", { id });
export const clearDoneTodos = () => invoke<number>("clear_done_todos");

export const listNotes = () => invoke<Note[]>("list_notes");
export const createNote = (body: string) => invoke<Note>("create_note", { body });
export const updateNote = (id: number, body: string) => invoke<Note | null>("update_note", { id, body });
export const pinNote = (id: number, pinned: boolean) => invoke<Note | null>("pin_note", { id, pinned });
export const deleteNote = (id: number) => invoke<void>("delete_note", { id });

export const getWeather = () => invoke<WeatherSnapshot | null>("get_weather");
export const refreshWeather = () => invoke<void>("refresh_weather");
export const searchCity = (query: string) => invoke<CityResult[]>("search_city", { query });

export const listCalendars = () => invoke<Calendar[]>("list_calendars");
export const addCalendar = (name: string, url: string) => invoke<number>("add_calendar", { name, url });
export const removeCalendar = (id: number) => invoke<void>("remove_calendar", { id });
export const syncCalendars = () => invoke<void>("sync_calendars");
export const upcomingEvents = (hours?: number) => invoke<CalendarEvent[]>("upcoming_events", { hours });

// ---------- apps and the tray ----------

export const listWindows = () => invoke<WindowsSnapshot>("list_windows");
export const windowAction = (id: number, action: WindowAction) =>
  invoke<void>("window_action", { id, action });
export const getAppIcon = (path: string, window?: number) =>
  invoke<string | null>("get_app_icon", { path, window: window ?? null });
export const listInstalledApps = () => invoke<ShellApp[]>("list_installed_apps");
export const listTaskbarPins = () => invoke<ShellApp[]>("list_taskbar_pins");
export const launchApp = (path: string) => invoke<void>("launch_app", { path });
export const getVolume = () => invoke<VolumeState | null>("get_volume");
export const setVolume = (level: number) =>
  invoke<VolumeState>("set_volume", { level: Math.max(0, Math.min(100, Math.round(level))) });
export const setMuted = (muted: boolean) => invoke<VolumeState>("set_muted", { muted });
export const sendShortcut = (shortcut: Shortcut) => invoke<void>("send_shortcut", { shortcut });
export const powerAction = (action: PowerAction) => invoke<void>("power_action", { action });
export const showThumbnails = (slots: ThumbnailSlot[]) => invoke<number>("show_thumbnails", { slots });
export const clearThumbnails = () => invoke<void>("clear_thumbnails");

// ---------- automation ----------

export const listRules = () => invoke<Rule[]>("list_rules");
export const listRecipes = () => invoke<Rule[]>("list_recipes");
export const saveRule = (rule: Rule) => invoke<Rule>("save_rule", { rule });
export const setRuleEnabled = (id: string, enabled: boolean) =>
  invoke<void>("set_rule_enabled", { id, enabled });
export const deleteRule = (id: string) => invoke<void>("delete_rule", { id });
export const dryRunRule = (rule: Rule, event: { name: string; payload: Record<string, unknown> }) =>
  invoke<Decision>("dry_run_rule", { rule, event });
export const listActivity = (limit?: number) => invoke<ActivityEntry[]>("list_activity", { limit });
export const undoActivity = (id: number) => invoke<void>("undo_activity", { id });
export const clearActivity = () => invoke<void>("clear_activity");
export const getPrivacyLedger = () => invoke<LedgerRow[]>("get_privacy_ledger");

// ---------- windows ----------

export const openHub = (page?: HubPage) => invoke<void>("open_hub", { page });
export const getHubPage = () => invoke<HubPage>("get_hub_page");
export const showFlyout = (request: FlyoutRequest) => invoke<void>("show_flyout", { request });
export const getFlyoutRequest = () => invoke<FlyoutRequest | null>("get_flyout_request");
export const resizeFlyout = (height: number) => invoke<void>("resize_flyout", { height });
export const hideFlyout = () => invoke<void>("hide_flyout");
export const takePendingToasts = () => invoke<ToastPayload[]>("take_pending_toasts");
export const hideToast = () => invoke<void>("hide_toast");

// ---------- events ----------

export type EventMap = {
  "settings:changed": AppSettings;
  "system:stats": SystemStats;
  "media:state": MediaState;
  "focus:state": FocusState;
  "weather:update": WeatherSnapshot;
  "data:changed": DataTopic;
  "bus:event": BusEvent;
  "dock:highlight": string;
  "toast:show": ToastPayload;
  "flyout:show": FlyoutRequest;
  "flyout:hidden": { kind: string; at: number };
  "hub:navigate": HubPage;
  "dock:fullscreen-hidden": null;
  "dock:fullscreen-visible": null;
  "windows:changed": WindowsSnapshot;
  "volume:state": VolumeState | null;
};

/** Subscribes to a backend event. Outside Tauri (tests, plain browser) it is a no-op. */
export function on<K extends keyof EventMap>(
  name: K,
  handler: (payload: EventMap[K]) => void,
): () => void {
  if (!isTauri()) {
    return () => undefined;
  }
  let unlisten: UnlistenFn | null = null;
  let cancelled = false;
  void listen<EventMap[K]>(name, (event) => handler(event.payload)).then((fn) => {
    if (cancelled) {
      fn();
    } else {
      unlisten = fn;
    }
  });
  return () => {
    cancelled = true;
    unlisten?.();
  };
}

export function broadcast<K extends keyof EventMap>(name: K, payload: EventMap[K]): void {
  if (isTauri()) {
    void emit(name, payload);
  }
}

export function errorText(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}
