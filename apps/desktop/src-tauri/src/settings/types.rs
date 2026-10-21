use serde::{Deserialize, Serialize};

use crate::engine::rules::{is_valid_id, parse_clock};
use crate::geometry::{DockMode, DockPosition, DockSize};

pub const SETTINGS_VERSION: u32 = 3;
pub const MAX_PINNED_APPS: usize = 24;

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    #[default]
    Dark,
    Light,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum DockStyle {
    #[default]
    Glass,
    Solid,
    Midnight,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum TaskbarMode {
    #[default]
    Normal,
    Autohide,
    Hidden,
    /// Hidden, and the dock reserves the screen edge the way the taskbar did.
    Replace,
}

impl TaskbarMode {
    pub fn hides_taskbar(self) -> bool {
        matches!(self, TaskbarMode::Hidden | TaskbarMode::Replace)
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum StartAction {
    /// OpenDock's own launcher with search, pinned apps and power options.
    #[default]
    Launcher,
    Windows,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum TemperatureUnit {
    #[default]
    C,
    F,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DockSettings {
    pub position: DockPosition,
    pub size: DockSize,
    pub mode: DockMode,
    pub theme: Theme,
    #[serde(default)]
    pub style: DockStyle,
    #[serde(default)]
    pub monitor_id: Option<String>,
    pub item_order: Vec<String>,
    pub clock24h: bool,
    pub launch_at_startup: bool,
    #[serde(default = "default_true")]
    pub auto_hide_in_fullscreen: bool,
    #[serde(default)]
    pub start_action: StartAction,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PinnedApp {
    pub name: String,
    /// What gets launched: a shortcut, an executable or a URI.
    pub path: String,
    /// The executable behind a shortcut, so running windows group under the pin.
    #[serde(default)]
    pub target: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct AppsSettings {
    pub pinned: Vec<PinnedApp>,
    /// One icon per app with a window count, instead of one per window.
    pub group_windows: bool,
    /// Show the active window's title next to its icon.
    pub show_titles: bool,
}

impl Default for AppsSettings {
    fn default() -> Self {
        Self {
            pinned: Vec::new(),
            group_windows: true,
            show_titles: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct TaskbarSettings {
    #[serde(default)]
    pub mode: TaskbarMode,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct WeatherSettings {
    #[serde(default)]
    pub city: String,
    #[serde(default)]
    pub latitude: Option<f64>,
    #[serde(default)]
    pub longitude: Option<f64>,
    #[serde(default)]
    pub unit: TemperatureUnit,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct FocusSettings {
    pub focus_minutes: u32,
    pub break_minutes: u32,
}

impl Default for FocusSettings {
    fn default() -> Self {
        Self {
            focus_minutes: 25,
            break_minutes: 5,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct WidgetSettings {
    #[serde(default)]
    pub weather: WeatherSettings,
    #[serde(default)]
    pub focus: FocusSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct QuietHours {
    pub enabled: bool,
    pub start: String,
    pub end: String,
}

impl Default for QuietHours {
    fn default() -> Self {
        Self {
            enabled: false,
            start: "22:00".into(),
            end: "07:00".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AutomationSettings {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub quiet_hours: QuietHours,
}

impl Default for AutomationSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            quiet_hours: QuietHours::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub version: u32,
    pub dock: DockSettings,
    #[serde(default)]
    pub taskbar: TaskbarSettings,
    #[serde(default)]
    pub widgets: WidgetSettings,
    #[serde(default)]
    pub automation: AutomationSettings,
    #[serde(default)]
    pub apps: AppsSettings,
    /// False until the first-run welcome has been completed or skipped.
    #[serde(default)]
    pub onboarded: bool,
}

pub const DEFAULT_ITEM_ORDER: [&str; 7] = [
    "start",
    "apps",
    "media",
    "clock",
    "volume",
    "tray",
    "add-widget",
];

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            version: SETTINGS_VERSION,
            dock: DockSettings {
                position: DockPosition::Bottom,
                size: DockSize::M,
                mode: DockMode::Pill,
                theme: Theme::Dark,
                style: DockStyle::Glass,
                monitor_id: None,
                item_order: DEFAULT_ITEM_ORDER.iter().map(|s| s.to_string()).collect(),
                clock24h: false,
                launch_at_startup: false,
                auto_hide_in_fullscreen: true,
                start_action: StartAction::Launcher,
            },
            taskbar: TaskbarSettings::default(),
            widgets: WidgetSettings::default(),
            automation: AutomationSettings::default(),
            apps: AppsSettings::default(),
            onboarded: false,
        }
    }
}

impl AppSettings {
    /// Upgrades an older settings document in place. Returns true if anything changed.
    pub fn migrate(value: &mut serde_json::Value) -> bool {
        let version = value.get("version").and_then(|v| v.as_u64());
        if !matches!(version, Some(1) | Some(2)) {
            return false;
        }
        value["version"] = serde_json::json!(SETTINGS_VERSION);
        // People upgrading already set the dock up; don't greet them as new.
        value["onboarded"] = serde_json::json!(true);
        if let Some(order) = value
            .pointer_mut("/dock/itemOrder")
            .and_then(|o| o.as_array_mut())
        {
            if order.len() < 32 && !order.iter().any(|id| id == "apps") {
                let at = order
                    .iter()
                    .position(|id| id == "start")
                    .map_or(0, |i| i + 1);
                order.insert(at, serde_json::json!("apps"));
            }
        }
        true
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.version != SETTINGS_VERSION {
            return Err(format!("unsupported settings version {}", self.version));
        }
        let order = &self.dock.item_order;
        if order.is_empty() || order.len() > 32 {
            return Err("itemOrder must contain 1-32 entries".into());
        }
        for (index, id) in order.iter().enumerate() {
            if !is_valid_id(id) {
                return Err(format!("invalid dock item id: {id}"));
            }
            if order[..index].contains(id) {
                return Err(format!("duplicate dock item id: {id}"));
            }
        }
        if self.dock.monitor_id.as_ref().is_some_and(|m| m.len() > 256) {
            return Err("monitorId is too long".into());
        }
        let weather = &self.widgets.weather;
        if weather.city.chars().count() > 120 {
            return Err("weather city is too long".into());
        }
        if weather
            .latitude
            .is_some_and(|v| !(-90.0..=90.0).contains(&v))
        {
            return Err("latitude out of range".into());
        }
        if weather
            .longitude
            .is_some_and(|v| !(-180.0..=180.0).contains(&v))
        {
            return Err("longitude out of range".into());
        }
        let focus = &self.widgets.focus;
        if !(1..=180).contains(&focus.focus_minutes) || !(1..=60).contains(&focus.break_minutes) {
            return Err("focus lengths out of range".into());
        }
        let quiet = &self.automation.quiet_hours;
        if parse_clock(&quiet.start).is_none() || parse_clock(&quiet.end).is_none() {
            return Err("quiet hours need HH:MM times".into());
        }
        let pinned = &self.apps.pinned;
        if pinned.len() > MAX_PINNED_APPS {
            return Err(format!("at most {MAX_PINNED_APPS} pinned apps"));
        }
        for (index, app) in pinned.iter().enumerate() {
            if app.name.trim().is_empty() || app.name.chars().count() > 120 {
                return Err("pinned app names must be 1-120 characters".into());
            }
            if app.path.is_empty() || app.path.chars().count() > 1024 {
                return Err("pinned app paths must be 1-1024 characters".into());
            }
            if app
                .target
                .as_ref()
                .is_some_and(|t| t.chars().count() > 1024)
            {
                return Err("pinned app target is too long".into());
            }
            let key = app.path.to_lowercase();
            if pinned[..index].iter().any(|p| p.path.to_lowercase() == key) {
                return Err(format!("{} is pinned twice", app.name));
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    #[derive(Deserialize)]
    struct Fixture {
        valid: Vec<Value>,
        invalid: Vec<Value>,
    }

    fn parse(value: &Value) -> Result<AppSettings, String> {
        let settings: AppSettings =
            serde_json::from_value(value.clone()).map_err(|e| e.to_string())?;
        settings.validate()?;
        Ok(settings)
    }

    #[test]
    fn parity_with_zod_settings_fixtures() {
        let fixture: Fixture = serde_json::from_str(include_str!(
            "../../../../../packages/config-schema/fixtures/settings.json"
        ))
        .unwrap();
        for value in &fixture.valid {
            parse(value).unwrap_or_else(|e| panic!("{value}: {e}"));
        }
        for value in &fixture.invalid {
            assert!(parse(value).is_err(), "expected invalid: {value}");
        }
    }

    #[test]
    fn defaults_are_valid() {
        AppSettings::default().validate().unwrap();
    }

    #[test]
    fn migrates_version_one() {
        let mut value = serde_json::json!({
            "version": 1,
            "dock": {
                "position": "top", "size": "s", "mode": "full", "theme": "light",
                "monitorId": null, "itemOrder": ["clock", "add-widget"],
                "clock24h": true, "launchAtStartup": false
            }
        });
        assert!(AppSettings::migrate(&mut value));
        let settings = parse(&value).unwrap();
        assert_eq!(settings.dock.style, DockStyle::Glass);
        assert_eq!(settings.taskbar.mode, TaskbarMode::Normal);
        assert!(settings.dock.auto_hide_in_fullscreen);
        assert_eq!(
            settings.dock.item_order,
            vec!["apps", "clock", "add-widget"]
        );
        assert!(settings.onboarded);
    }

    #[test]
    fn migrates_version_two_and_puts_apps_after_start() {
        let mut value = serde_json::json!({
            "version": 2,
            "dock": {
                "position": "bottom", "size": "m", "mode": "pill", "theme": "dark",
                "style": "glass", "monitorId": null,
                "itemOrder": ["start", "clock", "add-widget"],
                "clock24h": false, "launchAtStartup": true, "autoHideInFullscreen": true
            },
            "taskbar": { "mode": "hidden" }
        });
        assert!(AppSettings::migrate(&mut value));
        let settings = parse(&value).unwrap();
        assert_eq!(
            settings.dock.item_order,
            vec!["start", "apps", "clock", "add-widget"]
        );
        assert_eq!(settings.dock.start_action, StartAction::Launcher);
        assert!(settings.apps.group_windows);
        assert!(!AppSettings::migrate(&mut value));
    }

    #[test]
    fn new_installs_start_unonboarded() {
        assert!(!AppSettings::default().onboarded);
    }
}
