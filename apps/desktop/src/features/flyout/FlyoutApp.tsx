import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@tauri-apps/api/core";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  broadcast,
  getFlyoutRequest,
  hideFlyout,
  on,
  resizeFlyout,
  type FlyoutRequest,
} from "../../services/ipc";
import { flyoutKey } from "../dock/dockClick";
import { findWidget } from "../widgets/catalog";
import { PanelState } from "../widgets/visuals";
import { DockMenu } from "./DockMenu";
import { AppPanel } from "./panels/AppPanel";
import { ClockPanel, DayProgressPanel } from "./panels/TimePanels";
import { FocusPanel } from "./panels/FocusPanel";
import { LauncherPanel } from "./panels/LauncherPanel";
import { MediaPanel } from "./panels/MediaPanel";
import { NotesPanel } from "./panels/NotesPanel";
import { BatteryPanel, SystemPanel } from "./panels/SystemPanels";
import { TodosPanel } from "./panels/TodosPanel";
import { VolumePanel } from "./panels/VolumePanel";
import { WeatherPanel } from "./panels/WeatherPanel";
import { CalendarPanel } from "./panels/CalendarPanel";
import "./flyout.css";

function close(key: string | undefined) {
  void hideFlyout();
  broadcast("flyout:hidden", { kind: key ?? "", at: Date.now() });
}

function Panel({ request, onDone }: { request: FlyoutRequest; onDone: () => void }) {
  switch (request.kind) {
    case "menu":
      return <DockMenu target={request.target ?? null} onDone={onDone} />;
    case "start":
      return <LauncherPanel onDone={onDone} />;
    case "app":
      return <AppPanel target={request.target ?? null} onDone={onDone} />;
    case "volume":
      return <VolumePanel />;
    case "clock":
      return <ClockPanel />;
    case "media":
      return <MediaPanel />;
    case "focus":
      return <FocusPanel />;
    case "system":
      return <SystemPanel />;
    case "battery":
      return <BatteryPanel />;
    case "weather":
      return <WeatherPanel />;
    case "calendar":
      return <CalendarPanel />;
    case "todos":
      return <TodosPanel />;
    case "notes":
      return <NotesPanel />;
    case "day-progress":
      return <DayProgressPanel />;
    default:
      return <PanelState kind="error" title="This widget has no panel" />;
  }
}

function titleFor(request: FlyoutRequest | null): string {
  if (!request) return "";
  if (request.kind === "menu") return "Dock";
  if (request.kind === "start") return "Start";
  if (request.kind === "app") return "App windows";
  return findWidget(request.kind)?.name ?? request.kind;
}

export function FlyoutApp() {
  const [request, setRequest] = useState<FlyoutRequest | null>(null);
  const [opened, setOpened] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const keyRef = useRef<string | undefined>(undefined);
  keyRef.current = request ? flyoutKey(request.kind, request.target ?? undefined) : undefined;

  useEffect(() => {
    void getFlyoutRequest()
      .then((r) => r && setRequest(r))
      .catch(() => undefined);
    const off = on("flyout:show", (r) => {
      setRequest(r);
      setOpened((n) => n + 1);
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(keyRef.current);
    };
    window.addEventListener("keydown", onKey);
    let offFocus: (() => void) | undefined;
    if (isTauri()) {
      void getCurrentWindow()
        .onFocusChanged(({ payload: focused }) => {
          if (!focused) close(keyRef.current);
        })
        .then((fn) => (offFocus = fn));
    }
    return () => {
      off();
      offFocus?.();
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      void resizeFlyout(Math.ceil(content.scrollHeight)).catch(() => undefined);
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [request?.kind]);

  return (
    <div className="flyout-frame" ref={contentRef}>
      <div className={`flyout-panel kind-${request?.kind ?? "none"}`} key={opened} role="dialog" aria-label={titleFor(request)}>
        {request ? (
          <Panel request={request} onDone={() => close(keyRef.current)} />
        ) : (
          <PanelState kind="loading" title="Opening" />
        )}
      </div>
    </div>
  );
}
