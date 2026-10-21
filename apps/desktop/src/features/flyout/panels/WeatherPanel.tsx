import { openHub, refreshWeather } from "../../../services/ipc";
import { useLive, useNow } from "../../../services/liveContext";
import { useSettings } from "../../../services/settingsContext";
import {
  formatAgo,
  formatTemperature,
  formatTime,
  nextHours,
  weatherKind,
  weatherLabel,
} from "../../widgets/format";
import { Icon } from "../../widgets/icons";
import { PanelState } from "../../widgets/visuals";
import { IconButton, PanelHeader } from "./PanelHeader";

export function WeatherPanel() {
  const { weather } = useLive();
  const { settings } = useSettings();
  const now = useNow(60_000);

  if (weather.status === "loading") return <PanelState kind="loading" title="Loading the forecast" />;
  if (weather.status === "error") return <PanelState kind="error" title="Weather is unavailable" detail={weather.error} />;
  const w = weather.data;
  if (!w) {
    const configured = settings.widgets.weather.latitude !== null;
    return (
      <>
        <PanelHeader icon="partly" title="Weather" />
        {configured ? (
          <PanelState kind="loading" title="Fetching the first forecast" />
        ) : (
          <PanelState
            kind="empty"
            title="Choose a city"
            detail="Forecasts come from Open-Meteo. Only the city's coordinates are sent."
            action={
              <button type="button" className="button is-primary" onClick={() => void openHub("dock")}>
                Pick a city
              </button>
            }
          />
        )}
      </>
    );
  }

  const use24h = settings.dock.clock24h;
  return (
    <>
      <PanelHeader
        icon="location"
        title={w.city}
        subtitle={w.stale ? `Saved forecast from ${formatAgo(w.fetchedAt, now)}` : `Updated ${formatAgo(w.fetchedAt, now)}`}
        actions={<IconButton icon="refresh" label="Refresh" onClick={() => void refreshWeather()} />}
      />
      {w.error ? (
        <p className="callout is-warn" role="status">
          <Icon name="warning" size={16} /> Couldn't refresh: {w.error}
        </p>
      ) : null}
      <div className="weather-hero">
        <span className="weather-glyph">
          <Icon name={weatherKind(w.code)} size={48} />
        </span>
        <div>
          <p className="weather-temp tabular">{formatTemperature(w.temperature, w.unit)}</p>
          <p className="muted">
            {weatherLabel(w.code)} · feels {formatTemperature(w.apparentTemperature, w.unit)}
          </p>
          <p className="muted tabular">
            H {formatTemperature(w.high, w.unit)} · L {formatTemperature(w.low, w.unit)} · wind {Math.round(w.windSpeed)} km/h
          </p>
        </div>
      </div>
      <section className="panel-section">
        <h2>Next hours</h2>
        <div className="hour-strip">
          {nextHours(w, now, 8).map((hour) => (
            <div className="hour-cell" key={hour.time}>
              <span className="muted">{formatTime(new Date(hour.time), use24h).replace(":00", "")}</span>
              <Icon name={weatherKind(hour.code)} size={18} />
              <span className="tabular">{formatTemperature(hour.temperature, w.unit)}</span>
              {hour.precipitation >= 20 ? <span className="rain-chance tabular">{Math.round(hour.precipitation)}%</span> : null}
            </div>
          ))}
        </div>
      </section>
      <section className="panel-section">
        <h2>Next days</h2>
        <ul className="day-list">
          {w.daily.map((day) => (
            <li key={day.date}>
              <span className="day-name">{new Date(day.date).toLocaleDateString([], { weekday: "short" })}</span>
              <Icon name={weatherKind(day.code)} size={16} />
              <span className="muted tabular">{Math.round(day.precipitation)}%</span>
              <span className="tabular">
                {formatTemperature(day.low, w.unit)} / {formatTemperature(day.high, w.unit)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
