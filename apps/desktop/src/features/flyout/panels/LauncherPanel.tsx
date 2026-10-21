import { pinApp, unpinApp } from "@opendock/config-schema";
import { useEffect, useRef, useState } from "react";
import {
  errorText,
  launchApp,
  listInstalledApps,
  openHub,
  openStartMenu,
  powerAction,
  type PowerAction,
  type ShellApp,
} from "../../../services/ipc";
import { failed, loading, ready, type Loadable } from "../../../services/loadable";
import { useSettings } from "../../../services/settingsContext";
import { AppIcon } from "../../apps/AppIcon";
import { isPinned, rankApps, toPinned } from "../../apps/model";
import { Icon, type IconName } from "../../widgets/icons";
import { PanelState } from "../../widgets/visuals";
import { IconButton } from "./PanelHeader";

const PAGE = 60;

const POWER: { action: PowerAction; icon: IconName; label: string; confirm: boolean }[] = [
  { action: "lock", icon: "lock", label: "Lock", confirm: false },
  { action: "sleep", icon: "moon", label: "Sleep", confirm: false },
  { action: "signOut", icon: "signout", label: "Sign out", confirm: true },
  { action: "restart", icon: "restart", label: "Restart", confirm: true },
  { action: "shutDown", icon: "power", label: "Shut down", confirm: true },
];

export function LauncherPanel({ onDone }: { onDone: () => void }) {
  const { settings, update } = useSettings();
  const [apps, setApps] = useState<Loadable<ShellApp[]>>(loading);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [shown, setShown] = useState(PAGE);
  const [confirm, setConfirm] = useState<PowerAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const pinned = settings.apps.pinned;

  useEffect(() => {
    listInstalledApps()
      .then((list) => setApps(ready(list)))
      .catch((e) => setApps(failed(errorText(e))));
  }, []);

  useEffect(() => {
    if (!confirm) return;
    const timer = window.setTimeout(() => setConfirm(null), 4000);
    return () => window.clearTimeout(timer);
  }, [confirm]);

  const results = apps.status === "ready" ? rankApps(apps.data, query, query ? 30 : apps.data.length) : [];
  const visible = query ? results : results.slice(0, shown);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${selected}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [selected]);

  const launch = (path: string) => {
    launchApp(path)
      .then(onDone)
      .catch((e) => setError(errorText(e)));
  };
  const togglePin = (app: ShellApp) => {
    void update((s) => ({
      ...s,
      apps: {
        ...s.apps,
        pinned: isPinned(s.apps.pinned, app.path) ? unpinApp(s.apps.pinned, app.path) : pinApp(s.apps.pinned, toPinned(app)),
      },
    })).then(setError);
  };
  const power = (item: (typeof POWER)[number]) => {
    if (item.confirm && confirm !== item.action) {
      setConfirm(item.action);
      return;
    }
    powerAction(item.action)
      .then(onDone)
      .catch((e) => setError(errorText(e)));
  };

  return (
    <div className="launcher">
      <div className="search-field launcher-search">
        <Icon name="search" size={15} />
        <input
          type="search"
          aria-label="Search apps"
          placeholder="Search apps"
          // The launcher exists to type into; focus goes straight to search.
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          value={query}
          maxLength={80}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelected((i) => Math.min(i + 1, visible.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelected((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && visible[selected]) {
              e.preventDefault();
              launch(visible[selected].path);
            }
          }}
        />
      </div>

      {!query && pinned.length > 0 ? (
        <section className="panel-section">
          <h2>Pinned</h2>
          <div className="pin-grid">
            {pinned.map((app) => (
              <button key={app.path} type="button" className="pin-tile" title={app.name} onClick={() => launch(app.path)}>
                <AppIcon path={app.path} name={app.name} size={30} />
                <span>{app.name}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel-section">
        <h2>{query ? "Best matches" : "All apps"}</h2>
        {apps.status === "loading" ? <PanelState kind="loading" title="Finding your apps" /> : null}
        {apps.status === "error" ? <PanelState kind="error" title="Couldn't list your apps" detail={apps.error} /> : null}
        {apps.status === "ready" && visible.length === 0 ? (
          <PanelState kind="empty" title={query ? `Nothing matches “${query}”` : "No apps found"} />
        ) : null}
        {visible.length > 0 ? (
          <ul className="app-list" role="listbox" aria-label="Apps" ref={listRef}>
            {visible.map((app, index) => {
              const isPin = isPinned(pinned, app.path);
              return (
                <li
                  key={app.path}
                  role="option"
                  aria-selected={index === selected}
                  data-index={index}
                  className={index === selected ? "is-selected" : ""}
                >
                  <button
                    type="button"
                    className="app-row"
                    onClick={() => launch(app.path)}
                    onMouseEnter={() => setSelected(index)}
                    onFocus={() => setSelected(index)}
                  >
                    <AppIcon path={app.path} name={app.name} size={24} />
                    <span className="app-row-name">{app.name}</span>
                  </button>
                  <IconButton
                    icon="pin"
                    size={14}
                    tone={isPin ? "accent" : undefined}
                    label={isPin ? `Unpin ${app.name}` : `Pin ${app.name} to the dock`}
                    onClick={() => togglePin(app)}
                  />
                </li>
              );
            })}
          </ul>
        ) : null}
        {!query && apps.status === "ready" && results.length > shown ? (
          <button type="button" className="button is-ghost show-more" onClick={() => setShown((n) => n + PAGE)}>
            Show more ({results.length - shown})
          </button>
        ) : null}
      </section>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <footer className="launcher-footer">
        <button
          type="button"
          className="button is-ghost"
          onClick={() => {
            void openStartMenu().catch(() => undefined);
            onDone();
          }}
        >
          <Icon name="windows" size={14} /> Windows Start
        </button>
        <IconButton icon="settings" label="Apps and taskbar settings" onClick={() => void openHub("apps")} />
        <span className="power-row" role="group" aria-label="Power">
          {POWER.map((item) => (
            <IconButton
              key={item.action}
              icon={item.icon}
              tone={confirm === item.action ? "danger" : undefined}
              label={confirm === item.action ? `Click again to ${item.label.toLowerCase()}` : item.label}
              onClick={() => power(item)}
            />
          ))}
        </span>
      </footer>
      {confirm ? (
        <p className="confirm-hint" role="status">
          Click {POWER.find((p) => p.action === confirm)?.label.toLowerCase()} again to confirm.
        </p>
      ) : null}
    </div>
  );
}
