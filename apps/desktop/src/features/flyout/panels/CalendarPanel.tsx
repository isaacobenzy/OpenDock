import { openHub, syncCalendars, type CalendarEvent } from "../../../services/ipc";
import { useLive, useNow } from "../../../services/liveContext";
import { useSettings } from "../../../services/settingsContext";
import { eventTimeRange, formatRelative, groupEventsByDay } from "../../widgets/format";
import { PanelState } from "../../widgets/visuals";
import { IconButton, PanelHeader } from "./PanelHeader";

export function EventList({ events, now, limit }: { events: CalendarEvent[]; now: number; limit?: number }) {
  const { settings } = useSettings();
  const groups = groupEventsByDay(events, now);
  let shown = 0;
  return (
    <div className="event-groups">
      {groups.map((group) => {
        if (limit !== undefined && shown >= limit) return null;
        const list = limit === undefined ? group.events : group.events.slice(0, limit - shown);
        shown += list.length;
        return (
          <section key={group.label} className="event-group">
            <h2>{group.label}</h2>
            <ul>
              {list.map((event) => {
                const live = event.startsAt <= now && event.endsAt > now;
                return (
                  <li key={`${event.calendarId}-${event.uid}-${event.startsAt}`} className={live ? "is-live" : ""}>
                    <span className="event-swatch" style={{ background: event.color }} aria-hidden />
                    <div className="event-body">
                      <p className="event-title">{event.title}</p>
                      <p className="muted">
                        {eventTimeRange(event, settings.dock.clock24h)}
                        {event.location ? ` · ${event.location}` : ""}
                      </p>
                    </div>
                    {!event.allDay ? (
                      <span className="event-when">{live ? "Now" : formatRelative(event.startsAt, now)}</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function CalendarPanel() {
  const { events } = useLive();
  const now = useNow(30_000);

  const header = (
    <PanelHeader
      icon="calendar"
      title="Upcoming"
      subtitle="Next 3 days"
      actions={
        <>
          <IconButton icon="refresh" label="Sync calendars" onClick={() => void syncCalendars()} />
          <IconButton icon="settings" label="Manage calendars" onClick={() => void openHub("calendars")} />
        </>
      }
    />
  );

  if (events.status === "loading") return <PanelState kind="loading" title="Loading events" />;
  if (events.status === "error") {
    return (
      <>
        {header}
        <PanelState kind="error" title="Couldn't read your calendars" detail={events.error} />
      </>
    );
  }
  const upcoming = events.data.filter((e) => e.endsAt > now);
  if (upcoming.length === 0) {
    return (
      <>
        {header}
        <PanelState
          kind="empty"
          title="Nothing coming up"
          detail="Add an iCal link from Google, Outlook or iCloud to see your meetings here."
          action={
            <button type="button" className="button is-primary" onClick={() => void openHub("calendars")}>
              Add a calendar
            </button>
          }
        />
      </>
    );
  }
  return (
    <>
      {header}
      <EventList events={upcoming} now={now} />
    </>
  );
}
