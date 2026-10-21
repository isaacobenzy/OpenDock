import { useEffect, type ReactNode } from "react";
import { DockBar } from "../features/dock/DockBar";
import { FlyoutApp } from "../features/flyout/FlyoutApp";
import { HubApp } from "../features/hub/HubApp";
import { ToastApp } from "../features/toast/ToastApp";
import { LiveDataProvider } from "../services/live";
import { SettingsProvider } from "../services/settings";
import { useSettings } from "../services/settingsContext";
import "../styles/tokens.css";
import "../styles/base.css";

export type WindowKind = "main" | "hub" | "flyout" | "toast";

/** Mirrors the dock's theme and style onto the document so every window matches. */
function Themed({ kind, children }: { kind: WindowKind; children: ReactNode }) {
  const { settings, ready } = useSettings();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.window = kind;
    root.dataset.theme = settings.dock.theme;
    root.dataset.style = settings.dock.style;
  }, [kind, settings.dock.theme, settings.dock.style]);
  return ready ? <>{children}</> : null;
}

export function App({ kind }: { kind: WindowKind }) {
  if (kind === "toast") {
    return (
      <SettingsProvider>
        <Themed kind={kind}>
          <ToastApp />
        </Themed>
      </SettingsProvider>
    );
  }
  return (
    <SettingsProvider>
      <LiveDataProvider>
        <Themed kind={kind}>
          {kind === "hub" ? <HubApp /> : kind === "flyout" ? <FlyoutApp /> : <DockBar />}
        </Themed>
      </LiveDataProvider>
    </SettingsProvider>
  );
}
