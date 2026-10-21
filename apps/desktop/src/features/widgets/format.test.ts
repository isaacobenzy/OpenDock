import { describe, expect, it } from "vitest";
import type { CalendarEvent, FocusState } from "../../services/ipc";
import { pushSample } from "../../services/loadable";
import {
  dayProgress,
  focusProgress,
  formatAgo,
  formatCountdown,
  formatRelative,
  formatTemperature,
  groupEventsByDay,
  monthGrid,
  nextEvent,
  weatherKind,
} from "./format";

const event = (title: string, startsAt: number, endsAt: number, allDay = false): CalendarEvent => ({
  calendarId: 1,
  calendarName: "Work",
  color: "",
  uid: title,
  title,
  location: "",
  startsAt,
  endsAt,
  allDay,
});

describe("time formatting", () => {
  it("formats countdowns", () => {
    expect(formatCountdown(25 * 60_000)).toBe("25:00");
    expect(formatCountdown(61_500)).toBe("1:02");
    expect(formatCountdown(-5)).toBe("0:00");
  });

  it("formats relative times", () => {
    const now = 1_000_000_000_000;
    expect(formatRelative(now - 1, now)).toBe("now");
    expect(formatRelative(now + 5 * 60_000, now)).toBe("in 5 min");
    expect(formatRelative(now + 120 * 60_000, now)).toBe("in 2 h");
    expect(formatRelative(now + 130 * 60_000, now)).toBe("in 2 h 10 min");
    expect(formatRelative(now + 3 * 86_400_000, now)).toBe("in 3 days");
    expect(formatAgo(now - 10_000, now)).toBe("just now");
    expect(formatAgo(now - 30 * 60_000, now)).toBe("30 min ago");
  });
});

describe("weather", () => {
  it("maps WMO codes", () => {
    expect(weatherKind(0)).toBe("clear");
    expect(weatherKind(2)).toBe("partly");
    expect(weatherKind(45)).toBe("fog");
    expect(weatherKind(63)).toBe("rain");
    expect(weatherKind(81)).toBe("rain");
    expect(weatherKind(73)).toBe("snow");
    expect(weatherKind(95)).toBe("storm");
  });

  it("formats temperatures", () => {
    expect(formatTemperature(21.6, "c")).toBe("22°");
    expect(formatTemperature(70.2, "f")).toBe("70°F");
  });
});

describe("focus and progress", () => {
  it("computes focus progress", () => {
    const focus: FocusState = {
      phase: "focus",
      startedAt: 0,
      endsAt: 100,
      plannedMinutes: 25,
      todayMinutes: 0,
      history: [],
    };
    expect(focusProgress(focus, 50)).toBe(0.5);
    expect(focusProgress(focus, 500)).toBe(1);
    expect(focusProgress({ ...focus, phase: "idle" }, 50)).toBe(0);
  });

  it("computes day progress", () => {
    const p = dayProgress(new Date(2026, 0, 1, 12, 0, 0));
    expect(p.day).toBeCloseTo(0.5);
    expect(p.year).toBeGreaterThan(0);
    expect(p.year).toBeLessThan(0.01);
  });

  it("keeps a bounded sample history", () => {
    let history: number[] = [];
    for (let i = 0; i < 40; i += 1) history = pushSample(history, i);
    expect(history).toHaveLength(30);
    expect(history[29]).toBe(39);
    expect(pushSample(history, null)).toBe(history);
  });
});

describe("calendar helpers", () => {
  it("picks the next timed event", () => {
    const now = new Date(2026, 9, 21, 9, 0).getTime();
    const list = [
      event("All day", now - 3_600_000, now + 20 * 3_600_000, true),
      event("Past", now - 7_200_000, now - 3_600_000),
      event("Standup", now + 600_000, now + 1_200_000),
    ];
    expect(nextEvent(list, now)?.title).toBe("Standup");
  });

  it("groups events into today and tomorrow", () => {
    const now = new Date(2026, 9, 21, 9, 0).getTime();
    const tomorrow = new Date(2026, 9, 22, 10, 0).getTime();
    const groups = groupEventsByDay(
      [event("Standup", now + 600_000, now + 1_200_000), event("Review", tomorrow, tomorrow + 3_600_000)],
      now,
    );
    expect(groups.map((g) => g.label)).toEqual(["Today", "Tomorrow"]);
  });

  it("builds Monday-first month grids", () => {
    const weeks = monthGrid(2026, 9);
    // 1 October 2026 is a Thursday.
    expect(weeks[0].slice(0, 4)).toEqual([null, null, null, 1]);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter((d) => d !== null)).toHaveLength(31);
  });
});
