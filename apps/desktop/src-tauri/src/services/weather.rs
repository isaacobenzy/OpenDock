use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::engine::bus::BusEvent;
use crate::net;
use crate::settings::types::{TemperatureUnit, WeatherSettings};
use crate::store::{cache, now_ms, Database};

pub const FORECAST_HOST: &str = "api.open-meteo.com";
pub const GEOCODING_HOST: &str = "geocoding-api.open-meteo.com";
const CACHE_KEY: &str = "weather.snapshot";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HourForecast {
    pub time: i64,
    pub temperature: f64,
    pub precipitation: f64,
    pub code: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DayForecast {
    pub date: i64,
    pub high: f64,
    pub low: f64,
    pub code: i64,
    pub precipitation: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WeatherSnapshot {
    pub city: String,
    pub unit: String,
    pub temperature: f64,
    pub apparent_temperature: f64,
    pub code: i64,
    pub is_day: bool,
    pub wind_speed: f64,
    pub high: f64,
    pub low: f64,
    pub sunrise: Option<i64>,
    pub sunset: Option<i64>,
    pub hourly: Vec<HourForecast>,
    pub daily: Vec<DayForecast>,
    pub fetched_at: i64,
    #[serde(default)]
    pub stale: bool,
    #[serde(default)]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CityResult {
    pub name: String,
    pub region: String,
    pub country: String,
    pub latitude: f64,
    pub longitude: f64,
}

pub fn encode_component(value: &str) -> String {
    value
        .bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (b as char).to_string()
            }
            _ => format!("%{b:02X}"),
        })
        .collect()
}

pub fn search_city(db: &Database, query: &str) -> Result<Vec<CityResult>, String> {
    let query = query.trim();
    if query.chars().count() < 2 {
        return Ok(vec![]);
    }
    let url = format!(
        "https://{GEOCODING_HOST}/v1/search?name={}&count=6&language=en&format=json",
        encode_component(query)
    );
    let body = net::get_text(db, "weather", &[GEOCODING_HOST], &url)?;
    let value: Value = serde_json::from_str(&body).map_err(|e| e.to_string())?;
    let results = value["results"].as_array().cloned().unwrap_or_default();
    Ok(results
        .iter()
        .filter_map(|r| {
            Some(CityResult {
                name: r["name"].as_str()?.to_string(),
                region: r["admin1"].as_str().unwrap_or_default().to_string(),
                country: r["country"].as_str().unwrap_or_default().to_string(),
                latitude: r["latitude"].as_f64()?,
                longitude: r["longitude"].as_f64()?,
            })
        })
        .collect())
}

fn forecast_url(settings: &WeatherSettings, lat: f64, lon: f64) -> String {
    let unit = match settings.unit {
        TemperatureUnit::C => "celsius",
        TemperatureUnit::F => "fahrenheit",
    };
    format!(
        "https://{FORECAST_HOST}/v1/forecast?latitude={lat:.4}&longitude={lon:.4}\
         &current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m\
         &hourly=temperature_2m,precipitation_probability,weather_code\
         &daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,weather_code,precipitation_probability_max\
         &forecast_days=5&timezone=auto&timeformat=unixtime&temperature_unit={unit}"
    )
}

fn nums(value: &Value) -> Vec<f64> {
    value
        .as_array()
        .map(|a| a.iter().map(|v| v.as_f64().unwrap_or(0.0)).collect())
        .unwrap_or_default()
}

pub fn parse_forecast(
    body: &str,
    city: &str,
    unit: TemperatureUnit,
    now: i64,
) -> Result<WeatherSnapshot, String> {
    let v: Value = serde_json::from_str(body).map_err(|e| e.to_string())?;
    let current = &v["current"];
    let temperature = current["temperature_2m"]
        .as_f64()
        .ok_or_else(|| "forecast is missing the current temperature".to_string())?;

    let hourly_times = nums(&v["hourly"]["time"]);
    let hourly_temp = nums(&v["hourly"]["temperature_2m"]);
    let hourly_rain = nums(&v["hourly"]["precipitation_probability"]);
    let hourly_code = nums(&v["hourly"]["weather_code"]);
    let hourly: Vec<HourForecast> = hourly_times
        .iter()
        .enumerate()
        .map(|(i, t)| HourForecast {
            time: (*t as i64) * 1000,
            temperature: hourly_temp.get(i).copied().unwrap_or(0.0),
            precipitation: hourly_rain.get(i).copied().unwrap_or(0.0),
            code: hourly_code.get(i).copied().unwrap_or(0.0) as i64,
        })
        .filter(|h| h.time + 3_600_000 > now)
        .take(24)
        .collect();

    let daily_times = nums(&v["daily"]["time"]);
    let highs = nums(&v["daily"]["temperature_2m_max"]);
    let lows = nums(&v["daily"]["temperature_2m_min"]);
    let codes = nums(&v["daily"]["weather_code"]);
    let rain = nums(&v["daily"]["precipitation_probability_max"]);
    let sunrises = nums(&v["daily"]["sunrise"]);
    let sunsets = nums(&v["daily"]["sunset"]);
    let daily: Vec<DayForecast> = daily_times
        .iter()
        .enumerate()
        .map(|(i, t)| DayForecast {
            date: (*t as i64) * 1000,
            high: highs.get(i).copied().unwrap_or(0.0),
            low: lows.get(i).copied().unwrap_or(0.0),
            code: codes.get(i).copied().unwrap_or(0.0) as i64,
            precipitation: rain.get(i).copied().unwrap_or(0.0),
        })
        .collect();

    Ok(WeatherSnapshot {
        city: city.to_string(),
        unit: match unit {
            TemperatureUnit::C => "c".into(),
            TemperatureUnit::F => "f".into(),
        },
        temperature,
        apparent_temperature: current["apparent_temperature"]
            .as_f64()
            .unwrap_or(temperature),
        code: current["weather_code"].as_i64().unwrap_or(0),
        is_day: current["is_day"].as_i64().unwrap_or(1) == 1,
        wind_speed: current["wind_speed_10m"].as_f64().unwrap_or(0.0),
        high: daily.first().map(|d| d.high).unwrap_or(temperature),
        low: daily.first().map(|d| d.low).unwrap_or(temperature),
        sunrise: sunrises.first().map(|s| (*s as i64) * 1000),
        sunset: sunsets.first().map(|s| (*s as i64) * 1000),
        hourly,
        daily,
        fetched_at: now,
        stale: false,
        error: None,
    })
}

/// The next hour in the coming three with a real chance of rain.
pub fn rain_soon(snapshot: &WeatherSnapshot, now: i64) -> Option<BusEvent> {
    let hour = snapshot
        .hourly
        .iter()
        .filter(|h| h.time >= now - 30 * 60_000 && h.time <= now + 3 * 3_600_000)
        .find(|h| h.precipitation >= 50.0)?;
    let minutes = (hour.time - now).max(0) / 60_000;
    Some(
        BusEvent::new(
            "weather.rain.soon",
            "weather",
            json!({ "minutesUntil": minutes, "probability": hour.precipitation.round() }),
        )
        .with_dedupe(format!("rain:{}", hour.time)),
    )
}

pub fn cached(db: &Database) -> Option<WeatherSnapshot> {
    let (raw, _) = db.with(|c| cache::get(c, CACHE_KEY)).ok().flatten()?;
    serde_json::from_str(&raw).ok()
}

/// Fetches a fresh forecast. On failure, returns the cached one marked stale.
pub fn refresh(db: &Database, settings: &WeatherSettings) -> Option<WeatherSnapshot> {
    let (Some(lat), Some(lon)) = (settings.latitude, settings.longitude) else {
        return None;
    };
    let url = forecast_url(settings, lat, lon);
    let fetched = net::get_text(db, "weather", &[FORECAST_HOST], &url)
        .and_then(|body| parse_forecast(&body, &settings.city, settings.unit, now_ms()));
    match fetched {
        Ok(snapshot) => {
            if let Ok(raw) = serde_json::to_string(&snapshot) {
                let _ = db.with(|c| cache::put(c, CACHE_KEY, &raw));
            }
            Some(snapshot)
        }
        Err(error) => {
            tracing::warn!(%error, "weather refresh failed");
            cached(db).map(|mut snapshot| {
                snapshot.stale = true;
                snapshot.error = Some(error);
                snapshot
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const BODY: &str = r#"{
        "current": {"temperature_2m": 18.4, "apparent_temperature": 17.0, "weather_code": 1, "is_day": 1, "wind_speed_10m": 9.5},
        "hourly": {
            "time": [1000, 4600, 8200, 11800],
            "temperature_2m": [18, 19, 17, 16],
            "precipitation_probability": [10, 20, 70, 90],
            "weather_code": [1, 2, 61, 63]
        },
        "daily": {
            "time": [0, 86400],
            "temperature_2m_max": [21, 22],
            "temperature_2m_min": [12, 13],
            "weather_code": [61, 3],
            "precipitation_probability_max": [90, 10],
            "sunrise": [21600, 108000],
            "sunset": [64800, 151200]
        }
    }"#;

    #[test]
    fn parses_forecast_and_finds_rain() {
        let now = 1_000_000;
        let snapshot = parse_forecast(BODY, "Accra", TemperatureUnit::C, now).unwrap();
        assert_eq!(snapshot.temperature, 18.4);
        assert_eq!(snapshot.high, 21.0);
        assert_eq!(snapshot.sunset, Some(64_800_000));
        assert_eq!(snapshot.daily.len(), 2);
        let event = rain_soon(&snapshot, now).unwrap();
        assert_eq!(event.payload["probability"], 70.0);
        assert_eq!(event.payload["minutesUntil"], (8_200_000 - now) / 60_000);
    }

    #[test]
    fn encodes_queries() {
        assert_eq!(encode_component("São Paulo"), "S%C3%A3o%20Paulo");
    }
}
