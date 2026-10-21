import { useState } from "react";
import { errorText, focusStart, focusStop } from "../../../services/ipc";
import { useLive, useNow } from "../../../services/liveContext";
import { useSettings } from "../../../services/settingsContext";
import { focusProgress, focusRemaining, formatCountdown } from "../../widgets/format";
import { PanelState, Ring } from "../../widgets/visuals";
import { PanelHeader } from "./PanelHeader";

const PRESETS = [15, 25, 50];

export function FocusPanel() {
  const { focus } = useLive();
  const { settings } = useSettings();
  const now = useNow(1000);
  const [error, setError] = useState<string | null>(null);

  const run = (action: () => Promise<unknown>) => {
    setError(null);
    action().catch((e) => setError(errorText(e)));
  };

  if (focus.status === "loading") return <PanelState kind="loading" title="Loading focus" />;
  if (focus.status === "error") return <PanelState kind="error" title="Focus is unavailable" detail={focus.error} />;

  const f = focus.data;
  const active = f.phase !== "idle";
  const maxDay = Math.max(30, ...f.history.map((d) => d.minutes));
  const presets = Array.from(new Set([settings.widgets.focus.focusMinutes, ...PRESETS])).sort((a, b) => a - b);

  return (
    <>
      <PanelHeader
        icon="focus"
        title="Focus"
        subtitle={`${f.todayMinutes} min focused today`}
      />
      <div className="focus-hero">
        <Ring value={focusProgress(f, now)} size={132} stroke={8} tone={f.phase === "break" ? "info" : "accent"}>
          <span className="focus-time tabular">
            {active ? formatCountdown(focusRemaining(f, now)) : `${settings.widgets.focus.focusMinutes}:00`}
          </span>
          <span className="focus-phase">
            {f.phase === "focus" ? "Focusing" : f.phase === "break" ? "Break" : "Ready"}
          </span>
        </Ring>
      </div>
      {active ? (
        <div className="button-row">
          <button type="button" className="button is-danger" onClick={() => run(focusStop)}>
            {f.phase === "break" ? "Skip break" : "Stop round"}
          </button>
        </div>
      ) : (
        <div className="button-row">
          {presets.map((minutes) => (
            <button
              key={minutes}
              type="button"
              className={`button ${minutes === settings.widgets.focus.focusMinutes ? "is-primary" : ""}`}
              onClick={() => run(() => focusStart(minutes))}
            >
              {minutes} min
            </button>
          ))}
        </div>
      )}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <section className="panel-section">
        <h2>Last 7 days</h2>
        {f.history.length === 0 ? (
          <p className="muted">No focus rounds yet. Finished rounds show up here.</p>
        ) : (
          <div className="history-bars" role="list">
            {f.history.map((day) => (
              <div
                key={day.dayStart}
                className="history-bar"
                role="listitem"
                aria-label={`${new Date(day.dayStart).toLocaleDateString([], { weekday: "long" })}: ${day.minutes} minutes`}
              >
                <span className="history-fill" style={{ height: `${Math.max(4, (day.minutes / maxDay) * 100)}%` }} />
                <span className="history-label">
                  {new Date(day.dayStart).toLocaleDateString([], { weekday: "narrow" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
