import type { AppSettings, DockMode, DockPosition, DockSize, Theme } from "@opendock/config-schema";

type Props = {
  x: number;
  y: number;
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
  onClose: () => void;
  onQuit: () => void;
};

const positions: DockPosition[] = ["top", "bottom", "left", "right"];
const sizes: DockSize[] = ["s", "m", "l"];
const modes: DockMode[] = ["pill", "full"];
const themes: Theme[] = ["dark", "light"];

export function DockContextMenu({ x, y, settings, onChange, onClose, onQuit }: Props) {
  const updateDock = (partial: Partial<AppSettings["dock"]>) => {
    onChange({
      ...settings,
      dock: { ...settings.dock, ...partial },
    });
  };

  return (
    <div
      className="dock-context-menu"
      style={{ left: x, top: y }}
      role="menu"
      tabIndex={-1}
      aria-label="Dock menu"
      onContextMenu={(e) => e.preventDefault()}
    >
      <section>
        <p className="menu-label">Position</p>
        {positions.map((position) => (
          <button
            key={position}
            type="button"
            role="menuitemradio"
            aria-checked={settings.dock.position === position}
            onClick={() => updateDock({ position })}
          >
            {position}
          </button>
        ))}
      </section>
      <section>
        <p className="menu-label">Size</p>
        {sizes.map((size) => (
          <button
            key={size}
            type="button"
            role="menuitemradio"
            aria-checked={settings.dock.size === size}
            onClick={() => updateDock({ size })}
          >
            {size.toUpperCase()}
          </button>
        ))}
      </section>
      <section>
        <p className="menu-label">Width</p>
        {modes.map((mode) => (
          <button
            key={mode}
            type="button"
            role="menuitemradio"
            aria-checked={settings.dock.mode === mode}
            onClick={() => updateDock({ mode })}
          >
            {mode}
          </button>
        ))}
      </section>
      <section>
        <p className="menu-label">Theme</p>
        {themes.map((theme) => (
          <button
            key={theme}
            type="button"
            role="menuitemradio"
            aria-checked={settings.dock.theme === theme}
            onClick={() => updateDock({ theme })}
          >
            {theme}
          </button>
        ))}
      </section>
      <section>
        <label className="menu-toggle">
          <input
            type="checkbox"
            checked={settings.dock.clock24h}
            onChange={(e) => updateDock({ clock24h: e.target.checked })}
          />
          24-hour clock
        </label>
        <label className="menu-toggle">
          <input
            type="checkbox"
            checked={settings.dock.launchAtStartup}
            onChange={(e) => updateDock({ launchAtStartup: e.target.checked })}
          />
          Launch at startup
        </label>
      </section>
      <section className="menu-actions">
        <button type="button" role="menuitem" onClick={onClose}>
          Close menu
        </button>
        <button type="button" role="menuitem" className="danger" onClick={onQuit}>
          Quit OpenDock
        </button>
      </section>
    </div>
  );
}
