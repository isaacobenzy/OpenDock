import type { ReactNode } from "react";
import { Icon } from "./icons";

export function Ring({
  value,
  size = 28,
  stroke = 3,
  tone = "accent",
  children,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: "accent" | "warn" | "info";
  children?: ReactNode;
  label?: string;
}) {
  const clamped = Math.min(1, Math.max(0, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span
      className={`od-ring tone-${tone}`}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle className="od-ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className="od-ring-value"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children ? <span className="od-ring-label">{children}</span> : null}
    </span>
  );
}

export function Sparkline({
  values,
  width = 56,
  height = 20,
  max = 100,
}: {
  values: number[];
  width?: number;
  height?: number;
  max?: number;
}) {
  if (values.length < 2) {
    return <span className="od-sparkline is-empty" style={{ width, height }} aria-hidden />;
  }
  const step = width / (values.length - 1);
  const points = values.map((v, i) => {
    const y = height - (Math.min(max, Math.max(0, v)) / max) * (height - 2) - 1;
    return `${(i * step).toFixed(1)},${y.toFixed(1)}`;
  });
  const area = `0,${height} ${points.join(" ")} ${width},${height}`;
  return (
    <svg className="od-sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polygon className="od-sparkline-area" points={area} />
      <polyline className="od-sparkline-line" points={points.join(" ")} />
    </svg>
  );
}

export function Bar({ value, tone = "accent", label }: { value: number; tone?: "accent" | "warn"; label?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <span
      className={`od-bar tone-${tone}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
    >
      <span className="od-bar-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}

/** Shared empty, loading and error states for panels. */
export function PanelState({
  kind,
  title,
  detail,
  action,
}: {
  kind: "loading" | "empty" | "error";
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className={`panel-state is-${kind}`} role={kind === "error" ? "alert" : "status"}>
      {kind === "loading" ? (
        <span className="od-spinner" aria-hidden />
      ) : (
        <Icon name={kind === "error" ? "warning" : "spark"} size={22} />
      )}
      <p className="panel-state-title">{title}</p>
      {detail ? <p className="panel-state-detail">{detail}</p> : null}
      {action}
    </div>
  );
}

export function Skeleton({ width = 48 }: { width?: number }) {
  return <span className="od-skeleton" style={{ width }} aria-hidden />;
}
