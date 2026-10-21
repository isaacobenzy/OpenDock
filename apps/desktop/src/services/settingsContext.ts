import { defaultAppSettings, type AppSettings } from "@opendock/config-schema";
import { createContext, useContext } from "react";

export type SettingsContextValue = {
  settings: AppSettings;
  ready: boolean;
  /** Validates, saves and applies. Resolves with an error message on failure. */
  update: (change: (current: AppSettings) => AppSettings) => Promise<string | null>;
};

export const SettingsContext = createContext<SettingsContextValue>({
  settings: defaultAppSettings,
  ready: true,
  update: async () => null,
});

export function useSettings() {
  return useContext(SettingsContext);
}
