import type { DockSize } from "@opendock/config-schema";
import type React from "react";
import { useEffect, useState } from "react";
import { launchApp, windowAction } from "../../services/ipc";
import { useLive } from "../../services/liveContext";
import { useSettings } from "../../services/settingsContext";
import { anchorOf, useDockActions } from "../dock/dockActions";
import { pageScroll, scrollEdges, wheelDelta } from "../dock/overflow";
import { Icon } from "../widgets/icons";
import { Skeleton } from "../widgets/visuals";
import { AppIcon } from "./AppIcon";
import { buildAppEntries, decideAppClick, type AppEntry } from "./model";

const ICON_PX: Record<DockSize, number> = { s: 22, m: 26, l: 32 };

function AppButton({
  entry,
  active,
  size,
  showTitle,
}: {
  entry: AppEntry;
  active: number | null;
  size: DockSize;
  showTitle: boolean;
}) {
  const { openPanel, vertical } = useDockActions();
  const count = entry.windows.length;
  const focused = entry.windows.find((w) => w.id === active) ?? entry.windows[0];
  const label =
    count === 0
      ? `Open ${entry.name}`
      : count === 1
        ? `${entry.name}: ${entry.windows[0].title}`
        : `${entry.name}, ${count} windows`;

  const launch = () => entry.launchPath && void launchApp(entry.launchPath).catch(() => undefined);
  const panel = (element: Element) => openPanel("app", anchorOf(element, vertical), entry.key);
  const activate = (element: Element) => {
    const click = decideAppClick(entry, active);
    if (click.kind === "launch") void launchApp(click.path).catch(() => undefined);
    else if (click.kind === "activate") void windowAction(click.id, "activate").catch(() => undefined);
    else if (click.kind === "minimize") void windowAction(click.id, "minimize").catch(() => undefined);
    else if (click.kind === "preview") panel(element);
  };
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();

  return (
    <span
      className={`app-button ${entry.active ? "is-active" : ""} ${count > 0 ? "is-running" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={label}
      title={label}
      data-app={entry.key}
      onPointerDown={stop}
      onClick={(event) => {
        stop(event);
        if (event.shiftKey && entry.launchPath) launch();
        else activate(event.currentTarget);
      }}
      onAuxClick={(event) => {
        if (event.button !== 1) return;
        event.preventDefault();
        stop(event);
        launch();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        stop(event);
        panel(event.currentTarget);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          stop(event);
          activate(event.currentTarget);
        } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
          event.preventDefault();
          stop(event);
          panel(event.currentTarget);
        }
      }}
      onFocus={(event) =>
        event.currentTarget.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" })
      }
    >
      <span className="app-glyph">
        <AppIcon path={entry.iconPath} name={entry.name} window={entry.windows[0]?.id} size={ICON_PX[size]} />
        {count > 1 ? <span className="app-count">{count > 9 ? "9+" : count}</span> : null}
      </span>
      {showTitle && entry.active && focused ? <span className="app-title tile-truncate">{focused.title}</span> : null}
      <span className="app-indicator" aria-hidden />
    </span>
  );
}

export function AppsTile({ size, compact }: { size: DockSize; compact: boolean }) {
  const { windows } = useLive();
  const { settings } = useSettings();
  const { vertical } = useDockActions();
  const [scroller, setScroller] = useState<HTMLSpanElement | null>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    if (!scroller) return;
    const read = () => {
      const offset = vertical ? scroller.scrollTop : scroller.scrollLeft;
      const max = vertical
        ? scroller.scrollHeight - scroller.clientHeight
        : scroller.scrollWidth - scroller.clientWidth;
      const next = scrollEdges(offset, max);
      setEdges((current) => (current.start === next.start && current.end === next.end ? current : next));
    };
    read();
    scroller.addEventListener("scroll", read, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(read);
    observer?.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", read);
      observer?.disconnect();
    };
  }, [scroller, vertical, windows]);

  useEffect(() => {
    if (!scroller) return;
    const onWheel = (event: WheelEvent) => {
      const max = vertical
        ? scroller.scrollHeight - scroller.clientHeight
        : scroller.scrollWidth - scroller.clientWidth;
      const delta = wheelDelta(event.deltaX, event.deltaY, vertical);
      if (max <= 2 || delta === 0) return;
      event.preventDefault();
      event.stopPropagation();
      // Wheel ticks are frequent, so they move directly. The buttons animate.
      if (vertical) scroller.scrollTop += delta;
      else scroller.scrollLeft += delta;
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, [scroller, vertical]);

  const nudge = (direction: -1 | 1) => {
    if (!scroller) return;
    const distance = pageScroll(vertical ? scroller.clientHeight : scroller.clientWidth, ICON_PX[size] + 12);
    scroller.scrollBy({
      left: vertical ? 0 : distance * direction,
      top: vertical ? distance * direction : 0,
      behavior: "smooth",
    });
  };

  if (windows.status === "loading") {
    return (
      <span className="tile tile-apps is-loading" aria-busy>
        <Skeleton width={ICON_PX[size]} />
        <Skeleton width={ICON_PX[size]} />
        <Skeleton width={ICON_PX[size]} />
      </span>
    );
  }
  if (windows.status === "error") {
    return (
      <span className="tile tile-apps is-error" title={windows.error}>
        <span className="tile-icon">
          <Icon name="warning" />
        </span>
        {compact ? null : <span className="tile-primary">Apps unavailable</span>}
      </span>
    );
  }

  const entries = buildAppEntries(settings.apps.pinned, windows.data, settings.apps.groupWindows);
  if (entries.length === 0) {
    return (
      <span className="tile tile-apps is-empty" title="Open windows and pinned apps show up here">
        <span className="tile-icon">
          <Icon name="apps" />
        </span>
        {compact ? null : <span className="tile-primary">No open apps</span>}
      </span>
    );
  }
  const overflow = edges.start || edges.end;
  return (
    <span className="tile tile-apps is-ready" role="group" aria-label="Apps" data-overflow={overflow || undefined}>
      <button
        type="button"
        className="apps-nudge is-start"
        aria-label={vertical ? "Show apps above" : "Show apps to the left"}
        hidden={!edges.start}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          nudge(-1);
        }}
      >
        <Icon name="chevron" size={14} />
      </button>
      <span className="apps-scroller" ref={setScroller}>
        {entries.map((entry) => (
          <AppButton
            key={entry.key}
            entry={entry}
            active={windows.data.active}
            size={size}
            showTitle={settings.apps.showTitles && !compact}
          />
        ))}
      </span>
      <button
        type="button"
        className="apps-nudge is-end"
        aria-label={vertical ? "Show apps below" : "Show apps to the right"}
        hidden={!edges.end}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          nudge(1);
        }}
      >
        <Icon name="chevron" size={14} />
      </button>
    </span>
  );
}
