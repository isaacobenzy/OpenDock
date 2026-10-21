import { createContext, useContext, useEffect, useState } from "react";
import type {
  CalendarEvent,
  FocusState,
  MediaState,
  Note,
  SystemStats,
  Todo,
  VolumeState,
  WeatherSnapshot,
  WindowsSnapshot,
} from "./ipc";
import { loading, type Loadable } from "./loadable";

export type LiveData = {
  media: Loadable<MediaState>;
  stats: Loadable<SystemStats | null>;
  cpuHistory: number[];
  memoryHistory: number[];
  focus: Loadable<FocusState>;
  weather: Loadable<WeatherSnapshot | null>;
  todos: Loadable<Todo[]>;
  notes: Loadable<Note[]>;
  events: Loadable<CalendarEvent[]>;
  windows: Loadable<WindowsSnapshot>;
  volume: Loadable<VolumeState | null>;
};

export const emptyLive: LiveData = {
  media: loading,
  stats: loading,
  cpuHistory: [],
  memoryHistory: [],
  focus: loading,
  weather: loading,
  todos: loading,
  notes: loading,
  events: loading,
  windows: loading,
  volume: loading,
};

export const LiveContext = createContext<LiveData>(emptyLive);

export function useLive(): LiveData {
  return useContext(LiveContext);
}

/** Re-renders every `intervalMs` and returns the current time. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
