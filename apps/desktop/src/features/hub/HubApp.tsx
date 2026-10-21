import { useEffect, useState } from "react";
import { getHubPage, on, type HubPage } from "../../services/ipc";
import { Icon, type IconName } from "../widgets/icons";
import { ActivityPage } from "./ActivityPage";
import { AppsPage } from "./AppsPage";
import { CalendarsPage } from "./CalendarsPage";
import { DockSettingsPage } from "./DockSettingsPage";
import { GalleryPage } from "./GalleryPage";
import { PrivacyPage } from "./PrivacyPage";
import { StudioPage } from "./studio/StudioPage";
import { WelcomePage } from "./WelcomePage";
import "./hub.css";

const NAV: { page: HubPage; label: string; icon: IconName; group: "Make" | "Settings" }[] = [
  { page: "widgets", label: "Widget gallery", icon: "grid", group: "Make" },
  { page: "automations", label: "Automation Studio", icon: "spark", group: "Make" },
  { page: "activity", label: "Activity", icon: "history", group: "Make" },
  { page: "apps", label: "Apps & taskbar", icon: "apps", group: "Settings" },
  { page: "dock", label: "Dock settings", icon: "dock", group: "Settings" },
  { page: "calendars", label: "Calendars", icon: "calendar", group: "Settings" },
  { page: "privacy", label: "Privacy ledger", icon: "shield", group: "Settings" },
];

export function HubApp() {
  const [page, setPage] = useState<HubPage>("widgets");

  useEffect(() => {
    void getHubPage()
      .then(setPage)
      .catch(() => undefined);
    return on("hub:navigate", setPage);
  }, []);

  if (page === "welcome") {
    return (
      <div className="hub is-welcome">
        <main className="hub-main">
          <WelcomePage onNavigate={setPage} />
        </main>
      </div>
    );
  }

  return (
    <div className="hub">
      <nav className="hub-nav" aria-label="OpenDock">
        <div className="hub-brand">
          <span className="hub-logo" aria-hidden>
            <Icon name="dock" size={18} />
          </span>
          <span>OpenDock</span>
        </div>
        {(["Make", "Settings"] as const).map((group) => (
          <div key={group} className="hub-nav-group">
            <p className="hub-nav-caption">{group}</p>
            {NAV.filter((n) => n.group === group).map((item) => (
              <button
                key={item.page}
                type="button"
                className={`hub-nav-item ${page === item.page ? "is-active" : ""}`}
                aria-current={page === item.page ? "page" : undefined}
                onClick={() => setPage(item.page)}
              >
                <Icon name={item.icon} size={16} />
                {item.label}
              </button>
            ))}
          </div>
        ))}
        <p className="hub-nav-foot">
          <Icon name="lock" size={12} /> Local-first · no telemetry
        </p>
      </nav>
      <main className="hub-main">
        {page === "widgets" ? <GalleryPage onNavigate={setPage} /> : null}
        {page === "automations" ? <StudioPage /> : null}
        {page === "activity" ? <ActivityPage /> : null}
        {page === "dock" ? <DockSettingsPage /> : null}
        {page === "apps" ? <AppsPage /> : null}
        {page === "calendars" ? <CalendarsPage /> : null}
        {page === "privacy" ? <PrivacyPage /> : null}
      </main>
    </div>
  );
}
