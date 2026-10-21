use std::{
    fs,
    io::Write,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

use super::types::AppSettings;

#[derive(Debug, thiserror::Error)]
pub enum SettingsError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("parse error: {0}")]
    Parse(String),
    #[error("validation error: {0}")]
    Validation(String),
}

pub struct SettingsStore {
    path: PathBuf,
}

impl SettingsStore {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    pub fn load(&self) -> Result<AppSettings, SettingsError> {
        if !self.path.exists() {
            return Ok(AppSettings::default());
        }

        let raw = fs::read_to_string(&self.path).map_err(SettingsError::Io)?;
        let parsed = serde_json::from_str::<serde_json::Value>(&raw).and_then(|mut value| {
            let migrated = AppSettings::migrate(&mut value);
            serde_json::from_value::<AppSettings>(value).map(|s| (s, migrated))
        });
        match parsed {
            Ok((settings, migrated)) => match settings.validate() {
                Ok(()) => {
                    if migrated {
                        self.save(&settings)?;
                    }
                    Ok(settings)
                }
                Err(err) => {
                    self.backup_invalid(&raw)?;
                    tracing::warn!(?err, "settings failed validation; using defaults");
                    Ok(AppSettings::default())
                }
            },
            Err(err) => {
                self.backup_invalid(&raw)?;
                tracing::warn!(?err, "invalid settings file; using defaults");
                Ok(AppSettings::default())
            }
        }
    }

    pub fn save(&self, settings: &AppSettings) -> Result<(), SettingsError> {
        settings.validate().map_err(SettingsError::Validation)?;
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)?;
        }

        let serialized = serde_json::to_string_pretty(settings)
            .map_err(|e| SettingsError::Parse(e.to_string()))?;

        let tmp = self.path.with_extension("json.tmp");
        {
            let mut file = fs::File::create(&tmp)?;
            file.write_all(serialized.as_bytes())?;
            file.sync_all()?;
        }
        fs::rename(tmp, &self.path)?;
        Ok(())
    }

    fn backup_invalid(&self, raw: &str) -> Result<(), SettingsError> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)?;
        }
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let backup = self
            .path
            .with_file_name(format!("settings.invalid-{ts}.json"));
        fs::write(backup, raw)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn round_trip_and_recovery() {
        let dir = std::env::temp_dir().join(format!("opendock-test-{}", uuid_simple()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("settings.json");
        let store = SettingsStore::new(path.clone());

        let mut settings = AppSettings::default();
        settings.dock.item_order = vec!["clock".into(), "add-widget".into()];
        store.save(&settings).unwrap();
        let loaded = store.load().unwrap();
        assert_eq!(loaded, settings);

        fs::write(&path, "{ not json").unwrap();
        let recovered = store.load().unwrap();
        assert_eq!(recovered, AppSettings::default());
        assert!(fs::read_dir(&dir).unwrap().any(|e| e
            .unwrap()
            .file_name()
            .to_string_lossy()
            .contains("invalid")));
    }

    fn uuid_simple() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos() as u64
    }
}
