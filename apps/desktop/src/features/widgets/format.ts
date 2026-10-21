import type { CalendarEvent, FocusState, WeatherSnapshot } from "../../services/ipc";

export function formatTime(date: Date, use24h: boolean): string {
  return date.toLocaleTimeString([], {
    hour: use24h ? "2-digit" : "numeric",
    minute: "2-digit",
    hour12: !use24h,
  });
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** "now", "in 5 min", "in 2 h 10 min", "in 3 days". */
export function formatRelative(target: number, now: number): string {
  const minutes = Math.round((target - now) / 60_000);
  if (minutes <= 0) return "now";
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest === 0 ? `in ${hours} h` : `in ${hours} h ${rest} min`;
  }
  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

export function formatAgo(at: number, now: number): string {
  const minutes = Math.round((now - at) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(at).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined ? "–" : `${Math.round(value)}%`;
}

export type WeatherKind = "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "storm";

/** WMO weather interpretation codes, as returned by Open-Meteo. */
export function weatherKind(code: number): WeatherKind {
  if (code === 0) return "clear";
  if (code <= 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "cloudy";
}

const weatherLabels: Record<WeatherKind, string> = {
  clear: "Clear",
  partly: "Partly cloudy",
  cloudy: "Cloudy",
  fog: "Fog",
  drizzle: "Drizzle",
  rain: "Rain",
  snow: "Snow",
  storm: "Thunderstorm",
};

export function weatherLabel(code: number): string {
  return weatherLabels[weatherKind(code)];
}

export function formatTemperature(value: number, unit: string): string {
  return `${Math.round(value)}°${unit === "f" ? "F" : ""}`;
}

export function nextHours(weather: WeatherSnapshot, now: number, count = 12) {
  return weather.hourly.filter((hour) => hour.time >= now - 30 * 60_000).slice(0, count);
}

export function focusProgress(focus: FocusState, now: number): number {
  if (focus.phase === "idle" || focus.startedAt === null || focus.endsAt === null) return 0;
  const span = focus.endsAt - focus.startedAt;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (now - focus.startedAt) / span));
}

export function focusRemaining(focus: FocusState, now: number): number {
  return focus.endsAt === null ? 0 : Math.max(0, focus.endsAt - now);
}

export type DayProgress = { day: number; week: number; month: number; year: number };

export function dayProgress(date: Date): DayProgress {
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (date.getTime() - startOfDay.getTime()) / 86_400_000;
  const weekday = (date.getDay() + 6) % 7;
  const week = (weekday + day) / 7;
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const month = (date.getDate() - 1 + day) / daysInMonth;
  const startOfYear = new Date(date.getFullYear(), 0, 1).getTime();
  const endOfYear = new Date(date.getFullYear() + 1, 0, 1).getTime();
  const year = (date.getTime() - startOfYear) / (endOfYear - startOfYear);
  return { day, week, month, year };
}

export function nextEvent(events: CalendarEvent[], now: number): CalendarEvent | undefined {
  return events.find((event) => event.endsAt > now && !event.allDay);
}

export type EventGroup = { label: string; events: CalendarEvent[] };

export function groupEventsByDay(events: CalendarEvent[], now: number): EventGroup[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const groups = new Map<number, CalendarEvent[]>();
  for (const event of events) {
    if (event.endsAt <= now) continue;
    const day = new Date(Math.max(event.startsAt, today.getTime()));
    day.setHours(0, 0, 0, 0);
    const key = day.getTime();
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([key, list]) => {
      const offset = Math.round((key - today.getTime()) / 86_400_000);
      const label =
        offset === 0
          ? "Today"
          : offset === 1
            ? "Tomorrow"
            : new Date(key).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
      return { label, events: list };
    });
}

/** Weeks of the month starting on Monday; `null` pads days outside the month. */
export function monthGrid(year: number, month: number): (number | null)[][] {
  const first = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: first }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function eventTimeRange(event: CalendarEvent, use24h: boolean): string {
  if (event.allDay) return "All day";
  return `${formatTime(new Date(event.startsAt), use24h)} – ${formatTime(new Date(event.endsAt), use24h)}`;
}
