import { pinApp, unpinApp } from "@opendock/config-schema";
import { useLayoutEffect, useRef, type RefObject } from "react";
import {
  clearThumbnails,
  launchApp,
  showThumbnails,
  windowAction,
  type ThumbnailSlot,
} from "../../../services/ipc";
import { useLive } from "../../../services/liveContext";
import { useSettings } from "../../../services/settingsContext";
import { AppIcon } from "../../apps/AppIcon";
import { buildAppEntries, findEntry, type AppEntry } from "../../apps/model";
import { Icon } from "../../widgets/icons";
import { PanelState } from "../../widgets/visuals";
import { IconButton, PanelHeader } from "./PanelHeader";

/** Live previews are drawn by Windows on top of the panel, after it finishes animating in. */
const PREVIEW_DELAY_MS = 220;

function useLivePreviews(container: RefObject<HTMLElement | null>, signature: string) {
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const place = () => {
      const slots: ThumbnailSlot[] = [];
      root.querySelectorAll<HTMLElement>("[data-thumb]").forEach((slot) => {
        const rect = slot.getBoundingClientRect();
        slots.push({ id: Number(slot.dataset.thumb), x: rect.left, y: rect.top, width: rect.width, height: rect.height });
      });
      void showThumbnails(slots).catch(() => undefined);
    };
    const timer = window.setTimeout(place, PREVIEW_DELAY_MS);
    window.addEventListener("resize", place);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", place);
      void clearThumbnails().catch(() => undefined);
    };
  }, [container, signature]);
}

function resolveEntry(entries: AppEntry[], grouped: AppEntry[], target: string | null): AppEntry | undefined {
  return findEntry(entries, target) ?? findEntry(grouped, target?.split("#")[0]);
}

export function AppPanel({ target, onDone }: { target: string | null; onDone: () => void }) {
  const { windows } = useLive();
  const { settings, update } = useSettings();
  const gridRef = useRef<HTMLUListElement>(null);

  const snapshot = windows.status === "ready" ? windows.data : null;
  const entry = snapshot
    ? resolveEntry(
        buildAppEntries(settings.apps.pinned, snapshot, settings.apps.groupWindows),
        buildAppEntries(settings.apps.pinned, snapshot, true),
        target,
      )
    : undefined;
  const signature = entry?.windows.map((w) => `${w.id}:${w.minimized}`).join(",") ?? "";
  useLivePreviews(gridRef, signature);

  if (windows.status === "loading") return <PanelState kind="loading" title="Finding windows" />;
  if (windows.status === "error") {
    return <PanelState kind="error" title="Open windows are unavailable" detail={windows.error} />;
  }
  if (!entry) {
    return <PanelState kind="empty" title="This app has closed" detail="Its windows are gone." />;
  }

  const count = entry.windows.length;
  const active = snapshot?.active ?? null;
  const togglePin = () => {
    void update((s) => {
      const pinned = entry.pinned
        ? unpinApp(s.apps.pinned, entry.pinPath ?? "")
        : pinApp(s.apps.pinned, {
            name: entry.name.slice(0, 120),
            path: entry.launchPath ?? entry.iconPath,
            target: entry.windows[0]?.exe ?? null,
          });
      return { ...s, apps: { ...s.apps, pinned } };
    });
  };
  const act = (run: () => Promise<unknown>) => {
    void run().catch(() => undefined);
    onDone();
  };

  return (
    <div className="app-panel">
      <PanelHeader
        icon="window"
        leading={<AppIcon path={entry.iconPath} name={entry.name} window={entry.windows[0]?.id} size={22} />}
        title={entry.name}
        subtitle={count === 0 ? "Not running" : count === 1 ? "1 window" : `${count} windows`}
        actions={
          <IconButton
            icon="pin"
            label={entry.pinned ? `Unpin ${entry.name}` : `Pin ${entry.name} to the dock`}
            tone={entry.pinned ? "accent" : undefined}
            onClick={togglePin}
          />
        }
      />

      {count > 0 ? (
        <ul className={`window-grid ${count === 1 ? "is-single" : ""}`} ref={gridRef} aria-label="Windows">
          {entry.windows.map((w) => (
            <li key={w.id} className={`window-card ${w.id === active ? "is-active" : ""}`}>
              <button
                type="button"
                className="window-card-main"
                onClick={() => act(() => windowAction(w.id, "activate"))}
                aria-label={`Switch to ${w.title}`}
              >
                <span className="window-thumb" data-thumb={w.minimized ? undefined : w.id}>
                  <AppIcon path={entry.iconPath} name={entry.name} window={w.id} size={36} />
                  {w.minimized ? <span className="window-thumb-note">Minimised</span> : null}
                </span>
                <span className="window-card-title">{w.title}</span>
              </button>
              <IconButton
                icon="close"
                label={`Close ${w.title}`}
                size={14}
                onClick={() => void windowAction(w.id, "close").catch(() => undefined)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <PanelState kind="empty" title={`${entry.name} isn't running`} />
      )}

      <section className="menu-section app-actions">
        {entry.launchPath ? (
          <button type="button" className="menu-item" onClick={() => act(() => launchApp(entry.launchPath!))}>
            <Icon name="plus" size={16} />
            <span>{count === 0 ? `Open ${entry.name}` : "New window"}</span>
          </button>
        ) : null}
        {count > 0 ? (
          <button
            type="button"
            className="menu-item is-danger"
            onClick={() => act(() => Promise.all(entry.windows.map((w) => windowAction(w.id, "close"))))}
          >
            <Icon name="close" size={16} />
            <span>{count === 1 ? "Close window" : `Close all ${count} windows`}</span>
          </button>
        ) : null}
      </section>
    </div>
  );
}
