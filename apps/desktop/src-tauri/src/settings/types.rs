use serde::{Deserialize, Serialize};

use crate::geometry::{DockMode, DockPosition, DockSize};

pub const SETTINGS_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DockSettings {
    pub position: DockPosition,
    pub size: DockSize,
    pub mode: DockMode,
    pub theme: Theme,
    #[serde(default)]
    pub monitor_id: Option<String>,
    pub item_order: Vec<String>,
    pub clock24h: bool,
    pub launch_at_startup: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Dark,
    Light,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub version: u32,
    pub dock: DockSettings,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            version: SETTINGS_VERSION,
            dock: DockSettings {
                position: DockPosition::Bottom,
                size: DockSize::M,
                mode: DockMode::Pill,
                theme: Theme::Dark,
                monitor_id: None,
                item_order: vec!["clock".into(), "add-widget".into()],
                clock24h: false,
                launch_at_startup: false,
            },
        }
    }
}

impl AppSettings {
    pub fn validate(&self) -> Result<(), String> {
        if self.version != SETTINGS_VERSION {
            return Err(format!("unsupported settings version {}", self.version));
        }
        if self.dock.item_order.is_empty() || self.dock.item_order.len() > 32 {
            return Err("itemOrder must contain 1-32 entries".into());
        }
        for id in &self.dock.item_order {
            if id.is_empty() || id.len() > 64 {
                return Err("invalid dock item id length".into());
            }
            if !id
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
            {
                return Err(format!("invalid dock item id: {id}"));
            }
        }
        Ok(())
    }
}
