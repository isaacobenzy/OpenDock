import { removeDockItem, type AppSettings } from "@opendock/config-schema";
import { useState } from "react";
import { openHub, quitApp, type HubPage } from "../../services/ipc";
import { useSettings } from "../../services/settingsContext";
import { ADD_WIDGET_ID, findWidget } from "../widgets/catalog";
import { Icon, type IconName } from "../widgets/icons";

type Segment<T extends string> = { value: T; label: string };

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Segment<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="menu-row">
      <span className="menu-row-label">{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className={value === option.value ? "is-active" : ""}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button type="button" className={`menu-item ${danger ? "is-danger" : ""}`} onClick={onClick}>
      <Icon name={icon} size={16} />
      <span>{label}</span>
    </button>
  );
}

export function DockMenu({ target, onDone }: { target: string | null; onDone: () => void }) {
  const { settings, update } = useSettings();
  const [error, setError] = useState<string | null>(null);
  const widget = target && target !== ADD_WIDGET_ID ? findWidget(target) : undefined;

  const change = (fn: (s: AppSettings) => AppSettings) => {
    void update(fn).then(setError);
  };
  const go = (page: HubPage) => {
    void openHub(page);
    onDone();
  };

  return (
    <div className="dock-menu">
      {widget ? (
        <section className="menu-section">
          <p className="menu-caption">{widget.name}</p>
          <MenuItem
            icon="trash"
            label={`Remove ${widget.name} from the dock`}
            onClick={() => {
              change((s) => ({
                ...s,
                dock: { ...s.dock, itemOrder: removeDockItem(s.dock.itemOrder, widget.id) },
              }));
              onDone();
            }}
          />
          {widget.configure ? (
            <MenuItem icon="settings" label={`Set up ${widget.name}`} onClick={() => go(widget.configure!)} />
          ) : null}
        </section>
      ) : null}

      <section className="menu-section">
        <p className="menu-caption">Look</p>
        <Segmented
          label="Size"
          value={settings.dock.size}
          options={[
            { value: "s", label: "S" },
            { value: "m", label: "M" },
            { value: "l", label: "L" },
          ]}
          onChange={(size) => change((s) => ({ ...s, dock: { ...s.dock, size } }))}
        />
        <Segmented
          label="Theme"
          value={settings.dock.theme}
          options={[
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
          ]}
          onChange={(theme) => change((s) => ({ ...s, dock: { ...s.dock, theme } }))}
        />
        <Segmented
          label="Style"
          value={settings.dock.style}
          options={[
            { value: "glass", label: "Glass" },
            { value: "solid", label: "Solid" },
            { value: "midnight", label: "Midnight" },
          ]}
          onChange={(style) => change((s) => ({ ...s, dock: { ...s.dock, style } }))}
        />
        <Segmented
          label="Taskbar"
          value={settings.taskbar.mode}
          options={[
            { value: "replace", label: "Replace" },
            { value: "autohide", label: "Auto" },
            { value: "normal", label: "Show" },
          ]}
          onChange={(mode) => change((s) => ({ ...s, taskbar: { mode } }))}
        />
      </section>

      <section className="menu-section">
        <MenuItem icon="grid" label="Widget gallery" onClick={() => go("widgets")} />
        <MenuItem icon="spark" label="Automation Studio" onClick={() => go("automations")} />
        <MenuItem icon="apps" label="Apps & taskbar" onClick={() => go("apps")} />
        <MenuItem icon="settings" label="Dock settings" onClick={() => go("dock")} />
      </section>

      <section className="menu-section">
        <MenuItem icon="power" label="Quit OpenDock" danger onClick={() => void quitApp()} />
      </section>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
