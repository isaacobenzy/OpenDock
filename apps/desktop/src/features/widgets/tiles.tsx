import type { DockSize } from "@opendock/config-schema";
import type { ReactNode } from "react";
import { AppsTile } from "../apps/AppsTile";
import { TrayTile, VolumeTile } from "../apps/TrayTiles";
import { mediaControl } from "../../services/ipc";
import { useLive, useNow } from "../../services/liveContext";
import { useSettings } from "../../services/settingsContext";
import {
  dayProgress,
  focusProgress,
  focusRemaining,
  formatCountdown,
  formatPercent,
  formatRelative,
  formatShortDate,
  formatTemperature,
  formatTime,
  nextEvent,
  weatherKind,
  weatherLabel,
} from "./format";
import { Icon } from "./icons";
import { Bar, Ring, Skeleton, Sparkline } from "./visuals";

export type TileProps = { size: DockSize; compact: boolean };

type TileState = "ready" | "loading" | "empty" | "error";

function Tile({
  state,
  icon,
  primary,
  secondary,
  extra,
  title,
  compact,
}: {
  state: TileState;
  icon: ReactNode;
  primary?: ReactNode;
  secondary?: ReactNode;
  extra?: ReactNode;
  title?: string;
  compact: boolean;
}) {
  return (
    <span className={`tile is-${state}`} title={title}>
      <span className="tile-icon">{icon}</span>
      {compact ? null : (
        <span className="tile-text">
          {state === "loading" ? (
            <Skeleton width={52} />
          ) : (
            <>
              {primary !== undefined ? <span className="tile-primary">{primary}</span> : null}
              {secondary !== undefined ? <span className="tile-secondary">{secondary}</span> : null}
            </>
          )}
        </span>
      )}
      {extra && !compact ? <span className="tile-extra">{extra}</span> : null}
    </span>
  );
}

function StartTile() {
  return (
    <span className="tile tile-start is-ready">
      <span className="start-logo">
        <Icon name="start" size={16} />
      </span>
    </span>
  );
}

function ClockTile({ size, compact }: TileProps) {
  const now = useNow(1000);
  const { settings } = useSettings();
  const date = new Date(now);
  const time = formatTime(date, settings.dock.clock24h);
  if (compact) {
    return (
      <span className="tile tile-clock is-ready is-compact" title={formatShortDate(date)}>
        <span className="tile-primary">{date.getHours().toString().padStart(2, "0")}</span>
        <span className="tile-primary">{date.getMinutes().toString().padStart(2, "0")}</span>
      </span>
    );
  }
  return (
    <span className="tile tile-clock is-ready">
      <span className="tile-text">
        <span className="tile-primary clock-time">{time}</span>
        {size === "s" ? null : <span className="tile-secondary">{formatShortDate(date)}</span>}
      </span>
    </span>
  );
}

function MediaTile({ size, compact }: TileProps) {
  const { media } = useLive();
  if (media.status !== "ready") {
    return (
      <Tile
        compact={compact}
        state={media.status}
        icon={<Icon name="music" />}
        primary="Media unavailable"
        title={media.status === "error" ? media.error : undefined}
      />
    );
  }
  const m = media.data;
  if (!m.available || !m.title) {
    return (
      <Tile compact={compact} state="empty" icon={<Icon name="music" />} primary="Nothing playing" />
    );
  }
  const toggle = (event: React.MouseEvent | React.KeyboardEvent) => {
    event.stopPropagation();
    void mediaControl("toggle");
  };
  return (
    <Tile
      compact={compact}
      state="ready"
      title={`${m.title} — ${m.artist}`}
      icon={
        <span
          className={`media-art ${m.playing ? "is-playing" : ""}`}
          role="button"
          tabIndex={0}
          aria-label={m.playing ? "Pause" : "Play"}
          onClick={toggle}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggle(e)}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Icon name={m.playing ? "pause" : "play"} size={14} />
        </span>
      }
      primary={<span className="tile-truncate">{m.title}</span>}
      secondary={size === "s" ? undefined : <span className="tile-truncate">{m.artist || m.app}</span>}
      extra={size === "l" && m.playing ? <span className="eq" aria-hidden><i /><i /><i /></span> : undefined}
    />
  );
}

function FocusTile({ compact }: TileProps) {
  const { focus } = useLive();
  const now = useNow(1000);
  if (focus.status !== "ready") {
    return <Tile compact={compact} state={focus.status} icon={<Icon name="focus" />} primary="Focus" />;
  }
  const f = focus.data;
  if (f.phase === "idle") {
    return (
      <Tile
        compact={compact}
        state="empty"
        icon={<Ring value={0} size={24} />}
        primary="Focus"
        secondary={f.todayMinutes > 0 ? `${f.todayMinutes} min today` : "Start a round"}
      />
    );
  }
  const progress = focusProgress(f, now);
  return (
    <Tile
      compact={compact}
      state="ready"
      icon={<Ring value={progress} size={24} tone={f.phase === "break" ? "info" : "accent"} />}
      primary={<span className="tabular">{formatCountdown(focusRemaining(f, now))}</span>}
      secondary={f.phase === "break" ? "Break" : "Focusing"}
    />
  );
}

function SystemTile({ size, compact }: TileProps) {
  const { stats, cpuHistory } = useLive();
  if (stats.status !== "ready" || stats.data === null) {
    const state = stats.status === "ready" ? "empty" : stats.status;
    return (
      <Tile
        compact={compact}
        state={state}
        icon={<Icon name="cpu" />}
        primary={state === "error" ? "Stats unavailable" : "No stats yet"}
        title={stats.status === "error" ? stats.error : undefined}
      />
    );
  }
  const s = stats.data;
  const cpu = s.cpu ?? 0;
  const memory = s.memory ?? 0;
  return (
    <span className="tile tile-system is-ready" title={`CPU ${formatPercent(s.cpu)}, memory ${formatPercent(s.memory)}`}>
      <Ring value={cpu / 100} size={26} tone={cpu > 85 ? "warn" : "accent"} label={`CPU ${formatPercent(s.cpu)}`}>
        {compact ? null : <small>C</small>}
      </Ring>
      {compact ? null : (
        <Ring value={memory / 100} size={26} tone={memory > 85 ? "warn" : "info"} label={`Memory ${formatPercent(s.memory)}`}>
          <small>M</small>
        </Ring>
      )}
      {size === "l" && !compact ? <Sparkline values={cpuHistory} /> : null}
      {size !== "s" && !compact ? (
        <span className="tile-text">
          <span className="tile-primary tabular">{formatPercent(s.cpu)}</span>
          <span className="tile-secondary">CPU</span>
        </span>
      ) : null}
    </span>
  );
}

function BatteryTile({ compact }: TileProps) {
  const { stats } = useLive();
  if (stats.status !== "ready") {
    return <Tile compact={compact} state={stats.status} icon={<Icon name="battery" />} primary="Battery" />;
  }
  const battery = stats.data?.battery;
  if (!battery) {
    return <Tile compact={compact} state="empty" icon={<Icon name="battery" />} primary="No battery" />;
  }
  const low = battery.percent <= 20 && !battery.charging;
  return (
    <span className={`tile tile-battery is-ready ${low ? "is-warn" : ""}`} title={`${battery.percent}%`}>
      <span className="battery-glyph" aria-hidden>
        <span className="battery-fill" style={{ width: `${battery.percent}%` }} />
        {battery.charging ? <Icon name="bolt" size={10} /> : null}
      </span>
      {compact ? null : <span className="tile-primary tabular">{battery.percent}%</span>}
    </span>
  );
}

function WeatherTile({ size, compact }: TileProps) {
  const { weather } = useLive();
  const { settings } = useSettings();
  if (weather.status !== "ready") {
    return <Tile compact={compact} state={weather.status} icon={<Icon name="partly" />} primary="Weather" />;
  }
  const w = weather.data;
  if (!w) {
    const configured = settings.widgets.weather.latitude !== null;
    return (
      <Tile
        compact={compact}
        state={configured ? "loading" : "empty"}
        icon={<Icon name="location" />}
        primary={configured ? "Loading" : "Set a city"}
      />
    );
  }
  return (
    <Tile
      compact={compact}
      state={w.error && w.stale ? "error" : "ready"}
      title={w.error ? `Showing saved forecast: ${w.error}` : `${weatherLabel(w.code)} in ${w.city}`}
      icon={<Icon name={weatherKind(w.code)} />}
      primary={<span className="tabular">{formatTemperature(w.temperature, w.unit)}</span>}
      secondary={size === "s" ? undefined : size === "l" ? `${weatherLabel(w.code)} · ${w.city}` : w.city}
    />
  );
}

function CalendarTile({ size, compact }: TileProps) {
  const { events } = useLive();
  const now = useNow(30_000);
  if (events.status !== "ready") {
    return <Tile compact={compact} state={events.status} icon={<Icon name="calendar" />} primary="Calendar" />;
  }
  const next = nextEvent(events.data, now);
  if (!next) {
    return <Tile compact={compact} state="empty" icon={<Icon name="calendar" />} primary="No events" />;
  }
  const live = next.startsAt <= now;
  return (
    <Tile
      compact={compact}
      state="ready"
      title={next.title}
      icon={
        <span className="event-dot" style={{ background: next.color }}>
          <Icon name="calendar" size={14} />
        </span>
      }
      primary={<span className="tile-truncate">{next.title}</span>}
      secondary={size === "s" ? undefined : live ? "Happening now" : formatRelative(next.startsAt, now)}
    />
  );
}

function TodosTile({ size, compact }: TileProps) {
  const { todos } = useLive();
  if (todos.status !== "ready") {
    return <Tile compact={compact} state={todos.status} icon={<Icon name="todo" />} primary="Todos" />;
  }
  const open = todos.data.filter((t) => !t.done);
  if (todos.data.length === 0) {
    return <Tile compact={compact} state="empty" icon={<Icon name="todo" />} primary="No todos" />;
  }
  return (
    <Tile
      compact={compact}
      state="ready"
      icon={<Icon name={open.length === 0 ? "check" : "todo"} />}
      primary={open.length === 0 ? "All done" : `${open.length} open`}
      secondary={size === "s" || open.length === 0 ? undefined : <span className="tile-truncate">{open[0].title}</span>}
    />
  );
}

function NotesTile({ size, compact }: TileProps) {
  const { notes } = useLive();
  if (notes.status !== "ready") {
    return <Tile compact={compact} state={notes.status} icon={<Icon name="note" />} primary="Notes" />;
  }
  if (notes.data.length === 0) {
    return <Tile compact={compact} state="empty" icon={<Icon name="note" />} primary="No notes" />;
  }
  const top = notes.data.find((n) => n.pinned) ?? notes.data[0];
  return (
    <Tile
      compact={compact}
      state="ready"
      icon={<Icon name={top.pinned ? "pin" : "note"} />}
      primary={<span className="tile-truncate">{top.body.split("\n")[0]}</span>}
      secondary={size === "s" ? undefined : `${notes.data.length} note${notes.data.length === 1 ? "" : "s"}`}
    />
  );
}

function DayProgressTile({ size, compact }: TileProps) {
  const now = useNow(60_000);
  const progress = dayProgress(new Date(now));
  if (compact) {
    return (
      <span className="tile is-ready" title={`${Math.round(progress.day * 100)}% of today`}>
        <Ring value={progress.day} size={24} />
      </span>
    );
  }
  return (
    <span className="tile tile-progress is-ready">
      <span className="tile-text">
        <span className="tile-primary tabular">{Math.round(progress.day * 100)}% of today</span>
        <Bar value={progress.day} label="Day progress" />
        {size === "l" ? <span className="tile-secondary">{Math.round(progress.year * 100)}% of the year</span> : null}
      </span>
    </span>
  );
}

function AddTile() {
  return (
    <span className="tile tile-add is-ready">
      <Icon name="plus" size={16} />
    </span>
  );
}

function UnknownTile({ id }: { id: string }) {
  return <Tile compact={false} state="error" icon={<Icon name="warning" />} primary={id} title="Unknown widget" />;
}

export function TileContent({ id, size, compact }: { id: string } & TileProps) {
  const props = { size, compact };
  switch (id) {
    case "start":
      return <StartTile />;
    case "clock":
      return <ClockTile {...props} />;
    case "media":
      return <MediaTile {...props} />;
    case "focus":
      return <FocusTile {...props} />;
    case "system":
      return <SystemTile {...props} />;
    case "battery":
      return <BatteryTile {...props} />;
    case "weather":
      return <WeatherTile {...props} />;
    case "calendar":
      return <CalendarTile {...props} />;
    case "todos":
      return <TodosTile {...props} />;
    case "notes":
      return <NotesTile {...props} />;
    case "day-progress":
      return <DayProgressTile {...props} />;
    case "apps":
      return <AppsTile {...props} />;
    case "volume":
      return <VolumeTile {...props} />;
    case "tray":
      return <TrayTile compact={compact} />;
    case "add-widget":
      return <AddTile />;
    default:
      return <UnknownTile id={id} />;
  }
}
