import { pinApp, type DockStyle, type TaskbarMode, type Theme } from "@opendock/config-schema";
import { useEffect, useState } from "react";
import { errorText, listTaskbarPins, setLaunchAtStartup, type HubPage, type ShellApp } from "../../services/ipc";
import { failed, loading, ready, type Loadable } from "../../services/loadable";
import { useSettings } from "../../services/settingsContext";
import { AppIcon } from "../apps/AppIcon";
import { toPinned } from "../apps/model";
import { Icon } from "../widgets/icons";
import { Choice, Row, TaskbarOptions, Toggle } from "./controls";

const STEPS = ["Taskbar", "Your apps", "Look and feel"] as const;

export function WelcomePage({ onNavigate }: { onNavigate: (page: HubPage) => void }) {
  const { settings, update } = useSettings();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<TaskbarMode>("replace");
  const [pins, setPins] = useState<Loadable<ShellApp[]>>(loading);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [style, setStyle] = useState<DockStyle>(settings.dock.style);
  const [theme, setTheme] = useState<Theme>(settings.dock.theme);
  const [startup, setStartup] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTaskbarPins()
      .then((found) => {
        setPins(ready(found));
        setChosen(new Set(found.map((app) => app.path)));
      })
      .catch((e) => setPins(failed(errorText(e))));
  }, []);

  const toggle = (path: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const finish = async () => {
    setSaving(true);
    const picked = pins.status === "ready" ? pins.data.filter((app) => chosen.has(app.path)) : [];
    const problem = await update((s) => ({
      ...s,
      onboarded: true,
      taskbar: { mode },
      dock: { ...s.dock, style, theme },
      apps: { ...s.apps, pinned: picked.reduce((list, app) => pinApp(list, toPinned(app)), s.apps.pinned) },
    }));
    if (!problem) await setLaunchAtStartup(startup).catch(() => undefined);
    setSaving(false);
    if (problem) setError(problem);
    else onNavigate("widgets");
  };

  const skip = () => {
    void update((s) => ({ ...s, onboarded: true })).then((problem) => (problem ? setError(problem) : onNavigate("widgets")));
  };

  return (
    <div className="welcome">
      <header className="welcome-hero">
        <span className="hub-logo is-large" aria-hidden>
          <Icon name="dock" size={26} />
        </span>
        <div>
          <h1>Welcome to OpenDock</h1>
          <p className="muted">A calmer taskbar with your apps, widgets and automations. Three quick choices and you're set.</p>
        </div>
        <button type="button" className="text-button" onClick={skip}>
          Skip setup
        </button>
      </header>

      <ol className="welcome-steps" aria-label="Setup steps">
        {STEPS.map((label, index) => (
          <li key={label} className={index === step ? "is-current" : index < step ? "is-done" : ""}>
            <span className="welcome-step-dot">{index < step ? <Icon name="check" size={12} /> : index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {error ? <p className="callout is-error" role="alert">{error}</p> : null}

      <section className="settings-card welcome-card">
        {step === 0 ? (
          <>
            <h2>What should happen to the Windows taskbar?</h2>
            <p className="muted small">You can change this any time. The original taskbar always comes back if OpenDock quits or is uninstalled.</p>
            <TaskbarOptions value={mode} onChange={setMode} only={["replace", "autohide", "normal"]} />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h2>Bring your pinned apps</h2>
            <p className="muted small">These are pinned on your Windows taskbar today. Untick any you don't want on the dock.</p>
            {pins.status === "loading" ? <p className="muted small">Reading your taskbar…</p> : null}
            {pins.status === "error" ? <p className="callout is-warn">{pins.error}</p> : null}
            {pins.status === "ready" && pins.data.length === 0 ? (
              <p className="muted small">No pinned apps found. You can pin apps later from the launcher or Apps & taskbar.</p>
            ) : null}
            {pins.status === "ready" && pins.data.length > 0 ? (
              <ul className="import-grid">
                {pins.data.map((app) => (
                  <li key={app.path}>
                    <label className={`import-tile ${chosen.has(app.path) ? "is-checked" : ""}`}>
                      <input type="checkbox" checked={chosen.has(app.path)} onChange={() => toggle(app.path)} />
                      <AppIcon path={app.path} name={app.name} size={30} />
                      <span>{app.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2>Make it yours</h2>
            <Row label="Style">
              <div className="style-swatches" role="radiogroup" aria-label="Style">
                {(["glass", "solid", "midnight"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={style === option}
                    className={`style-swatch style-${option} ${style === option ? "is-active" : ""}`}
                    onClick={() => setStyle(option)}
                  >
                    <span className="style-swatch-art" aria-hidden />
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>
            </Row>
            <Row label="Theme">
              <Choice
                label="Theme"
                value={theme}
                options={[
                  { value: "dark", label: "Dark" },
                  { value: "light", label: "Light" },
                ]}
                onChange={setTheme}
              />
            </Row>
            <Row label="Start with Windows" hint="Recommended when OpenDock replaces the taskbar.">
              <Toggle label="Start with Windows" checked={startup} onChange={setStartup} />
            </Row>
          </>
        ) : null}
      </section>

      <footer className="welcome-nav">
        <button type="button" className="button" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" className="button is-primary" onClick={() => setStep((s) => s + 1)}>
            Continue
          </button>
        ) : (
          <button type="button" className="button is-primary" disabled={saving} onClick={() => void finish()}>
            {saving ? "Setting up…" : "Finish"}
          </button>
        )}
      </footer>
    </div>
  );
}
