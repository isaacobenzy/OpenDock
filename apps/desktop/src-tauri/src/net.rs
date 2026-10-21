//! The only way OpenDock talks to the network. Every request names the widget making it,
//! must target a host that widget declared, and is written to the Privacy Ledger.

use std::time::Duration;

use crate::store::{cache, Database};

const MAX_BODY_BYTES: u64 = 5 * 1024 * 1024;

pub fn host_of(url: &str) -> Option<String> {
    let rest = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))?;
    let authority = rest.split(['/', '?', '#']).next()?;
    let host = authority.rsplit('@').next()?.split(':').next()?;
    (!host.is_empty()).then(|| host.to_ascii_lowercase())
}

/// Accepts `webcal://` links, which calendar apps hand out for iCal feeds.
pub fn normalize_feed_url(url: &str) -> String {
    let trimmed = url.trim();
    match trimmed.strip_prefix("webcal://") {
        Some(rest) => format!("https://{rest}"),
        None => trimmed.to_string(),
    }
}

fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(8))
        .timeout(Duration::from_secs(20))
        .user_agent(concat!("OpenDock/", env!("CARGO_PKG_VERSION")))
        .build()
}

pub fn get_text(
    db: &Database,
    widget: &str,
    allowed_hosts: &[&str],
    url: &str,
) -> Result<String, String> {
    if !url.starts_with("https://") {
        return Err("only https:// URLs are allowed".into());
    }
    let host = host_of(url).ok_or_else(|| "invalid URL".to_string())?;
    if !allowed_hosts.iter().any(|h| h.eq_ignore_ascii_case(&host)) {
        return Err(format!("{widget} is not allowed to contact {host}"));
    }
    let result = agent()
        .get(url)
        .call()
        .map_err(|e| match e {
            ureq::Error::Status(code, _) => format!("{host} answered {code}"),
            ureq::Error::Transport(t) => format!("could not reach {host}: {}", t.kind()),
        })
        .and_then(|response| {
            use std::io::Read;
            let mut body = String::new();
            response
                .into_reader()
                .take(MAX_BODY_BYTES)
                .read_to_string(&mut body)
                .map(|_| body)
                .map_err(|e| e.to_string())
        });
    let _ = db.with(|c| cache::log_request(c, widget, &host, result.is_ok()));
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_hosts() {
        assert_eq!(
            host_of("https://calendar.google.com/calendar/ical/x/basic.ics").as_deref(),
            Some("calendar.google.com")
        );
        assert_eq!(
            host_of("https://user@Example.com:8443/a").as_deref(),
            Some("example.com")
        );
        assert_eq!(host_of("ftp://x"), None);
    }

    #[test]
    fn webcal_becomes_https() {
        assert_eq!(
            normalize_feed_url(" webcal://p01.icloud.com/x "),
            "https://p01.icloud.com/x"
        );
    }

    #[test]
    fn rejects_undeclared_hosts_without_network() {
        let db = Database::open_in_memory().unwrap();
        let err = get_text(
            &db,
            "weather",
            &["api.open-meteo.com"],
            "https://evil.example/x",
        )
        .unwrap_err();
        assert!(err.contains("not allowed"));
        assert!(get_text(
            &db,
            "weather",
            &["api.open-meteo.com"],
            "http://api.open-meteo.com"
        )
        .is_err());
    }
}
