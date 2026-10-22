import type { IconName } from "./icons";

/** Generic demo content for product mockups. Never use real people, files or brands here. */

export type Tone = 1 | 2 | 3 | 4 | 5 | 6;

export type DemoApp = {
  name: string;
  icon: IconName;
  tone: Tone;
  state: "active" | "running" | "pinned";
  windows?: number;
  /** Id of the flyout panel this app opens in the interactive hero. */
  flyout?: string;
};

export type DockItem = { narrow?: "hide" } & (
  | { kind: "start"; flyout?: string }
  | { kind: "divider" }
  | { kind: "app"; app: DemoApp }
  | { kind: "media"; title: string; artist: string }
  | { kind: "weather"; temperature: number; condition: "sun" | "cloud" }
  | { kind: "system"; cpu: number }
  | { kind: "focus"; remaining: string; percent: number }
  | { kind: "calendar"; title: string; when: string }
  | { kind: "todos"; left: number }
  | { kind: "battery"; percent: number }
  | { kind: "progress"; percent: number }
  | { kind: "volume" }
  | { kind: "quick" }
  | { kind: "clock"; time: string; date: string; flyout?: string }
);

export type DockLayout = {
  id: string;
  name: string;
  summary: string;
  style: "pill" | "bar";
  skin: "glass" | "solid" | "midnight" | "minimal" | "neon" | "ink";
  items: DockItem[];
};

const files: DemoApp = { name: "Files", icon: "folder", tone: 3, state: "running" };
const browser: DemoApp = { name: "Browser", icon: "globe", tone: 1, state: "running", windows: 3 };
const code: DemoApp = { name: "Code", icon: "code", tone: 4, state: "active", windows: 2 };
const terminal: DemoApp = { name: "Terminal", icon: "terminal", tone: 2, state: "running" };
const mail: DemoApp = { name: "Mail", icon: "mail", tone: 5, state: "pinned" };
const music: DemoApp = { name: "Music", icon: "music", tone: 6, state: "running" };
const design: DemoApp = { name: "Design", icon: "palette", tone: 5, state: "active" };

export const heroDock: DockItem[] = [
  { kind: "start", flyout: "flyout-start" },
  { kind: "divider" },
  { kind: "app", app: files },
  { kind: "app", app: browser },
  { kind: "app", app: { ...code, flyout: "flyout-apps" } },
  { kind: "app", app: terminal, narrow: "hide" },
  { kind: "app", app: mail, narrow: "hide" },
  { kind: "app", app: music, narrow: "hide" },
  { kind: "divider" },
  { kind: "media", title: "Morning Light", artist: "Field Recordings", narrow: "hide" },
  { kind: "weather", temperature: 18, condition: "sun", narrow: "hide" },
  { kind: "system", cpu: 23, narrow: "hide" },
  { kind: "volume" },
  { kind: "quick", narrow: "hide" },
  { kind: "clock", time: "09:41", date: "Wed 21 Oct", flyout: "flyout-clock" },
];

export const exampleLayouts: DockLayout[] = [
  {
    id: "taskbar",
    name: "Taskbar replacement",
    summary:
      "The default after setup: Start, your apps and the essentials, in a full-width bar that reserves the bottom edge like the taskbar did.",
    style: "bar",
    skin: "solid",
    items: [
      { kind: "start" },
      { kind: "divider" },
      { kind: "app", app: files },
      { kind: "app", app: { ...browser, state: "active" } },
      { kind: "app", app: { ...mail, state: "running" } },
      { kind: "app", app: { ...music, state: "pinned" } },
      { kind: "divider" },
      { kind: "volume" },
      { kind: "quick" },
      { kind: "battery", percent: 82 },
      { kind: "clock", time: "14:05", date: "Thu 22 Oct" },
    ],
  },
  {
    id: "maker",
    name: "Deep work",
    summary:
      "A focus timer, todos and your next meeting next to the tools you build with. Pair it with the Pause music while focusing recipe.",
    style: "pill",
    skin: "glass",
    items: [
      { kind: "start" },
      { kind: "divider" },
      { kind: "app", app: code },
      { kind: "app", app: { ...terminal, state: "running" } },
      { kind: "app", app: browser },
      { kind: "divider" },
      { kind: "focus", remaining: "18:42", percent: 38 },
      { kind: "todos", left: 3 },
      { kind: "calendar", title: "Design review", when: "in 25 min" },
      { kind: "clock", time: "10:35", date: "Mon 26 Oct" },
    ],
  },
  {
    id: "studio",
    name: "Creative studio",
    summary:
      "Music and system load front and centre while you render, with the weather and how much of the day is left.",
    style: "pill",
    skin: "neon",
    items: [
      { kind: "start" },
      { kind: "divider" },
      { kind: "app", app: design },
      { kind: "app", app: { ...files, state: "running" } },
      { kind: "app", app: { ...music, state: "running" } },
      { kind: "divider" },
      { kind: "media", title: "Slow Tide", artist: "Harbour Lights" },
      { kind: "system", cpu: 67 },
      { kind: "weather", temperature: 12, condition: "cloud" },
      { kind: "progress", percent: 64 },
      { kind: "clock", time: "16:20", date: "Fri 23 Oct" },
    ],
  },
];

export const pinnedDemoApps: DemoApp[] = [files, browser, code, terminal, mail, music];
