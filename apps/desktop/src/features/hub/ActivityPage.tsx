import { findEvent } from "@opendock/config-schema";
import { useCallback, useEffect, useState } from "react";
import {
  clearActivity,
  errorText,
  listActivity,
  on,
  undoActivity,
  type ActivityEntry,
} from "../../services/ipc";
import { useNow } from "../../services/liveContext";
import { formatAgo } from "../widgets/format";
import { Icon } from "../widgets/icons";
import { PanelState } from "../widgets/visuals";
import { PageHeader } from "./PageHeader";

export function ActivityPage() {
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const now = useNow(30_000);

  const reload = useCallback(() => {
    listActivity(200)
      .then((list) => {
        setEntries(list);
        setError(null);
      })
      .catch((e) => setError(errorText(e)));
  }, []);

  useEffect(() => {
    reload();
    return on("data:changed", (topic) => topic === "activity" && reload());
  }, [reload]);

  const undo = (id: number) => {
    setBusy(id);
    undoActivity(id)
      .then(reload)
      .catch((e) => setError(errorText(e)))
      .finally(() => setBusy(null));
  };

  return (
    <div className="page">
      <PageHeader
        title="Activity"
        subtitle="Everything your automations did, newest first. The last 500 runs are kept."
        actions={
          entries && entries.length > 0 ? (
            <button type="button" className="button" onClick={() => void clearActivity().then(reload)}>
              <Icon name="trash" size={14} /> Clear log
            </button>
          ) : undefined
        }
      />
      {error ? <p className="callout is-error" role="alert">{error}</p> : null}
      {entries === null && !error ? <PanelState kind="loading" title="Loading activity" /> : null}
      {entries && entries.length === 0 ? (
        <PanelState
          kind="empty"
          title="Nothing has run yet"
          detail="When a rule fires, it shows up here with an Undo button where possible."
        />
      ) : null}
      {entries && entries.length > 0 ? (
        <ol className="activity-list">
          {entries.map((entry) => (
            <li key={entry.id} className={`activity-row ${entry.undone ? "is-undone" : ""}`}>
              <span className="activity-dot" aria-hidden />
              <div className="activity-body">
                <p>
                  <strong>{entry.ruleName}</strong> · {entry.summary}
                </p>
                <p className="muted small">
                  {findEvent(entry.event)?.label ?? entry.event} ·{" "}
                  <time dateTime={new Date(entry.at).toISOString()} title={new Date(entry.at).toLocaleString()}>
                    {formatAgo(entry.at, now)}
                  </time>
                </p>
              </div>
              {entry.undone ? (
                <span className="chip">Undone</span>
              ) : entry.canUndo ? (
                <button type="button" className="button is-small" disabled={busy === entry.id} onClick={() => undo(entry.id)}>
                  <Icon name="undo" size={12} /> Undo
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
