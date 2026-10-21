import { defaultAppSettings, parseAppSettings, type AppSettings } from "@opendock/config-schema";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { errorText, getSettings, on, saveSettings } from "./ipc";
import { SettingsContext } from "./settingsContext";

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((loaded) => !cancelled && setSettings(loaded))
      .catch(() => undefined)
      .finally(() => !cancelled && setReady(true));
    const off = on("settings:changed", setSettings);
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  const update = useCallback(
    async (change: (current: AppSettings) => AppSettings) => {
      let next: AppSettings;
      try {
        next = parseAppSettings(change(settings));
      } catch (error) {
        return errorText(error);
      }
      const previous = settings;
      setSettings(next);
      try {
        setSettings(await saveSettings(next));
        return null;
      } catch (error) {
        setSettings(previous);
        return errorText(error);
      }
    },
    [settings],
  );

  return (
    <SettingsContext.Provider value={{ settings, ready, update }}>{children}</SettingsContext.Provider>
  );
}
