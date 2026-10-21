import type { IconName } from "./icons";

export type WidgetCategory = "Essentials" | "Productivity" | "System" | "Info";

export type Widget = {
  /** Must match the id in the desktop app's widget catalog. */
  id: string;
  name: string;
  icon: IconName;
  category: WidgetCategory;
  summary: string;
  /** Hosts the widget contacts. Empty means it never leaves the device. */
  network: string[];
  stores?: string;
};

export const widgetCategories: WidgetCategory[] = ["Essentials", "Productivity", "System", "Info"];

export const widgets: Widget[] = [
  {
    id: "start",
    name: "Start",
    icon: "grid",
    category: "Essentials",
    summary: "Search every installed app, keep favourites pinned, and lock, sleep or restart. Can open Windows Start instead.",
    network: [],
  },
  {
    id: "apps",
    name: "Apps",
    icon: "window",
    category: "Essentials",
    summary: "Pinned apps and open windows with live previews, grouping and window counts. This is what replaces the taskbar.",
    network: [],
    stores: "Your pinned apps",
  },
  {
    id: "clock",
    name: "Clock",
    icon: "clock",
    category: "Essentials",
    summary: "Time and date at a glance. Click for the month and today's agenda.",
    network: [],
  },
  {
    id: "media",
    name: "Now playing",
    icon: "music",
    category: "Essentials",
    summary: "Track, artist and controls for whichever app is playing: Spotify, a browser, anything that uses Windows media controls.",
    network: [],
  },
  {
    id: "focus",
    name: "Focus timer",
    icon: "timer",
    category: "Productivity",
    summary: "Pomodoro rounds with breaks, a progress ring and a week of history.",
    network: [],
    stores: "Focus sessions",
  },
  {
    id: "todos",
    name: "Todos",
    icon: "check",
    category: "Productivity",
    summary: "A quick list of things to do, one click away.",
    network: [],
    stores: "Todos",
  },
  {
    id: "notes",
    name: "Notes",
    icon: "note",
    category: "Productivity",
    summary: "Scratch notes you can pin for later.",
    network: [],
    stores: "Notes",
  },
  {
    id: "calendar",
    name: "Next event",
    icon: "calendar",
    category: "Productivity",
    summary: "A countdown to your next meeting from Google, Outlook, iCloud or any iCal feed.",
    network: ["your calendar host"],
    stores: "Calendar events. The feed link goes in Windows Credential Manager.",
  },
  {
    id: "volume",
    name: "Volume",
    icon: "volume",
    category: "System",
    summary: "Scroll to change the volume, middle-click to mute, click for a slider and presets.",
    network: [],
  },
  {
    id: "tray",
    name: "Quick actions",
    icon: "bolt",
    category: "System",
    summary: "Windows quick settings, notifications and show desktop.",
    network: [],
  },
  {
    id: "system",
    name: "System",
    icon: "cpu",
    category: "System",
    summary: "CPU and memory with a live sparkline.",
    network: [],
  },
  {
    id: "battery",
    name: "Battery",
    icon: "battery",
    category: "System",
    summary: "Charge level and whether you're plugged in.",
    network: [],
  },
  {
    id: "weather",
    name: "Weather",
    icon: "cloud",
    category: "Info",
    summary: "Current conditions, the next few hours and the week ahead.",
    network: ["api.open-meteo.com", "geocoding-api.open-meteo.com"],
    stores: "The last forecast, so it still shows offline",
  },
  {
    id: "day-progress",
    name: "Day progress",
    icon: "progress",
    category: "Info",
    summary: "How much of the day, week and year has gone.",
    network: [],
  },
];

export function widgetsIn(category: WidgetCategory): Widget[] {
  return widgets.filter((widget) => widget.category === category);
}

export const offlineWidgetCount = widgets.filter((widget) => widget.network.length === 0).length;
