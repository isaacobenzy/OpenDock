import type { DockSize } from "@opendock/config-schema";
import { useRef } from "react";
import type React from "react";
import { sendShortcut, setMuted, setVolume, type Shortcut } from "../../services/ipc";
import { useLive } from "../../services/liveContext";
import { Icon, type IconName } from "../widgets/icons";
import { Skeleton } from "../widgets/visuals";
import { volumeIcon } from "./volume";

export function VolumeTile({ size, compact }: { size: DockSize; compact: boolean }) {
  const { volume } = useLive();
  const target = useRef<number | null>(null);

  if (volume.status === "loading") {
    return (
      <span className="tile tile-volume is-loading">
        <span className="tile-icon">
          <Icon name="volume" />
        </span>
        {compact || size === "s" ? null : <Skeleton width={28} />}
      </span>
    );
  }
  if (volume.status === "error" || volume.data === null) {
    const error = volume.status === "error";
    return (
      <span
        className={`tile tile-volume ${error ? "is-error" : "is-empty"}`}
        title={error ? volume.error : "No audio output"}
      >
        <span className="tile-icon">
          <Icon name="volume-mute" />
        </span>
        {compact ? null : <span className="tile-primary">{error ? "Sound unavailable" : "No audio"}</span>}
      </span>
    );
  }

  const { level, muted } = volume.data;
  const onWheel = (event: React.WheelEvent) => {
    event.stopPropagation();
    const base = target.current ?? level;
    const next = Math.max(0, Math.min(100, base + (event.deltaY < 0 ? 2 : -2)));
    if (next === base) return;
    target.current = next;
    void setVolume(next)
      .catch(() => undefined)
      .finally(() => {
        if (target.current === next) target.current = null;
      });
  };

  return (
    <span
      className={`tile tile-volume is-ready ${muted ? "is-muted" : ""}`}
      title={muted ? "Muted. Scroll to change the volume." : `Volume ${level}%. Scroll to change it.`}
      onWheel={onWheel}
      onAuxClick={(event) => {
        if (event.button !== 1) return;
        event.stopPropagation();
        void setMuted(!muted).catch(() => undefined);
      }}
    >
      <span className="tile-icon">
        <Icon name={volumeIcon(level, muted)} />
      </span>
      {compact || size === "s" ? null : (
        <span className="tile-primary tabular">{muted ? "Muted" : `${level}%`}</span>
      )}
    </span>
  );
}

const TRAY: { shortcut: Shortcut; icon: IconName; label: string }[] = [
  { shortcut: "quickSettings", icon: "wifi", label: "Quick settings: Wi-Fi, Bluetooth and sound" },
  { shortcut: "notifications", icon: "bell", label: "Notifications" },
  { shortcut: "showDesktop", icon: "desktop", label: "Show desktop" },
];

export function TrayTile({ compact }: { compact: boolean }) {
  const items = compact ? TRAY.slice(0, 1) : TRAY;
  const press = (event: React.SyntheticEvent, shortcut: Shortcut) => {
    event.stopPropagation();
    void sendShortcut(shortcut).catch(() => undefined);
  };
  return (
    <span className="tile tile-tray is-ready" role="group" aria-label="Quick actions">
      {items.map((item) => (
        <span
          key={item.shortcut}
          className="tray-button"
          role="button"
          tabIndex={0}
          aria-label={item.label}
          title={item.label}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => press(event, item.shortcut)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              press(event, item.shortcut);
            }
          }}
        >
          <Icon name={item.icon} size={17} />
        </span>
      ))}
    </span>
  );
}
