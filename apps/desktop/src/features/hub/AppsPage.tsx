import { MAX_PINNED_APPS, movePinnedApp, pinApp, unpinApp, type AppSettings } from "@opendock/config-schema";
import { useEffect, useState } from "react";
import { errorText, listInstalledApps, listTaskbarPins, type ShellApp } from "../../services/ipc";
import { failed, loading, ready, type Loadable } from "../../services/loadable";
import { useSettings } from "../../services/settingsContext";
import { AppIcon } from "../apps/AppIcon";
import { isPinned, rankApps, toPinned } from "../apps/model";
import { Icon } from "../widgets/icons";
import { Row, TaskbarOptions, Toggle } from "./controls";
import { PageHeader } from "./PageHeader";

function AddApps({ settings, change }: { settings: AppSettings; change: (fn: (s: AppSettings) => AppSettings) => void }) {
  const [apps, setApps] = useState<Loadable<ShellApp[]>>(loading);
  const [query, setQuery] = useState("");

  useEffect(() => {
    listInstalledApps()
      .then((list) => setApps(ready(list)))
      .catch((e) => setApps(failed(errorText(e))));
  }, []);

  const pinned = settings.apps.pinned;
  const full = pinned.length >= MAX_PINNED_APPS;
  const results = apps.status === "ready" && query.trim() ? rankApps(apps.data, query, 8) : [];

  return (
    <div className="add-apps">
      <div className="search-field">
        <Icon name="search" size={14} />
        <input
          type="search"
          aria-label="Find an app to pin"
          placeholder={apps.status === "ready" ? `Search ${apps.data.length} apps to pin` : "Search apps to pin"}
          value={query}
          maxLength={80}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {apps.status === "loading" ? <p className="muted small">Finding your apps…</p> : null}
      {apps.status === "error" ? <p className="small text-warn">{apps.error}</p> : null}
      {query.trim() && apps.status === "ready" && results.length === 0 ? (
        <p className="muted small">Nothing matches “{query.trim()}”.</p>
      ) : null}
      {results.length > 0 ? (
        <ul className="pick-list">
          {results.map((app) => {
            const already = isPinned(pinned, app.path);
            return (
              <li key={app.path}>
                <AppIcon path={app.path} name={app.name} size={22} />
                <span className="pick-name">{app.name}</span>
                <button
                  type="button"
                  className="button is-small"
                  disabled={already || full}
                  onClick={() => change((s) => ({ ...s, apps: { ...s.apps, pinned: pinApp(s.apps.pinned, toPinned(app)) } }))}
                >
                  {already ? "Pinned" : "Pin"}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {full ? <p className="muted small">The dock holds up to {MAX_PINNED_APPS} pinned apps.</p> : null}
    </div>
  );
}

export function AppsPage() {
  const { settings, update } = useSettings();
  const [error, setError] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const change = (fn: (s: AppSettings) => AppSettings) => void update(fn).then(setError);
  const pinned = settings.apps.pinned;

  const importTaskbar = () => {
    setImportNote("Reading your Windows taskbar…");
    listTaskbarPins()
      .then((found) => {
        const fresh = found.filter((app) => !isPinned(pinned, app.path));
        if (fresh.length === 0) {
          setImportNote(found.length ? "Everything on your taskbar is already pinned." : "Your Windows taskbar has no pinned apps.");
          return;
        }
        change((s) => ({
          ...s,
          apps: { ...s.apps, pinned: fresh.reduce((list, app) => pinApp(list, toPinned(app)), s.apps.pinned) },
        }));
        setImportNote(`Pinned ${fresh.length} app${fresh.length === 1 ? "" : "s"} from your taskbar.`);
      })
      .catch((e) => setImportNote(errorText(e)));
  };

  return (
    <div className="page settings-page">
      <PageHeader
        title="Apps & taskbar"
        subtitle="Pin apps to the dock, choose how open windows appear, and decide what happens to the Windows taskbar."
        actions={
          <button type="button" className="button" onClick={importTaskbar}>
            <Icon name="import" size={14} /> Import from Windows taskbar
          </button>
        }
      />
      {error ? <p className="callout is-error" role="alert">{error}</p> : null}
      {importNote ? <p className="callout is-ok" role="status">{importNote}</p> : null}

      <section className="settings-card">
        <h2>Pinned apps</h2>
        <p className="muted small">
          Pinned apps stay on the dock when closed. A dot under an icon means it's running; click to switch, click again to minimise.
        </p>
        {pinned.length === 0 ? (
          <div className="empty-pins">
            <Icon name="apps" size={22} />
            <p>No pinned apps yet. Search below or import your taskbar.</p>
          </div>
        ) : (
          <ol className="pinned-list">
            {pinned.map((app, index) => (
              <li key={app.path}>
                <span className="pinned-index tabular">{index + 1}</span>
                <AppIcon path={app.path} name={app.name} size={24} />
                <span className="pinned-name">
                  {app.name}
                  <span className="muted small">{app.target ?? app.path}</span>
                </span>
                <span className="pinned-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Move ${app.name} earlier`}
                    disabled={index === 0}
                    onClick={() => change((s) => ({ ...s, apps: { ...s.apps, pinned: movePinnedApp(s.apps.pinned, app.path, -1) } }))}
                  >
                    <Icon name="arrow-up" size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Move ${app.name} later`}
                    disabled={index === pinned.length - 1}
                    onClick={() => change((s) => ({ ...s, apps: { ...s.apps, pinned: movePinnedApp(s.apps.pinned, app.path, 1) } }))}
                  >
                    <Icon name="arrow-down" size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-button tone-danger"
                    aria-label={`Unpin ${app.name}`}
                    onClick={() => change((s) => ({ ...s, apps: { ...s.apps, pinned: unpinApp(s.apps.pinned, app.path) } }))}
                  >
                    <Icon name="close" size={14} />
                  </button>
                </span>
              </li>
            ))}
          </ol>
        )}
        <AddApps settings={settings} change={change} />
      </section>

      <section className="settings-card">
        <h2>Open windows</h2>
        <Row label="Group windows by app" hint="One icon per app with a window count. Off gives every window its own icon.">
          <Toggle
            label="Group windows by app"
            checked={settings.apps.groupWindows}
            onChange={(groupWindows) => change((s) => ({ ...s, apps: { ...s.apps, groupWindows } }))}
          />
        </Row>
        <Row label="Show window titles" hint="Adds the window or app name next to its icon on a horizontal dock.">
          <Toggle
            label="Show window titles"
            checked={settings.apps.showTitles}
            onChange={(showTitles) => change((s) => ({ ...s, apps: { ...s.apps, showTitles } }))}
          />
        </Row>
        <ul className="tip-list muted small">
          <li>Right-click an app for live window previews, a new window, pinning and closing.</li>
          <li>Shift-click or middle-click opens another window.</li>
          <li>Scroll over the volume widget to change the volume; middle-click mutes.</li>
        </ul>
      </section>

      <section className="settings-card">
        <h2>Windows taskbar</h2>
        <p className="muted small">
          Replace mode hides the taskbar and reserves the dock's edge so maximised windows never sit under it. The taskbar
          comes back when OpenDock quits, crashes, or is uninstalled.
        </p>
        <TaskbarOptions value={settings.taskbar.mode} onChange={(mode) => change((s) => ({ ...s, taskbar: { mode } }))} />
      </section>
    </div>
  );
}
