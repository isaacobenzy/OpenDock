import { useEffect, useState } from "react";
import { errorText, getPrivacyLedger, on, type LedgerRow } from "../../services/ipc";
import { useNow } from "../../services/liveContext";
import { widgetCatalog } from "../widgets/catalog";
import { formatAgo } from "../widgets/format";
import { Icon } from "../widgets/icons";
import { PanelState } from "../widgets/visuals";
import { PageHeader } from "./PageHeader";

export function PrivacyPage() {
  const [rows, setRows] = useState<LedgerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = useNow(30_000);

  useEffect(() => {
    const load = () =>
      getPrivacyLedger()
        .then(setRows)
        .catch((e) => setError(errorText(e)));
    load();
    const offs = [on("weather:update", load), on("data:changed", (t) => t === "calendar" && load())];
    return () => offs.forEach((off) => off());
  }, []);

  const networked = widgetCatalog.filter((w) => w.network.length > 0);

  return (
    <div className="page">
      <PageHeader title="Privacy ledger" subtitle="Every host OpenDock has contacted, and why." />

      <div className="promise-grid">
        <div className="promise">
          <Icon name="shield" size={18} />
          <p>
            <strong>No telemetry.</strong> OpenDock sends no analytics, crash reports or usage data.
          </p>
        </div>
        <div className="promise">
          <Icon name="lock" size={18} />
          <p>
            <strong>Secrets stay in the keychain.</strong> Calendar links are stored in the Windows Credential Manager.
          </p>
        </div>
        <div className="promise">
          <Icon name="spark" size={18} />
          <p>
            <strong>Automations run locally.</strong> Rules, todos, notes and history live in a database on this device.
          </p>
        </div>
      </div>

      <section className="settings-card">
        <h2>Network requests</h2>
        {error ? <p className="callout is-error">{error}</p> : null}
        {rows === null && !error ? (
          <PanelState kind="loading" title="Loading the ledger" />
        ) : rows && rows.length === 0 ? (
          <p className="muted">OpenDock hasn't contacted any server yet.</p>
        ) : rows ? (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Widget</th>
                <th scope="col">Host</th>
                <th scope="col">Requests</th>
                <th scope="col">Failed</th>
                <th scope="col">Last</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.widget}-${row.host}`}>
                  <td>{widgetCatalog.find((w) => w.id === row.widget)?.name ?? row.widget}</td>
                  <td className="mono">{row.host}</td>
                  <td className="tabular">{row.requests}</td>
                  <td className={`tabular ${row.failures > 0 ? "text-warn" : ""}`}>{row.failures}</td>
                  <td>{formatAgo(row.lastAt, now)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className="settings-card">
        <h2>Widgets that can use the network</h2>
        <ul className="plain-list">
          {networked.map((w) => (
            <li key={w.id}>
              <strong>{w.name}</strong> <span className="muted">— {w.network.join(", ")}</span>
            </li>
          ))}
        </ul>
        <p className="muted small">Every other widget only reads this device.</p>
      </section>
    </div>
  );
}
