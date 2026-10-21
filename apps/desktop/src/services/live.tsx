import { useEffect, useState, type ReactNode } from "react";
import {
  errorText,
  getFocusState,
  getMediaState,
  getSystemStats,
  getVolume,
  getWeather,
  listNotes,
  listTodos,
  listWindows,
  on,
  upcomingEvents,
  type CalendarEvent,
  type FocusState,
  type MediaState,
  type Note,
  type SystemStats,
  type Todo,
  type VolumeState,
  type WeatherSnapshot,
  type WindowsSnapshot,
} from "./ipc";
import { LiveContext } from "./liveContext";
import { failed, loading, pushSample, ready, type Loadable } from "./loadable";

function load<T>(fetch: () => Promise<T>, set: (value: Loadable<T>) => void): void {
  fetch()
    .then((data) => set(ready(data)))
    .catch((error) => set(failed(errorText(error))));
}

/** Loads every widget's data once and keeps it current from backend events. */
export function LiveDataProvider({ children }: { children: ReactNode }) {
  const [media, setMedia] = useState<Loadable<MediaState>>(loading);
  const [stats, setStats] = useState<Loadable<SystemStats | null>>(loading);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memoryHistory, setMemoryHistory] = useState<number[]>([]);
  const [focus, setFocus] = useState<Loadable<FocusState>>(loading);
  const [weather, setWeather] = useState<Loadable<WeatherSnapshot | null>>(loading);
  const [todos, setTodos] = useState<Loadable<Todo[]>>(loading);
  const [notes, setNotes] = useState<Loadable<Note[]>>(loading);
  const [events, setEvents] = useState<Loadable<CalendarEvent[]>>(loading);
  const [windows, setWindows] = useState<Loadable<WindowsSnapshot>>(loading);
  const [volume, setVolume] = useState<Loadable<VolumeState | null>>(loading);

  useEffect(() => {
    load(listWindows, setWindows);
    load(getVolume, setVolume);
    load(getMediaState, setMedia);
    load(getSystemStats, setStats);
    load(getFocusState, setFocus);
    load(getWeather, setWeather);
    load(listTodos, setTodos);
    load(listNotes, setNotes);
    load(() => upcomingEvents(72), setEvents);

    const offs = [
      on("media:state", (m) => setMedia(ready(m))),
      on("system:stats", (s) => {
        setStats(ready(s));
        setCpuHistory((h) => pushSample(h, s.cpu));
        setMemoryHistory((h) => pushSample(h, s.memory));
      }),
      on("focus:state", (f) => setFocus(ready(f))),
      on("weather:update", (w) => setWeather(ready(w))),
      on("windows:changed", (w) => setWindows(ready(w))),
      on("volume:state", (v) => setVolume(ready(v))),
      on("data:changed", (topic) => {
        if (topic === "todos") load(listTodos, setTodos);
        if (topic === "notes") load(listNotes, setNotes);
        if (topic === "calendar") load(() => upcomingEvents(72), setEvents);
      }),
    ];
    // Countdowns and "in 5 min" labels need a fresh list as time passes.
    const timer = window.setInterval(() => load(() => upcomingEvents(72), setEvents), 5 * 60_000);
    return () => {
      offs.forEach((off) => off());
      window.clearInterval(timer);
    };
  }, []);

  return (
    <LiveContext.Provider
      value={{ media, stats, cpuHistory, memoryHistory, focus, weather, todos, notes, events, windows, volume }}
    >
      {children}
    </LiveContext.Provider>
  );
}
