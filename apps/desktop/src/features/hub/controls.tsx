import type { TaskbarMode } from "@opendock/config-schema";
import type { ReactNode } from "react";

export function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="setting-row">
      <div className="setting-label">
        <p>{label}</p>
        {hint ? <p className="muted small">{hint}</p> : null}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}

export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? "is-active" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track" aria-hidden />
    </label>
  );
}

const TASKBAR_OPTIONS: { value: TaskbarMode; title: string; detail: string; recommended?: boolean }[] = [
  {
    value: "replace",
    title: "Replace the taskbar",
    detail: "OpenDock becomes your taskbar: open apps, Start, sound and tray live in the dock, and windows make room for it.",
    recommended: true,
  },
  { value: "autohide", title: "Auto-hide", detail: "The taskbar slides away and returns when you point at the edge." },
  { value: "normal", title: "Keep the taskbar", detail: "Windows works as usual alongside the dock." },
  { value: "hidden", title: "Hide completely", detail: "Hide the taskbar without reserving room for the dock." },
];

export function TaskbarOptions({
  value,
  onChange,
  only,
}: {
  value: TaskbarMode;
  onChange: (mode: TaskbarMode) => void;
  only?: TaskbarMode[];
}) {
  const options = only ? TASKBAR_OPTIONS.filter((o) => only.includes(o.value)) : TASKBAR_OPTIONS;
  return (
    <div className="option-cards" role="radiogroup" aria-label="Taskbar">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={`option-card ${value === option.value ? "is-active" : ""}`}
          onClick={() => onChange(option.value)}
        >
          <span className={`taskbar-art mode-${option.value}`} aria-hidden>
            <span className="taskbar-art-dock" />
            <span className="taskbar-art-bar" />
          </span>
          <strong>
            {option.title}
            {option.recommended ? <span className="badge is-accent">Recommended</span> : null}
          </strong>
          <span className="muted small">{option.detail}</span>
        </button>
      ))}
    </div>
  );
}
