import { DEFAULT_ITEM_ORDER, dockItemIdSchema, type DockSize } from "@opendock/config-schema";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type {
  CalendarEvent,
  FocusState,
  MediaState,
  Note,
  SystemStats,
  Todo,
  WeatherSnapshot,
  WindowsSnapshot,
} from "../../services/ipc";
import { emptyLive, LiveContext, type LiveData } from "../../services/liveContext";
import { failed, ready } from "../../services/loadable";
import { ADD_WIDGET_ID, findWidget, searchWidgets, widgetCatalog } from "./catalog";
import { TileContent } from "./tiles";

const now = Date.now();

const media: MediaState = {
  available: true,
  playing: true,
  title: "Midnight City",
  artist: "M83",
  album: "Hurry Up",
  app: "Spotify",
  canNext: true,
  canPrevious: true,
};
const stats: SystemStats = { cpu: 42, memory: 61, memoryUsedGb: 9.8, memoryTotalGb: 16, battery: { percent: 15, charging: false } };
const focus: FocusState = {
  phase: "focus",
  startedAt: now - 5 * 60_000,
  endsAt: now + 20 * 60_000,
  plannedMinutes: 25,
  todayMinutes: 50,
  history: [],
};
const weather: WeatherSnapshot = {
  city: "Accra",
  unit: "c",
  temperature: 29.4,
  apparentTemperature: 32,
  code: 2,
  isDay: true,
  windSpeed: 12,
  high: 31,
  low: 24,
  sunrise: null,
  sunset: null,
  hourly: [],
  daily: [],
  fetchedAt: now,
  stale: false,
  error: null,
};
const todos: Todo[] = [{ id: 1, title: "Ship the gallery", done: false, createdAt: now, completedAt: null }];
const notes: Note[] = [{ id: 1, body: "Pinned idea", pinned: true, createdAt: now, updatedAt: now }];
const events: CalendarEvent[] = [
  {
    calendarId: 1,
    calendarName: "Work",
    color: "var(--od-info)",
    uid: "a",
    title: "Standup",
    location: "",
    startsAt: now + 10 * 60_000,
    endsAt: now + 25 * 60_000,
    allDay: false,
  },
];

const windows: WindowsSnapshot = {
  windows: [
    { id: 11, title: "Inbox", appId: "c:\\mail.exe", exe: "C:\\mail.exe", appName: "Mail", minimized: false },
    { id: 12, title: "Draft", appId: "c:\\mail.exe", exe: "C:\\mail.exe", appName: "Mail", minimized: false },
    { id: 13, title: "Docs", appId: "c:\\code.exe", exe: "C:\\code.exe", appName: "Code", minimized: true },
  ],
  active: 11,
};

const readyLive: LiveData = {
  media: ready(media),
  stats: ready(stats),
  cpuHistory: [10, 20, 30],
  memoryHistory: [50, 55, 60],
  focus: ready(focus),
  weather: ready(weather),
  todos: ready(todos),
  notes: ready(notes),
  events: ready(events),
  windows: ready(windows),
  volume: ready({ level: 40, muted: false }),
};

const emptyData: LiveData = {
  media: ready({ ...media, available: false, title: "" }),
  stats: ready(null),
  cpuHistory: [],
  memoryHistory: [],
  focus: ready({ ...focus, phase: "idle", startedAt: null, endsAt: null, todayMinutes: 0 }),
  weather: ready(null),
  todos: ready([]),
  notes: ready([]),
  events: ready([]),
  windows: ready({ windows: [], active: null }),
  volume: ready(null),
};

const errorLive: LiveData = {
  media: failed("no session manager"),
  stats: failed("denied"),
  cpuHistory: [],
  memoryHistory: [],
  focus: failed("db locked"),
  weather: failed("offline"),
  todos: failed("db locked"),
  notes: failed("db locked"),
  events: failed("db locked"),
  windows: failed("enumeration failed"),
  volume: failed("no audio service"),
};

const states: [string, LiveData][] = [
  ["loading", emptyLive],
  ["empty", emptyData],
  ["error", errorLive],
  ["ready", readyLive],
];
const sizes: DockSize[] = ["s", "m", "l"];

afterEach(cleanup);

describe("widget catalog", () => {
  it("uses valid, unique dock ids and supports every size", () => {
    const ids = widgetCatalog.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const widget of widgetCatalog) {
      expect(dockItemIdSchema.safeParse(widget.id).success).toBe(true);
      expect(widget.sizes).toEqual(["s", "m", "l"]);
    }
  });

  it("covers every default dock item", () => {
    for (const id of DEFAULT_ITEM_ORDER) {
      if (id !== ADD_WIDGET_ID) expect(findWidget(id), id).toBeDefined();
    }
  });

  it("declares hosts for every widget that uses the network", () => {
    expect(findWidget("weather")?.network).toContain("api.open-meteo.com");
    expect(findWidget("todos")?.network).toEqual([]);
  });

  it("searches by name, description and category", () => {
    expect(searchWidgets("pomodoro", "All").map((w) => w.id)).toEqual(["focus"]);
    expect(searchWidgets("", "System").map((w) => w.id)).toEqual(["volume", "tray", "system", "battery"]);
    expect(searchWidgets("nothing-matches", "All")).toEqual([]);
  });
});

describe("dock tiles", () => {
  for (const widget of widgetCatalog) {
    for (const [state, live] of states) {
      it(`${widget.id} renders its ${state} state at every size`, () => {
        for (const size of sizes) {
          for (const compact of [false, true]) {
            const { container, unmount } = render(
              <LiveContext.Provider value={live}>
                <TileContent id={widget.id} size={size} compact={compact} />
              </LiveContext.Provider>,
            );
            const tile = container.querySelector(".tile");
            expect(tile, `${widget.id} ${state} ${size}`).not.toBeNull();
            expect(container.textContent).not.toContain("Unknown widget");
            unmount();
          }
        }
      });
    }
  }

  it("shows real data when ready", () => {
    const { getByText } = render(
      <LiveContext.Provider value={readyLive}>
        <TileContent id="media" size="m" compact={false} />
        <TileContent id="todos" size="m" compact={false} />
        <TileContent id="weather" size="m" compact={false} />
        <TileContent id="calendar" size="m" compact={false} />
      </LiveContext.Provider>,
    );
    expect(getByText("Midnight City")).toBeInTheDocument();
    expect(getByText("1 open")).toBeInTheDocument();
    expect(getByText("29°")).toBeInTheDocument();
    expect(getByText("Standup")).toBeInTheDocument();
  });

  it("marks empty and error states", () => {
    const empty = render(
      <LiveContext.Provider value={emptyData}>
        <TileContent id="media" size="m" compact={false} />
      </LiveContext.Provider>,
    );
    expect(empty.container.querySelector(".tile.is-empty")).not.toBeNull();
    expect(empty.getByText("Nothing playing")).toBeInTheDocument();
    empty.unmount();

    const error = render(
      <LiveContext.Provider value={errorLive}>
        <TileContent id="weather" size="m" compact={false} />
      </LiveContext.Provider>,
    );
    expect(error.container.querySelector(".tile.is-error")).not.toBeNull();
  });

  it("groups open windows by app and marks the active one", () => {
    const { container, getByLabelText } = render(
      <LiveContext.Provider value={readyLive}>
        <TileContent id="apps" size="m" compact={false} />
      </LiveContext.Provider>,
    );
    expect(container.querySelectorAll(".app-button")).toHaveLength(2);
    const mail = getByLabelText("Mail, 2 windows");
    expect(mail.className).toContain("is-active");
    expect(mail.querySelector(".app-count")?.textContent).toBe("2");
    expect(getByLabelText("Code: Docs").className).toContain("is-running");
  });

  it("shows the volume level", () => {
    const { getByText } = render(
      <LiveContext.Provider value={readyLive}>
        <TileContent id="volume" size="m" compact={false} />
      </LiveContext.Provider>,
    );
    expect(getByText("40%")).toBeInTheDocument();
  });

  it("warns when the battery is low", () => {
    const { container } = render(
      <LiveContext.Provider value={readyLive}>
        <TileContent id="battery" size="m" compact={false} />
      </LiveContext.Provider>,
    );
    expect(container.querySelector(".tile-battery.is-warn")).not.toBeNull();
  });
});
