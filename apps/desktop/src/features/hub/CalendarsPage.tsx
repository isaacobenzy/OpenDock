import { useCallback, useEffect, useState } from "react";
import {
  addCalendar,
  errorText,
  listCalendars,
  on,
  removeCalendar,
  syncCalendars,
  type Calendar,
} from "../../services/ipc";
import { useLive, useNow } from "../../services/liveContext";
import { EventList } from "../flyout/panels/CalendarPanel";
import { formatAgo } from "../widgets/format";
import { Icon } from "../widgets/icons";
import { PanelState } from "../widgets/visuals";
import { PageHeader } from "./PageHeader";

export function CalendarsPage() {
  const [calendars, setCalendars] = useState<Calendar[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const { events } = useLive();
  const now = useNow(30_000);

  const reload = useCallback(() => {
    listCalendars()
      .then(setCalendars)
      .catch((e) => setError(errorText(e)));
  }, []);

  useEffect(() => {
    reload();
    return on("data:changed", (topic) => topic === "calendar" && reload());
  }, [reload]);

  const add = () => {
    setAdding(true);
    setError(null);
    addCalendar(name.trim() || "Calendar", url.trim())
      .then(() => {
        setName("");
        setUrl("");
        reload();
      })
      .catch((e) => setError(errorText(e)))
      .finally(() => setAdding(false));
  };

  return (
    <div className="page">
      <PageHeader
        title="Calendars"
        subtitle="Read-only iCal feeds. Links are kept in the Windows Credential Manager, not in settings files."
        actions={
          <button type="button" className="button" onClick={() => void syncCalendars()}>
            <Icon name="refresh" size={14} /> Sync now
          </button>
        }
      />

      <section className="settings-card">
        <h2>Add a calendar</h2>
        <p className="muted small">
          In Google Calendar use “Secret address in iCal format”; in Outlook, “Publish calendar → ICS”; in iCloud,
          “Public calendar”. webcal:// links work too.
        </p>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label className="field">
            <span>Name</span>
            <input className="text-input" value={name} maxLength={60} placeholder="Work" onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field grow">
            <span>iCal link</span>
            <input
              className="text-input"
              value={url}
              maxLength={2048}
              placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <button type="submit" className="button is-primary" disabled={!url.trim() || adding}>
            {adding ? "Checking…" : "Add calendar"}
          </button>
        </form>
        {error ? <p className="callout is-error" role="alert">{error}</p> : null}
      </section>

      <section className="settings-card">
        <h2>Connected</h2>
        {calendars === null ? (
          <PanelState kind="loading" title="Loading calendars" />
        ) : calendars.length === 0 ? (
          <p className="muted">No calendars yet.</p>
        ) : (
          <ul className="calendar-list">
            {calendars.map((calendar) => (
              <li key={calendar.id}>
                <span className="event-swatch" style={{ background: calendar.color }} aria-hidden />
                <div className="grow">
                  <p>
                    <strong>{calendar.name}</strong> <span className="muted small">{calendar.host}</span>
                  </p>
                  {calendar.lastError ? (
                    <p className="small text-warn">
                      <Icon name="warning" size={12} /> {calendar.lastError}
                    </p>
                  ) : (
                    <p className="muted small">
                      {calendar.lastSyncedAt ? `Synced ${formatAgo(calendar.lastSyncedAt, now)}` : "Waiting for the first sync"}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="button is-small is-danger"
                  onClick={() => void removeCalendar(calendar.id).then(reload).catch((e) => setError(errorText(e)))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="settings-card">
        <h2>Coming up</h2>
        {events.status === "ready" && events.data.length > 0 ? (
          <EventList events={events.data} now={now} limit={12} />
        ) : events.status === "error" ? (
          <p className="text-warn">{events.error}</p>
        ) : (
          <p className="muted">Nothing in the next three days.</p>
        )}
      </section>
    </div>
  );
}
