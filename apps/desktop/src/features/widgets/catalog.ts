import type { DockSize } from "@opendock/config-schema";

export type WidgetCategory = "Essentials" | "Productivity" | "System" | "Info";

export type WidgetDefinition = {
  id: string;
  name: string;
  category: WidgetCategory;
  description: string;
  sizes: DockSize[];
  /** Hosts the widget contacts. Empty means it never leaves the device. */
  network: string[];
  /** Data the widget stores locally. */
  stores?: string;
  /** Widget opens a panel on click; otherwise the click is the action. */
  panel: boolean;
  /** Settings page where the widget is configured, if any. */
  configure?: "dock" | "calendars" | "apps";
};

export const ADD_WIDGET_ID = "add-widget";

export const widgetCatalog: WidgetDefinition[] = [
  {
    id: "start",
    name: "Start",
    category: "Essentials",
    description: "A fast launcher with search, pinned apps and power options. It can open Windows Start instead.",
    sizes: ["s", "m", "l"],
    network: [],
    panel: false,
    configure: "apps",
  },
  {
    id: "apps",
    name: "Apps",
    category: "Essentials",
    description: "Pinned apps and every open window, with live previews. This is what replaces the taskbar.",
    sizes: ["s", "m", "l"],
    network: [],
    stores: "Your pinned apps",
    panel: false,
    configure: "apps",
  },
  {
    id: "volume",
    name: "Volume",
    category: "System",
    description: "Scroll to change the volume, middle-click to mute, click for the full slider.",
    sizes: ["s", "m", "l"],
    network: [],
    panel: true,
  },
  {
    id: "tray",
    name: "Quick actions",
    category: "System",
    description: "Wi-Fi and sound quick settings, notifications and show desktop, one click away.",
    sizes: ["s", "m", "l"],
    network: [],
    panel: false,
  },
  {
    id: "clock",
    name: "Clock",
    category: "Essentials",
    description: "Time and date. The panel shows the month and today's agenda.",
    sizes: ["s", "m", "l"],
    network: [],
    panel: true,
  },
  {
    id: "media",
    name: "Now playing",
    category: "Essentials",
    description: "Track, artist and controls for whatever app is playing media.",
    sizes: ["s", "m", "l"],
    network: [],
    panel: true,
  },
  {
    id: "focus",
    name: "Focus timer",
    category: "Productivity",
    description: "Pomodoro rounds with breaks, a progress ring and a week of history.",
    sizes: ["s", "m", "l"],
    network: [],
    stores: "Focus sessions",
    panel: true,
    configure: "dock",
  },
  {
    id: "todos",
    name: "Todos",
    category: "Productivity",
    description: "A quick list of things to do, kept on this device.",
    sizes: ["s", "m", "l"],
    network: [],
    stores: "Todos",
    panel: true,
  },
  {
    id: "notes",
    name: "Notes",
    category: "Productivity",
    description: "Scratch notes you can pin. Kept on this device.",
    sizes: ["s", "m", "l"],
    network: [],
    stores: "Notes",
    panel: true,
  },
  {
    id: "calendar",
    name: "Next event",
    category: "Productivity",
    description: "Your next meeting from any iCal feed, with a countdown.",
    sizes: ["s", "m", "l"],
    network: ["your calendar host"],
    stores: "Calendar events (the feed link goes in the system keychain)",
    panel: true,
    configure: "calendars",
  },
  {
    id: "system",
    name: "System",
    category: "System",
    description: "CPU and memory rings with a live sparkline.",
    sizes: ["s", "m", "l"],
    network: [],
    panel: true,
  },
  {
    id: "battery",
    name: "Battery",
    category: "System",
    description: "Charge level and charging state.",
    sizes: ["s", "m", "l"],
    network: [],
    panel: true,
  },
  {
    id: "weather",
    name: "Weather",
    category: "Info",
    description: "Current conditions, the next hours and the week ahead.",
    sizes: ["s", "m", "l"],
    network: ["api.open-meteo.com", "geocoding-api.open-meteo.com"],
    stores: "The last forecast, so it works offline",
    panel: true,
    configure: "dock",
  },
  {
    id: "day-progress",
    name: "Day progress",
    category: "Info",
    description: "How much of the day, week and year has gone.",
    sizes: ["s", "m", "l"],
    network: [],
    panel: true,
  },
];

export const widgetCategories: WidgetCategory[] = ["Essentials", "Productivity", "System", "Info"];

export function findWidget(id: string): WidgetDefinition | undefined {
  return widgetCatalog.find((widget) => widget.id === id);
}

export function searchWidgets(query: string, category: WidgetCategory | "All"): WidgetDefinition[] {
  const q = query.trim().toLowerCase();
  return widgetCatalog.filter(
    (widget) =>
      (category === "All" || widget.category === category) &&
      (q === "" ||
        widget.name.toLowerCase().includes(q) ||
        widget.description.toLowerCase().includes(q)),
  );
}
