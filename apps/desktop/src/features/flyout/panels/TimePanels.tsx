import { useLive, useNow } from "../../../services/liveContext";
import { useSettings } from "../../../services/settingsContext";
import { dayProgress, formatTime, monthGrid } from "../../widgets/format";
import { Bar } from "../../widgets/visuals";
import { EventList } from "./CalendarPanel";
import { PanelHeader } from "./PanelHeader";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function ClockPanel() {
  const now = useNow(1000);
  const { settings } = useSettings();
  const { events } = useLive();
  const date = new Date(now);
  const weeks = monthGrid(date.getFullYear(), date.getMonth());
  const todayEnd = new Date(date);
  todayEnd.setHours(23, 59, 59, 999);
  const today = events.status === "ready" ? events.data.filter((e) => e.startsAt <= todayEnd.getTime()) : [];

  return (
    <>
      <div className="clock-hero">
        <p className="clock-big tabular">{formatTime(date, settings.dock.clock24h)}</p>
        <p className="muted">{date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
      </div>
      <section className="panel-section">
        <h2>{date.toLocaleDateString([], { month: "long", year: "numeric" })}</h2>
        <table className="month-grid">
          <thead>
            <tr>
              {WEEKDAYS.map((d, i) => (
                <th key={i} scope="col">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, i) => (
              <tr key={i}>
                {week.map((day, j) => (
                  <td key={j} className={day === date.getDate() ? "is-today" : ""}>
                    {day ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="panel-section">
        <h2>Today</h2>
        {events.status === "loading" ? (
          <p className="muted">Loading events…</p>
        ) : today.length === 0 ? (
          <p className="muted">Nothing else on today.</p>
        ) : (
          <EventList events={today} now={now} limit={4} />
        )}
      </section>
    </>
  );
}

export function DayProgressPanel() {
  const now = useNow(30_000);
  const p = dayProgress(new Date(now));
  const rows: { label: string; value: number }[] = [
    { label: "Today", value: p.day },
    { label: "This week", value: p.week },
    { label: "This month", value: p.month },
    { label: "This year", value: p.year },
  ];
  return (
    <>
      <PanelHeader icon="progress" title="Day progress" subtitle="How much time has gone" />
      <ul className="progress-list">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="progress-head">
              <span>{row.label}</span>
              <span className="tabular">{(row.value * 100).toFixed(1)}%</span>
            </div>
            <Bar value={row.value} label={row.label} />
          </li>
        ))}
      </ul>
    </>
  );
}
