import { useState } from "react";
import { sendShortcut, setMuted, setVolume } from "../../../services/ipc";
import { useLive } from "../../../services/liveContext";
import { volumeIcon } from "../../apps/volume";
import { Icon } from "../../widgets/icons";
import { PanelState } from "../../widgets/visuals";
import { PanelHeader } from "./PanelHeader";

const PRESETS = [0, 25, 50, 75, 100];

export function VolumePanel() {
  const { volume } = useLive();
  const [draft, setDraft] = useState<number | null>(null);

  if (volume.status === "loading") return <PanelState kind="loading" title="Checking sound" />;
  if (volume.status === "error") {
    return <PanelState kind="error" title="Sound controls are unavailable" detail={volume.error} />;
  }
  if (volume.data === null) {
    return (
      <>
        <PanelHeader icon="volume-mute" title="Volume" />
        <PanelState kind="empty" title="No audio output" detail="Plug in speakers or headphones, or pick an output in Quick settings." />
      </>
    );
  }

  const { level, muted } = volume.data;
  const shown = draft ?? level;
  const change = (next: number) => {
    setDraft(next);
    void setVolume(next).catch(() => undefined);
  };

  return (
    <>
      <PanelHeader icon={volumeIcon(level, muted)} title="Volume" subtitle={muted ? "Muted" : `${level}%`} />
      <div className="volume-row">
        <button
          type="button"
          className={`round-button ${muted ? "" : "is-primary"}`}
          aria-label={muted ? "Unmute" : "Mute"}
          aria-pressed={muted}
          onClick={() => void setMuted(!muted).catch(() => undefined)}
        >
          <Icon name={volumeIcon(shown, muted)} size={18} />
        </button>
        <input
          className="volume-slider"
          type="range"
          min={0}
          max={100}
          step={1}
          aria-label="Volume"
          value={shown}
          style={{ ["--fill" as string]: `${shown}%` }}
          onChange={(e) => change(Number(e.target.value))}
          onPointerUp={() => setDraft(null)}
          onKeyUp={() => setDraft(null)}
          onBlur={() => setDraft(null)}
        />
        <span className="volume-value tabular">{shown}%</span>
      </div>
      <div className="preset-row" role="group" aria-label="Volume presets">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`chip ${level === preset && !muted ? "is-active" : ""}`}
            onClick={() => void setVolume(preset).catch(() => undefined)}
          >
            {preset}%
          </button>
        ))}
      </div>
      <div className="button-row">
        <button type="button" className="button" onClick={() => void sendShortcut("quickSettings").catch(() => undefined)}>
          <Icon name="wifi" size={14} /> Output and quick settings
        </button>
      </div>
    </>
  );
}
