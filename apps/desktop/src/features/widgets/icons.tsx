import type { WeatherKind } from "./format";

export type IconName =
  | "start"
  | "clock"
  | "play"
  | "pause"
  | "next"
  | "previous"
  | "music"
  | "focus"
  | "cpu"
  | "battery"
  | "bolt"
  | "calendar"
  | "check"
  | "todo"
  | "note"
  | "pin"
  | "plus"
  | "close"
  | "trash"
  | "refresh"
  | "settings"
  | "grid"
  | "spark"
  | "history"
  | "shield"
  | "search"
  | "undo"
  | "warning"
  | "lock"
  | "progress"
  | "power"
  | "chevron"
  | "dock"
  | "location"
  | "apps"
  | "volume"
  | "volume-low"
  | "volume-mute"
  | "bell"
  | "wifi"
  | "desktop"
  | "moon"
  | "restart"
  | "signout"
  | "window"
  | "windows"
  | "import"
  | "arrow-up"
  | "arrow-down"
  | WeatherKind;

const paths: Record<IconName, string> = {
  start: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  play: "M8 5.5v13l10-6.5z",
  pause: "M8 5h3v14H8zM13 5h3v14h-3z",
  next: "M6 6l8 6-8 6zM16 6h2v12h-2z",
  previous: "M18 6l-8 6 8 6zM6 6h2v12H6z",
  music: "M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z",
  focus: "M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 11a1 1 0 1 0 1 1",
  cpu: "M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4",
  battery: "M3 8h15v8H3zM20 11v2",
  bolt: "M13 3L5 14h6l-1 7 8-11h-6z",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  check: "M5 12.5l4.5 4.5L19 7.5",
  todo: "M4 6h2M4 12h2M4 18h2M9 6h11M9 12h11M9 18h11",
  note: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5",
  pin: "M9 4h6l-1 6 3 3H7l3-3zM12 13v7",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6L6 18",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7",
  settings:
    "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 15H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.7 4.4V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z",
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  spark: "M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z",
  history: "M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5M12 8v4l3 2",
  shield: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  undo: "M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2",
  warning: "M12 4l9 16H3zM12 10v4M12 17v.5",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 1 1 8 0v3",
  progress: "M4 12h16M4 12a8 8 0 0 1 16 0",
  power: "M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0",
  chevron: "M9 6l6 6-6 6",
  dock: "M3 15h18v5H3zM7 17.5h2M11 17.5h2M15 17.5h2M8 4h8v8H8z",
  location: "M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11zM12 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  apps: "M5 5h4v4H5zM10 5h4v4h-4zM15 5h4v4h-4zM5 10h4v4H5zM10 10h4v4h-4zM15 10h4v4h-4zM5 15h4v4H5zM10 15h4v4h-4zM15 15h4v4h-4z",
  volume: "M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11",
  "volume-low": "M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6",
  "volume-mute": "M4 9h4l5-4v14l-5-4H4zM16 9.5l5 5M21 9.5l-5 5",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0",
  wifi: "M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01",
  desktop: "M3 4h18v12H3zM8 20h8M12 16v4",
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
  restart: "M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5",
  signout: "M10 4H5v16h5M15 8l4 4-4 4M19 12H9",
  window: "M3 5h18v14H3zM3 9h18",
  windows: "M3 5.5l7.5-1v7H3zM12 4.3L21 3v8.5h-9zM3 12.5h7.5v7L3 18.5zM12 12.5h9V21l-9-1.3z",
  import: "M12 4v11M7 10l5 5 5-5M5 20h14",
  "arrow-up": "M12 19V5M6 11l6-6 6 6",
  "arrow-down": "M12 5v14M6 13l6 6 6-6",
  clear: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  partly: "M8 4v1.5M3.5 8.5H5M4.8 5.3l1 1M11.2 5.3l-1 1M6 10a3 3 0 0 1 5.6-1.5M8 20h9a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.3 3.3 0 0 0 8 20z",
  cloudy: "M7 19h10a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.4 1.6A3.8 3.8 0 0 0 7 19z",
  fog: "M4 10h16M6 14h12M4 18h16M7 6h10",
  drizzle: "M7 15h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.5 1.4A3.3 3.3 0 0 0 7 15zM9 18v1M13 18v1M17 18v1",
  rain: "M7 14h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.5 1.4A3.3 3.3 0 0 0 7 14zM9 17l-1 3M13 17l-1 3M17 17l-1 3",
  snow: "M7 14h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.5 1.4A3.3 3.3 0 0 0 7 14zM9 18h.01M13 18h.01M17 18h.01M11 21h.01M15 21h.01",
  storm: "M7 14h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.5 1.4A3.3 3.3 0 0 0 7 14zM13 14l-2 4h3l-2 4",
};

const filled = new Set<IconName>(["play", "pause", "next", "previous", "bolt", "windows"]);

export function Icon({ name, size = 18, label }: { name: IconName; size?: number; label?: string }) {
  const fill = filled.has(name);
  return (
    <svg
      className="od-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? "currentColor" : "none"}
      stroke={fill ? "none" : "currentColor"}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={paths[name]} />
    </svg>
  );
}
