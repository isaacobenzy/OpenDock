import type { AppSettings } from "@opendock/config-schema";
import { useEffect, useState } from "react";
import {
  errorText,
  getTaskbarStatus,
  quitApp,
  searchCity,
  setLaunchAtStartup,
  type CityResult,
  type TaskbarStatus,
} from "../../services/ipc";
import { useSettings } from "../../services/settingsContext";
import { StylePicker } from "../dock/StylePicker";
import { Icon } from "../widgets/icons";
import { Choice, Row, TaskbarOptions, Toggle } from "./controls";
import { PageHeader } from "./PageHeader";

function NumberSetting({
  label,
  value,
  min,
  max,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setText(String(value));
  }
  const commit = () => {
    const n = Math.round(Number(text));
    if (Number.isFinite(n) && n >= min && n <= max) onCommit(n);
    else setText(String(value));
  };
  return (
    <span className="number-setting">
      <input
        className="text-input narrow"
        type="number"
        aria-label={label}
        min={min}
        max={max}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
      <span className="muted">min</span>
    </span>
  );
}

function TaskbarSection({ settings, change }: { settings: AppSettings; change: (fn: (s: AppSettings) => AppSettings) => void }) {
  const [status, setStatus] = useState<TaskbarStatus | null>(null);
  useEffect(() => {
    const load = () => void getTaskbarStatus().then(setStatus).catch(() => undefined);
    load();
    const timer = window.setInterval(load, 3000);
    return () => window.clearInterval(timer);
  }, [settings.taskbar.mode]);

  const supported = status?.supported ?? true;
  return (
    <section className="settings-card">
      <h2>Windows taskbar</h2>
      <p className="muted small">
        OpenDock remembers how your taskbar was set up and puts it back when it quits, crashes, or next starts.
      </p>
      {!supported ? (
        <p className="callout is-warn">Taskbar control isn't available on this system.</p>
      ) : (
        <TaskbarOptions value={settings.taskbar.mode} onChange={(mode) => change((s) => ({ ...s, taskbar: { mode } }))} />
      )}
      {status && supported ? (
        <p className="muted small">
          Right now: {status.visible === false ? "hidden" : status.autohide ? "auto-hiding" : "showing"}
          {status.originalAutohide !== null
            ? ` · it was ${status.originalAutohide ? "auto-hiding" : "always shown"} before OpenDock changed it`
            : ""}
        </p>
      ) : null}
    </section>
  );
}

function WeatherSection({ settings, change }: { settings: AppSettings; change: (fn: (s: AppSettings) => AppSettings) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CityResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      searchCity(q)
        .then((r) => {
          if (cancelled) return;
          setResults(r);
          setError(null);
        })
        .catch((e) => !cancelled && setError(errorText(e)))
        .finally(() => !cancelled && setSearching(false));
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const weather = settings.widgets.weather;
  return (
    <section className="settings-card">
      <h2>Weather</h2>
      <Row
        label="City"
        hint={weather.city ? `Showing ${weather.city}` : "Search sends only what you type to geocoding-api.open-meteo.com."}
      >
        <div className="city-search">
          <div className="search-field">
            <Icon name="search" size={14} />
            <input
              type="search"
              aria-label="Search for a city"
              placeholder={weather.city || "Search for a city"}
              value={query}
              maxLength={100}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {searching ? <p className="muted small">Searching…</p> : null}
          {error ? <p className="small text-warn">{error}</p> : null}
          {results.length > 0 ? (
            <ul className="city-results" role="listbox" aria-label="Cities">
              {results.map((city) => (
                <li key={`${city.latitude},${city.longitude}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => {
                      change((s) => ({
                        ...s,
                        widgets: {
                          ...s.widgets,
                          weather: { ...s.widgets.weather, city: city.name, latitude: city.latitude, longitude: city.longitude },
                        },
                      }));
                      setQuery("");
                      setResults([]);
                    }}
                  >
                    <Icon name="location" size={14} />
                    <span>{city.name}</span>
                    <span className="muted small">{[city.region, city.country].filter(Boolean).join(", ")}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Row>
      <Row label="Units">
        <Choice
          label="Units"
          value={weather.unit}
          options={[
            { value: "c", label: "°C" },
            { value: "f", label: "°F" },
          ]}
          onChange={(unit) => change((s) => ({ ...s, widgets: { ...s.widgets, weather: { ...s.widgets.weather, unit } } }))}
        />
      </Row>
    </section>
  );
}

export function DockSettingsPage() {
  const { settings, update } = useSettings();
  const [error, setError] = useState<string | null>(null);
  const change = (fn: (s: AppSettings) => AppSettings) => void update(fn).then(setError);
  const dock = settings.dock;
  const setDock = (patch: Partial<AppSettings["dock"]>) => change((s) => ({ ...s, dock: { ...s.dock, ...patch } }));

  return (
    <div className="page settings-page">
      <PageHeader title="Dock settings" subtitle="Changes apply straight away." />
      {error ? <p className="callout is-error" role="alert">{error}</p> : null}

      <section className="settings-card">
        <h2>Appearance</h2>
        <Row label="Style">
          <StylePicker value={dock.style} onChange={(style) => setDock({ style })} />
        </Row>
        <Row label="Theme">
          <Choice
            label="Theme"
            value={dock.theme}
            options={[
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
            ]}
            onChange={(theme) => setDock({ theme })}
          />
        </Row>
        <Row label="Size">
          <Choice
            label="Size"
            value={dock.size}
            options={[
              { value: "s", label: "Small" },
              { value: "m", label: "Medium" },
              { value: "l", label: "Large" },
            ]}
            onChange={(size) => setDock({ size })}
          />
        </Row>
        <Row label="Position">
          <Choice
            label="Position"
            value={dock.position}
            options={[
              { value: "bottom", label: "Bottom" },
              { value: "top", label: "Top" },
              { value: "left", label: "Left" },
              { value: "right", label: "Right" },
            ]}
            onChange={(position) => setDock({ position })}
          />
        </Row>
        <Row label="Shape" hint="A pill hugs your widgets; full width spans the screen edge.">
          <Choice
            label="Shape"
            value={dock.mode}
            options={[
              { value: "pill", label: "Pill" },
              { value: "full", label: "Full width" },
            ]}
            onChange={(mode) => setDock({ mode })}
          />
        </Row>
        <Row label="24-hour clock">
          <Toggle label="24-hour clock" checked={dock.clock24h} onChange={(clock24h) => setDock({ clock24h })} />
        </Row>
      </section>

      <TaskbarSection settings={settings} change={change} />

      <section className="settings-card">
        <h2>Behaviour</h2>
        <Row label="Start button" hint="OpenDock's launcher searches apps and has power options; Windows Start opens the usual menu.">
          <Choice
            label="Start button"
            value={dock.startAction}
            options={[
              { value: "launcher", label: "OpenDock launcher" },
              { value: "windows", label: "Windows Start" },
            ]}
            onChange={(startAction) => setDock({ startAction })}
          />
        </Row>
        <Row label="Hide during fullscreen apps" hint="Games, videos and presentations get the whole screen.">
          <Toggle
            label="Hide during fullscreen apps"
            checked={dock.autoHideInFullscreen}
            onChange={(autoHideInFullscreen) => setDock({ autoHideInFullscreen })}
          />
        </Row>
        <Row label="Start with Windows">
          <Toggle
            label="Start with Windows"
            checked={dock.launchAtStartup}
            onChange={(enabled) => void setLaunchAtStartup(enabled).catch((e) => setError(errorText(e)))}
          />
        </Row>
      </section>

      <WeatherSection settings={settings} change={change} />

      <section className="settings-card">
        <h2>Focus timer</h2>
        <Row label="Focus length">
          <NumberSetting
            label="Focus length in minutes"
            value={settings.widgets.focus.focusMinutes}
            min={1}
            max={180}
            onCommit={(focusMinutes) => change((s) => ({ ...s, widgets: { ...s.widgets, focus: { ...s.widgets.focus, focusMinutes } } }))}
          />
        </Row>
        <Row label="Break length">
          <NumberSetting
            label="Break length in minutes"
            value={settings.widgets.focus.breakMinutes}
            min={1}
            max={60}
            onCommit={(breakMinutes) => change((s) => ({ ...s, widgets: { ...s.widgets, focus: { ...s.widgets.focus, breakMinutes } } }))}
          />
        </Row>
      </section>

      <section className="settings-card">
        <h2>Quiet hours</h2>
        <Row label="Quiet hours" hint="Rules with the “Quiet hours” exception stay silent during this window.">
          <Toggle
            label="Quiet hours"
            checked={settings.automation.quietHours.enabled}
            onChange={(enabled) =>
              change((s) => ({ ...s, automation: { ...s.automation, quietHours: { ...s.automation.quietHours, enabled } } }))
            }
          />
        </Row>
        <Row label="From – to">
          <span className="time-range">
            <input
              className="text-input narrow"
              type="time"
              aria-label="Quiet hours start"
              value={settings.automation.quietHours.start}
              onChange={(e) =>
                e.target.value &&
                change((s) => ({ ...s, automation: { ...s.automation, quietHours: { ...s.automation.quietHours, start: e.target.value } } }))
              }
            />
            <span className="muted">to</span>
            <input
              className="text-input narrow"
              type="time"
              aria-label="Quiet hours end"
              value={settings.automation.quietHours.end}
              onChange={(e) =>
                e.target.value &&
                change((s) => ({ ...s, automation: { ...s.automation, quietHours: { ...s.automation.quietHours, end: e.target.value } } }))
              }
            />
          </span>
        </Row>
      </section>

      <section className="settings-card">
        <h2>OpenDock</h2>
        <Row label="Quit" hint="Closes the dock and restores the taskbar.">
          <button type="button" className="button is-danger" onClick={() => void quitApp()}>
            <Icon name="power" size={14} /> Quit OpenDock
          </button>
        </Row>
      </section>
    </div>
  );
}
