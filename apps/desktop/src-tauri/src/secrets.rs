//! Secrets (calendar feed URLs, future API keys) live in the OS keychain:
//! Credential Manager on Windows, Keychain on macOS, the kernel keyring on Linux.
//! They are never written to settings.json or SQLite.

const SERVICE: &str = "OpenDock";

fn entry(account: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, account).map_err(|e| e.to_string())
}

pub fn set(account: &str, secret: &str) -> Result<(), String> {
    entry(account)?
        .set_password(secret)
        .map_err(|e| e.to_string())
}

pub fn get(account: &str) -> Result<Option<String>, String> {
    match entry(account)?.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn delete(account: &str) -> Result<(), String> {
    match entry(account)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

pub fn calendar_account(calendar_id: i64) -> String {
    format!("calendar:{calendar_id}")
}
