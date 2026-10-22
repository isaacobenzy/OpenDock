import type { IconName } from "./icons";

/** Dock styles, in the same order as the desktop style picker. */
export type StudioSkin = "glass" | "solid" | "midnight" | "minimal" | "neon" | "ink";

export type StudioApp = {
  id: string;
  name: string;
  icon: IconName;
  tone: 1 | 2 | 3 | 4 | 5 | 6;
};

export type StudioSkinOption = {
  id: StudioSkin;
  label: string;
  description: string;
};

export type StudioWidget = {
  id: string;
  label: string;
  /** Shown when the playground first loads. */
  initial: boolean;
};

export const studioApps: readonly StudioApp[] = [
  { id: "files", name: "Files", icon: "folder", tone: 3 },
  { id: "browser", name: "Browser", icon: "globe", tone: 1 },
  { id: "notes", name: "Notes", icon: "note", tone: 4 },
  { id: "music", name: "Music", icon: "music", tone: 6 },
  { id: "mail", name: "Mail", icon: "mail", tone: 5 },
  { id: "terminal", name: "Terminal", icon: "terminal", tone: 2 },
];

export const dockSkins: readonly StudioSkinOption[] = [
  { id: "glass", label: "Glass", description: "Frosted and see-through" },
  { id: "solid", label: "Solid", description: "Opaque, in the theme's colours" },
  { id: "midnight", label: "Midnight", description: "Deep gradient with an accent edge" },
  { id: "minimal", label: "Minimal", description: "No bar, so items float on the wallpaper" },
  { id: "neon", label: "Neon", description: "Dark with a glowing accent outline" },
  { id: "ink", label: "Ink", description: "Opaque and high contrast" },
];

export const studioWidgets: readonly StudioWidget[] = [
  { id: "media", label: "Now playing", initial: true },
  { id: "weather", label: "Weather", initial: true },
  { id: "system", label: "System", initial: true },
  { id: "focus", label: "Focus", initial: false },
  { id: "volume", label: "Volume", initial: true },
  { id: "clock", label: "Clock", initial: true },
];

/** Case-insensitive name match. An empty query returns every app. */
export function filterApps(apps: readonly StudioApp[], query: string): StudioApp[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...apps];
  return apps.filter((app) => app.name.toLowerCase().includes(needle));
}

/**
 * Click an app to bring its window forward. Click the front app again to minimise it.
 * Returns the id that should be in front, or null when the desktop is clear.
 */
export function nextFrontApp(front: string | null, clicked: string): string | null {
  return front === clicked ? null : clicked;
}
