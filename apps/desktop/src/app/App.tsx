import { defaultAppSettings, type AppSettings } from "@opendock/config-schema";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { DockBar } from "../features/dock/DockBar";
import { applyDockLayout, getCurrentMonitorId, getSettings } from "../services/ipc";
import "../styles/tokens.css";

export function App() {
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const loaded = await getSettings();
        const monitorId = await getCurrentMonitorId();
        const withMonitor =
          loaded.dock.monitorId == null && monitorId
            ? { ...loaded, dock: { ...loaded.dock, monitorId } }
            : loaded;
        if (!cancelled) {
          setSettings(withMonitor);
          setReady(true);
        }
        await applyDockLayout();
      } catch {
        if (!cancelled) {
          setSettings(defaultAppSettings);
          setReady(true);
        }
      }
    }

    void bootstrap();

    const unsubs: Array<() => void> = [];
    void listen("dock:fullscreen-hidden", () => undefined).then((u) => unsubs.push(u));
    void listen("dock:fullscreen-visible", () => {
      void applyDockLayout();
    }).then((u) => unsubs.push(u));

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, []);

  if (!ready) {
    return null;
  }

  return <DockBar settings={settings} onSettingsChange={setSettings} />;
}
