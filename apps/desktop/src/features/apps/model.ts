import type { PinnedApp } from "@opendock/config-schema";
import type { AppWindow, ShellApp, WindowsSnapshot } from "../../services/ipc";

/** One icon on the dock's app strip: a pinned app, a running app, or both. */
export type AppEntry = {
  key: string;
  name: string;
  /** File whose icon represents the entry. */
  iconPath: string;
  /** What to start for a new window, if anything. */
  launchPath: string | null;
  pinned: boolean;
  /** The pin's own path, for unpinning. */
  pinPath: string | null;
  windows: AppWindow[];
  active: boolean;
};

export function pinKey(pin: Pick<PinnedApp, "path" | "target">): string {
  return (pin.target ?? pin.path).toLowerCase();
}

function fromPin(pin: PinnedApp): AppEntry {
  return {
    key: pinKey(pin),
    name: pin.name,
    iconPath: pin.path,
    launchPath: pin.path,
    pinned: true,
    pinPath: pin.path,
    windows: [],
    active: false,
  };
}

function fromWindow(window: AppWindow, pin: PinnedApp | null, ownKey: boolean): AppEntry {
  return {
    key: ownKey ? `${window.appId}#${window.id}` : window.appId,
    name: pin?.name ?? window.appName,
    iconPath: pin?.path ?? window.exe,
    launchPath: pin?.path ?? (window.exe || null),
    pinned: pin !== null,
    pinPath: pin?.path ?? null,
    windows: [window],
    active: false,
  };
}

/**
 * Pinned apps first in their pinned order, then running apps in the order they opened.
 * With `group`, an app's windows share one entry; otherwise every window gets its own.
 */
export function buildAppEntries(pinned: PinnedApp[], snapshot: WindowsSnapshot, group: boolean): AppEntry[] {
  const pinFor = (window: AppWindow) => pinned.find((p) => pinKey(p) === window.appId) ?? null;
  let entries: AppEntry[];

  if (group) {
    entries = pinned.map(fromPin);
    for (const window of snapshot.windows) {
      const existing = entries.find((e) => e.key === window.appId);
      if (existing) existing.windows.push(window);
      else entries.push(fromWindow(window, null, false));
    }
  } else {
    entries = [];
    for (const pin of pinned) {
      const windows = snapshot.windows.filter((w) => w.appId === pinKey(pin));
      if (windows.length === 0) entries.push(fromPin(pin));
      else windows.forEach((w) => entries.push(fromWindow(w, pin, true)));
    }
    for (const window of snapshot.windows) {
      if (!pinFor(window)) entries.push(fromWindow(window, null, true));
    }
  }

  return entries.map((e) => ({ ...e, active: e.windows.some((w) => w.id === snapshot.active) }));
}

export type AppClick =
  | { kind: "launch"; path: string }
  | { kind: "activate"; id: number }
  | { kind: "minimize"; id: number }
  | { kind: "preview" }
  | { kind: "none" };

/** Like the Windows taskbar: start it, bring it forward, tuck it away, or pick a window. */
export function decideAppClick(entry: AppEntry, active: number | null): AppClick {
  if (entry.windows.length === 0) {
    return entry.launchPath ? { kind: "launch", path: entry.launchPath } : { kind: "none" };
  }
  if (entry.windows.length === 1) {
    const [window] = entry.windows;
    return window.id === active && !window.minimized
      ? { kind: "minimize", id: window.id }
      : { kind: "activate", id: window.id };
  }
  return { kind: "preview" };
}

export function findEntry(entries: AppEntry[], key: string | null | undefined): AppEntry | undefined {
  return key ? entries.find((e) => e.key === key) : undefined;
}

/** Launcher search: name prefix beats word prefix beats anywhere in the name. */
export function rankApps(apps: ShellApp[], query: string, limit = 50): ShellApp[] {
  const q = query.trim().toLowerCase();
  if (!q) return apps.slice(0, limit);
  const scored: { app: ShellApp; score: number }[] = [];
  for (const app of apps) {
    const name = app.name.toLowerCase();
    let score = -1;
    if (name.startsWith(q)) score = 3;
    else if (name.split(/[\s\-_.]+/).some((word) => word.startsWith(q))) score = 2;
    else if (name.includes(q)) score = 1;
    else {
      const initials = name
        .split(/[\s\-_.]+/)
        .map((word) => word[0] ?? "")
        .join("");
      if (q.length > 1 && initials.startsWith(q)) score = 1;
    }
    if (score >= 0) scored.push({ app, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.app.name.localeCompare(b.app.name))
    .slice(0, limit)
    .map((s) => s.app);
}

export function toPinned(app: ShellApp): PinnedApp {
  return { name: app.name.slice(0, 120), path: app.path, target: app.target };
}

export function isPinned(pinned: PinnedApp[], path: string): boolean {
  const key = path.toLowerCase();
  return pinned.some((p) => p.path.toLowerCase() === key);
}

/** A stable tint for apps without an icon, picked from the design tokens. */
export function monogramTone(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 6;
}
