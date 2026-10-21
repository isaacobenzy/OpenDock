import { useLive } from "../../../services/liveContext";
import { formatPercent } from "../../widgets/format";
import { Icon } from "../../widgets/icons";
import { Bar, PanelState, Ring, Sparkline } from "../../widgets/visuals";
import { PanelHeader } from "./PanelHeader";

export function SystemPanel() {
  const { stats, cpuHistory, memoryHistory } = useLive();
  if (stats.status === "loading") return <PanelState kind="loading" title="Sampling the system" />;
  if (stats.status === "error") return <PanelState kind="error" title="System stats are unavailable" detail={stats.error} />;
  if (stats.data === null) {
    return <PanelState kind="empty" title="No samples yet" detail="The first reading arrives within a few seconds." />;
  }
  const s = stats.data;
  return (
    <>
      <PanelHeader icon="cpu" title="System" subtitle="Sampled every 2 seconds, never sent anywhere" />
      <div className="stat-grid">
        <div className="stat-card">
          <Ring value={(s.cpu ?? 0) / 100} size={64} stroke={6} tone={(s.cpu ?? 0) > 85 ? "warn" : "accent"}>
            <span className="tabular">{formatPercent(s.cpu)}</span>
          </Ring>
          <div>
            <p className="stat-label">CPU</p>
            <Sparkline values={cpuHistory} width={120} height={32} />
          </div>
        </div>
        <div className="stat-card">
          <Ring value={(s.memory ?? 0) / 100} size={64} stroke={6} tone={(s.memory ?? 0) > 85 ? "warn" : "info"}>
            <span className="tabular">{formatPercent(s.memory)}</span>
          </Ring>
          <div>
            <p className="stat-label">Memory</p>
            <p className="muted tabular">
              {s.memoryUsedGb !== null && s.memoryTotalGb !== null
                ? `${s.memoryUsedGb.toFixed(1)} of ${s.memoryTotalGb.toFixed(1)} GB`
                : "–"}
            </p>
            <Sparkline values={memoryHistory} width={120} height={20} />
          </div>
        </div>
      </div>
      {s.battery ? (
        <section className="panel-section">
          <h2>Battery</h2>
          <div className="battery-row">
            <Bar value={s.battery.percent / 100} tone={s.battery.percent <= 20 && !s.battery.charging ? "warn" : "accent"} label="Battery" />
            <span className="tabular">{s.battery.percent}%</span>
          </div>
        </section>
      ) : null}
    </>
  );
}

export function BatteryPanel() {
  const { stats } = useLive();
  if (stats.status === "loading") return <PanelState kind="loading" title="Reading the battery" />;
  if (stats.status === "error") return <PanelState kind="error" title="Battery is unavailable" detail={stats.error} />;
  const battery = stats.data?.battery;
  if (!battery) {
    return (
      <>
        <PanelHeader icon="battery" title="Battery" />
        <PanelState kind="empty" title="No battery found" detail="This device runs on mains power." />
      </>
    );
  }
  const low = battery.percent <= 20 && !battery.charging;
  return (
    <>
      <PanelHeader icon="battery" title="Battery" subtitle={battery.charging ? "Charging" : "On battery"} />
      <div className="battery-hero">
        <Ring value={battery.percent / 100} size={112} stroke={8} tone={low ? "warn" : "accent"}>
          <span className="focus-time tabular">{battery.percent}%</span>
          {battery.charging ? <Icon name="bolt" size={14} /> : null}
        </Ring>
      </div>
      {low ? (
        <p className="callout is-warn">
          <Icon name="warning" size={16} /> Battery is low. Plug in soon.
        </p>
      ) : null}
    </>
  );
}
