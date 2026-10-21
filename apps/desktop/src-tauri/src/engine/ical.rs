//! Minimal, dependency-light iCalendar reader for read-only calendar feeds.
//! Supports VEVENT with DTSTART/DTEND/DURATION, TZID (IANA names), all-day dates,
//! RRULE (DAILY/WEEKLY/MONTHLY/YEARLY with INTERVAL, COUNT, UNTIL, BYDAY),
//! EXDATE, RECURRENCE-ID overrides and cancelled events.

use std::collections::{HashMap, HashSet};

use chrono::{
    DateTime, Datelike, Duration, Local, LocalResult, Months, NaiveDate, NaiveDateTime, TimeZone,
    Utc, Weekday,
};
use chrono_tz::Tz;

const MAX_ITERATIONS: usize = 5_000;

#[derive(Debug, Clone, PartialEq)]
pub struct Occurrence {
    pub uid: String,
    pub title: String,
    pub location: String,
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
    pub all_day: bool,
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum Zone {
    Utc,
    Named(Tz),
    Floating,
}

#[derive(Debug, Clone)]
struct Stamp {
    naive: NaiveDateTime,
    zone: Zone,
    date_only: bool,
}

impl Stamp {
    fn to_utc(&self) -> Option<DateTime<Utc>> {
        to_utc(self.naive, self.zone)
    }
}

fn to_utc(naive: NaiveDateTime, zone: Zone) -> Option<DateTime<Utc>> {
    match zone {
        Zone::Utc => Some(Utc.from_utc_datetime(&naive)),
        Zone::Named(tz) => pick(tz.from_local_datetime(&naive)).map(|d| d.with_timezone(&Utc)),
        Zone::Floating => pick(Local.from_local_datetime(&naive)).map(|d| d.with_timezone(&Utc)),
    }
}

fn pick<T: TimeZone>(result: LocalResult<DateTime<T>>) -> Option<DateTime<T>> {
    match result {
        LocalResult::Single(d) => Some(d),
        LocalResult::Ambiguous(a, _) => Some(a),
        LocalResult::None => None,
    }
}

#[derive(Debug, Default, Clone)]
struct RawEvent {
    uid: String,
    summary: String,
    location: String,
    start: Option<Stamp>,
    end: Option<Stamp>,
    duration: Option<Duration>,
    rrule: Option<String>,
    exdates: Vec<DateTime<Utc>>,
    recurrence_id: Option<DateTime<Utc>>,
    cancelled: bool,
}

#[derive(Debug)]
struct Property {
    name: String,
    params: HashMap<String, String>,
    value: String,
}

fn unfold(text: &str) -> Vec<String> {
    let mut lines: Vec<String> = Vec::new();
    for raw in text.split('\n') {
        let line = raw.strip_suffix('\r').unwrap_or(raw);
        if (line.starts_with(' ') || line.starts_with('\t')) && !lines.is_empty() {
            if let Some(last) = lines.last_mut() {
                last.push_str(&line[1..]);
            }
        } else if !line.is_empty() {
            lines.push(line.to_string());
        }
    }
    lines
}

fn parse_property(line: &str) -> Option<Property> {
    let mut in_quotes = false;
    let mut colon = None;
    for (i, c) in line.char_indices() {
        match c {
            '"' => in_quotes = !in_quotes,
            ':' if !in_quotes => {
                colon = Some(i);
                break;
            }
            _ => {}
        }
    }
    let colon = colon?;
    let (head, value) = (&line[..colon], &line[colon + 1..]);
    let mut parts = head.split(';');
    let name = parts.next()?.to_ascii_uppercase();
    let params = parts
        .filter_map(|p| {
            let (k, v) = p.split_once('=')?;
            Some((k.to_ascii_uppercase(), v.trim_matches('"').to_string()))
        })
        .collect();
    Some(Property {
        name,
        params,
        value: value.to_string(),
    })
}

fn unescape(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    let mut chars = value.chars();
    while let Some(c) = chars.next() {
        if c == '\\' {
            match chars.next() {
                Some('n') | Some('N') => out.push(' '),
                Some(other) => out.push(other),
                None => {}
            }
        } else {
            out.push(c);
        }
    }
    out.trim().to_string()
}

fn resolve_zone(tzid: Option<&String>) -> Zone {
    let Some(id) = tzid else {
        return Zone::Floating;
    };
    let cleaned = id.trim_start_matches('/');
    if let Ok(tz) = cleaned.parse::<Tz>() {
        return Zone::Named(tz);
    }
    windows_zone(cleaned)
        .and_then(|iana| iana.parse::<Tz>().ok())
        .map(Zone::Named)
        .unwrap_or(Zone::Floating)
}

/// Outlook feeds use Windows zone names; map the most common ones.
fn windows_zone(name: &str) -> Option<&'static str> {
    Some(match name {
        "UTC" | "Coordinated Universal Time" | "Greenwich Standard Time" => "UTC",
        "GMT Standard Time" => "Europe/London",
        "W. Europe Standard Time" => "Europe/Berlin",
        "Romance Standard Time" => "Europe/Paris",
        "Central Europe Standard Time" => "Europe/Budapest",
        "Central European Standard Time" => "Europe/Warsaw",
        "E. Europe Standard Time" => "Europe/Chisinau",
        "FLE Standard Time" => "Europe/Kiev",
        "Russian Standard Time" => "Europe/Moscow",
        "Eastern Standard Time" => "America/New_York",
        "Central Standard Time" => "America/Chicago",
        "Mountain Standard Time" => "America/Denver",
        "Pacific Standard Time" => "America/Los_Angeles",
        "Alaskan Standard Time" => "America/Anchorage",
        "Hawaiian Standard Time" => "Pacific/Honolulu",
        "Atlantic Standard Time" => "America/Halifax",
        "SA Pacific Standard Time" => "America/Bogota",
        "E. South America Standard Time" => "America/Sao_Paulo",
        "India Standard Time" => "Asia/Kolkata",
        "China Standard Time" => "Asia/Shanghai",
        "Tokyo Standard Time" => "Asia/Tokyo",
        "Korea Standard Time" => "Asia/Seoul",
        "Singapore Standard Time" => "Asia/Singapore",
        "AUS Eastern Standard Time" => "Australia/Sydney",
        "New Zealand Standard Time" => "Pacific/Auckland",
        "South Africa Standard Time" => "Africa/Johannesburg",
        "W. Central Africa Standard Time" => "Africa/Lagos",
        "E. Africa Standard Time" => "Africa/Nairobi",
        "Arabian Standard Time" => "Asia/Dubai",
        "Israel Standard Time" => "Asia/Jerusalem",
        _ => return None,
    })
}

fn parse_stamp(prop: &Property) -> Option<Stamp> {
    let value = prop.value.trim();
    let is_date = prop.params.get("VALUE").is_some_and(|v| v == "DATE") || value.len() == 8;
    if is_date {
        let date = NaiveDate::parse_from_str(&value[..8.min(value.len())], "%Y%m%d").ok()?;
        return Some(Stamp {
            naive: date.and_hms_opt(0, 0, 0)?,
            zone: Zone::Floating,
            date_only: true,
        });
    }
    let (body, utc) = match value.strip_suffix('Z') {
        Some(b) => (b, true),
        None => (value, false),
    };
    let naive = NaiveDateTime::parse_from_str(body, "%Y%m%dT%H%M%S")
        .or_else(|_| NaiveDateTime::parse_from_str(body, "%Y%m%dT%H%M"))
        .ok()?;
    let zone = if utc {
        Zone::Utc
    } else {
        resolve_zone(prop.params.get("TZID"))
    };
    Some(Stamp {
        naive,
        zone,
        date_only: false,
    })
}

fn parse_duration(value: &str) -> Option<Duration> {
    let (negative, rest) = match value.strip_prefix('-') {
        Some(r) => (true, r),
        None => (false, value.strip_prefix('+').unwrap_or(value)),
    };
    let rest = rest.strip_prefix('P')?;
    let mut total = Duration::zero();
    let mut number = String::new();
    let mut in_time = false;
    for c in rest.chars() {
        match c {
            'T' => in_time = true,
            '0'..='9' => number.push(c),
            unit => {
                let n: i64 = number.parse().ok()?;
                number.clear();
                total += match (unit, in_time) {
                    ('W', _) => Duration::weeks(n),
                    ('D', _) => Duration::days(n),
                    ('H', true) => Duration::hours(n),
                    ('M', true) => Duration::minutes(n),
                    ('S', true) => Duration::seconds(n),
                    _ => return None,
                };
            }
        }
    }
    Some(if negative { -total } else { total })
}

fn parse_events(text: &str) -> Vec<RawEvent> {
    let mut events = Vec::new();
    let mut current: Option<RawEvent> = None;
    let mut depth_in_alarm = 0;
    for line in unfold(text) {
        let Some(prop) = parse_property(&line) else {
            continue;
        };
        match (prop.name.as_str(), prop.value.to_ascii_uppercase().as_str()) {
            ("BEGIN", "VEVENT") => current = Some(RawEvent::default()),
            ("END", "VEVENT") => {
                if let Some(ev) = current.take() {
                    events.push(ev);
                }
            }
            ("BEGIN", _) if current.is_some() => depth_in_alarm += 1,
            ("END", _) if current.is_some() && depth_in_alarm > 0 => depth_in_alarm -= 1,
            _ => {
                if depth_in_alarm > 0 {
                    continue;
                }
                let Some(ev) = current.as_mut() else {
                    continue;
                };
                match prop.name.as_str() {
                    "UID" => ev.uid = prop.value.trim().to_string(),
                    "SUMMARY" => ev.summary = unescape(&prop.value),
                    "LOCATION" => ev.location = unescape(&prop.value),
                    "DTSTART" => ev.start = parse_stamp(&prop),
                    "DTEND" => ev.end = parse_stamp(&prop),
                    "DURATION" => ev.duration = parse_duration(prop.value.trim()),
                    "RRULE" => ev.rrule = Some(prop.value.trim().to_string()),
                    "STATUS" => ev.cancelled = prop.value.trim().eq_ignore_ascii_case("CANCELLED"),
                    "EXDATE" => {
                        for part in prop.value.split(',') {
                            let single = Property {
                                name: prop.name.clone(),
                                params: prop.params.clone(),
                                value: part.to_string(),
                            };
                            if let Some(utc) = parse_stamp(&single).and_then(|s| s.to_utc()) {
                                ev.exdates.push(utc);
                            }
                        }
                    }
                    "RECURRENCE-ID" => {
                        ev.recurrence_id = parse_stamp(&prop).and_then(|s| s.to_utc());
                    }
                    _ => {}
                }
            }
        }
    }
    events
}

#[derive(Debug, Default)]
struct RRule {
    freq: String,
    interval: u32,
    count: Option<u32>,
    until: Option<DateTime<Utc>>,
    by_day: Vec<(i32, Weekday)>,
}

fn parse_weekday(code: &str) -> Option<Weekday> {
    Some(match code {
        "MO" => Weekday::Mon,
        "TU" => Weekday::Tue,
        "WE" => Weekday::Wed,
        "TH" => Weekday::Thu,
        "FR" => Weekday::Fri,
        "SA" => Weekday::Sat,
        "SU" => Weekday::Sun,
        _ => return None,
    })
}

fn parse_rrule(value: &str, zone: Zone) -> Option<RRule> {
    let mut rule = RRule {
        interval: 1,
        ..Default::default()
    };
    for part in value.split(';') {
        let (k, v) = part.split_once('=')?;
        match k.to_ascii_uppercase().as_str() {
            "FREQ" => rule.freq = v.to_ascii_uppercase(),
            "INTERVAL" => rule.interval = v.parse().ok().filter(|n: &u32| *n > 0).unwrap_or(1),
            "COUNT" => rule.count = v.parse().ok(),
            "UNTIL" => {
                let prop = Property {
                    name: "UNTIL".into(),
                    params: HashMap::new(),
                    value: v.to_string(),
                };
                rule.until = parse_stamp(&prop).and_then(|s| {
                    let z = if s.zone == Zone::Floating && !s.date_only {
                        zone
                    } else {
                        s.zone
                    };
                    let naive = if s.date_only {
                        s.naive.date().and_hms_opt(23, 59, 59)?
                    } else {
                        s.naive
                    };
                    to_utc(naive, z)
                });
            }
            "BYDAY" => {
                rule.by_day = v
                    .split(',')
                    .filter_map(|d| {
                        let d = d.trim();
                        let split = d.len().checked_sub(2)?;
                        let (ord, code) = d.split_at(split);
                        let ordinal = if ord.is_empty() { 0 } else { ord.parse().ok()? };
                        Some((ordinal, parse_weekday(code)?))
                    })
                    .collect();
            }
            _ => {}
        }
    }
    matches!(
        rule.freq.as_str(),
        "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"
    )
    .then_some(rule)
}

fn nth_weekday(year: i32, month: u32, ordinal: i32, weekday: Weekday) -> Option<NaiveDate> {
    if ordinal > 0 {
        NaiveDate::from_weekday_of_month_opt(year, month, weekday, ordinal as u8)
    } else {
        let first_next = if month == 12 {
            NaiveDate::from_ymd_opt(year + 1, 1, 1)?
        } else {
            NaiveDate::from_ymd_opt(year, month + 1, 1)?
        };
        let mut day = first_next.pred_opt()?;
        let mut seen = 0;
        while day.month() == month {
            if day.weekday() == weekday {
                seen += 1;
                if seen == -ordinal {
                    return Some(day);
                }
            }
            day = day.pred_opt()?;
        }
        None
    }
}

/// Candidate dates for one period of the rule, in ascending order.
fn period_dates(rule: &RRule, start: NaiveDate, period: u32) -> Vec<NaiveDate> {
    let step = period * rule.interval;
    match rule.freq.as_str() {
        "DAILY" => vec![start + Duration::days(i64::from(step))],
        "WEEKLY" => {
            let week_start = start
                - Duration::days(i64::from(start.weekday().num_days_from_monday()))
                + Duration::weeks(i64::from(step));
            if rule.by_day.is_empty() {
                vec![start + Duration::weeks(i64::from(step))]
            } else {
                let mut days: Vec<NaiveDate> = rule
                    .by_day
                    .iter()
                    .map(|(_, wd)| {
                        week_start + Duration::days(i64::from(wd.num_days_from_monday()))
                    })
                    .collect();
                days.sort();
                days.dedup();
                days
            }
        }
        "MONTHLY" => {
            let Some(month_start) = NaiveDate::from_ymd_opt(start.year(), start.month(), 1)
                .and_then(|d| d.checked_add_months(Months::new(step)))
            else {
                return vec![];
            };
            if rule.by_day.is_empty() {
                NaiveDate::from_ymd_opt(month_start.year(), month_start.month(), start.day())
                    .into_iter()
                    .collect()
            } else {
                let mut days: Vec<NaiveDate> = rule
                    .by_day
                    .iter()
                    .flat_map(|(ord, wd)| {
                        if *ord == 0 {
                            (1..=5)
                                .filter_map(|n| {
                                    nth_weekday(month_start.year(), month_start.month(), n, *wd)
                                })
                                .collect::<Vec<_>>()
                        } else {
                            nth_weekday(month_start.year(), month_start.month(), *ord, *wd)
                                .into_iter()
                                .collect()
                        }
                    })
                    .collect();
                days.sort();
                days.dedup();
                days
            }
        }
        "YEARLY" => NaiveDate::from_ymd_opt(start.year() + step as i32, start.month(), start.day())
            .into_iter()
            .collect(),
        _ => vec![],
    }
}

/// Skips periods that end well before the window. Only valid without COUNT, since COUNT
/// needs every earlier occurrence to be counted.
fn first_period(rule: &RRule, base: NaiveDate, from: DateTime<Utc>) -> u32 {
    let days = (from.date_naive() - base).num_days() - 2;
    if days <= 0 {
        return 0;
    }
    let unit_days = match rule.freq.as_str() {
        "DAILY" => 1,
        "WEEKLY" => 7,
        "MONTHLY" => 31,
        _ => 366,
    };
    (days / unit_days / i64::from(rule.interval)).saturating_sub(1) as u32
}

fn expand(
    ev: &RawEvent,
    start: &Stamp,
    span: Duration,
    from: DateTime<Utc>,
    to: DateTime<Utc>,
) -> Vec<(DateTime<Utc>, DateTime<Utc>)> {
    let Some(rule) = ev.rrule.as_deref().and_then(|r| parse_rrule(r, start.zone)) else {
        return start
            .to_utc()
            .map(|s| vec![(s, s + span)])
            .unwrap_or_default();
    };
    let mut out = Vec::new();
    let mut emitted = 0u32;
    let time = start.naive.time();
    let base = start.naive.date();
    let first = if rule.count.is_none() {
        first_period(&rule, base, from)
    } else {
        0
    };
    for period in first..first + MAX_ITERATIONS as u32 {
        let dates = period_dates(&rule, base, period);
        let mut past_end = false;
        for date in dates {
            if date < base {
                continue;
            }
            let Some(occ_start) = to_utc(date.and_time(time), start.zone) else {
                continue;
            };
            if rule.until.is_some_and(|u| occ_start > u) || occ_start > to {
                past_end = true;
                break;
            }
            if rule.count.is_some_and(|c| emitted >= c) {
                past_end = true;
                break;
            }
            emitted += 1;
            let occ_end = occ_start + span;
            if occ_end >= from && !ev.exdates.contains(&occ_start) {
                out.push((occ_start, occ_end));
            }
        }
        if past_end {
            break;
        }
    }
    out
}

/// Returns occurrences overlapping `[from, to]`, sorted by start time.
pub fn occurrences(text: &str, from: DateTime<Utc>, to: DateTime<Utc>) -> Vec<Occurrence> {
    let events = parse_events(text);
    let overrides: HashSet<(String, DateTime<Utc>)> = events
        .iter()
        .filter_map(|e| e.recurrence_id.map(|r| (e.uid.clone(), r)))
        .collect();
    let mut out = Vec::new();
    for ev in &events {
        let Some(start) = &ev.start else {
            continue;
        };
        if ev.cancelled {
            continue;
        }
        let span = match (&ev.end, ev.duration) {
            (Some(end), _) => match (end.to_utc(), start.to_utc()) {
                (Some(e), Some(s)) if e > s => e - s,
                _ => Duration::zero(),
            },
            (None, Some(d)) => d,
            (None, None) if start.date_only => Duration::days(1),
            _ => Duration::zero(),
        };
        for (s, e) in expand(ev, start, span, from, to) {
            if e < from || s > to {
                continue;
            }
            if ev.recurrence_id.is_none() && overrides.contains(&(ev.uid.clone(), s)) {
                continue;
            }
            out.push(Occurrence {
                uid: ev.uid.clone(),
                title: if ev.summary.is_empty() {
                    "Busy".into()
                } else {
                    ev.summary.clone()
                },
                location: ev.location.clone(),
                start: s,
                end: e,
                all_day: start.date_only,
            });
        }
    }
    out.sort_by_key(|o| o.start);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn utc(s: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
    }

    const FEED: &str = "BEGIN:VCALENDAR\r\n\
BEGIN:VEVENT\r\n\
UID:one\r\n\
SUMMARY:Design review\\, round 2\r\n\
DTSTART:20261021T140000Z\r\n\
DTEND:20261021T150000Z\r\n\
LOCATION:Room\r\n  A\r\n\
BEGIN:VALARM\r\n\
SUMMARY:alarm should be ignored\r\n\
END:VALARM\r\n\
END:VEVENT\r\n\
BEGIN:VEVENT\r\n\
UID:standup\r\n\
SUMMARY:Standup\r\n\
DTSTART;TZID=Europe/London:20261019T100000\r\n\
DURATION:PT15M\r\n\
RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=6\r\n\
EXDATE;TZID=Europe/London:20261021T100000\r\n\
END:VEVENT\r\n\
BEGIN:VEVENT\r\n\
UID:standup\r\n\
RECURRENCE-ID;TZID=Europe/London:20261023T100000\r\n\
SUMMARY:Standup (moved)\r\n\
DTSTART;TZID=Europe/London:20261023T113000\r\n\
DTEND;TZID=Europe/London:20261023T114500\r\n\
END:VEVENT\r\n\
BEGIN:VEVENT\r\n\
UID:gone\r\n\
SUMMARY:Cancelled\r\n\
STATUS:CANCELLED\r\n\
DTSTART:20261021T090000Z\r\n\
END:VEVENT\r\n\
BEGIN:VEVENT\r\n\
UID:holiday\r\n\
SUMMARY:Holiday\r\n\
DTSTART;VALUE=DATE:20261022\r\n\
END:VEVENT\r\n\
END:VCALENDAR\r\n";

    #[test]
    fn parses_single_events_with_unfolding_and_escapes() {
        let occ = occurrences(
            FEED,
            utc("2026-10-21T00:00:00Z"),
            utc("2026-10-21T23:59:00Z"),
        );
        let review = occ.iter().find(|o| o.uid == "one").unwrap();
        assert_eq!(review.title, "Design review, round 2");
        assert_eq!(review.location, "Room A");
        assert_eq!(review.end - review.start, Duration::hours(1));
        assert!(occ.iter().all(|o| o.uid != "gone"));
    }

    #[test]
    fn expands_weekly_rules_with_exdates_and_overrides() {
        let occ = occurrences(
            FEED,
            utc("2026-10-19T00:00:00Z"),
            utc("2026-11-30T00:00:00Z"),
        );
        let standups: Vec<&Occurrence> = occ.iter().filter(|o| o.uid == "standup").collect();
        let starts: Vec<String> = standups
            .iter()
            .map(|o| o.start.format("%m-%d %H:%M").to_string())
            .collect();
        // BST until Oct 25, so 10:00 London is 09:00 UTC; Oct 21 is excluded and Oct 23 moved.
        assert_eq!(
            starts,
            vec![
                "10-19 09:00",
                "10-23 10:30",
                "10-26 10:00",
                "10-28 10:00",
                "10-30 10:00"
            ]
        );
        assert_eq!(standups[0].end - standups[0].start, Duration::minutes(15));
        assert_eq!(standups[1].title, "Standup (moved)");
    }

    #[test]
    fn all_day_events_span_a_day() {
        let occ = occurrences(
            FEED,
            utc("2026-10-22T00:00:00Z"),
            utc("2026-10-22T23:00:00Z"),
        );
        let holiday = occ.iter().find(|o| o.uid == "holiday").unwrap();
        assert!(holiday.all_day);
        assert_eq!(holiday.end - holiday.start, Duration::days(1));
    }

    #[test]
    fn monthly_ordinal_byday() {
        let feed = "BEGIN:VEVENT\nUID:m\nSUMMARY:Board\nDTSTART:20260106T170000Z\nRRULE:FREQ=MONTHLY;BYDAY=-1FR;UNTIL=20260430T000000Z\nEND:VEVENT\n";
        let occ = occurrences(
            feed,
            utc("2026-01-01T00:00:00Z"),
            utc("2026-12-31T00:00:00Z"),
        );
        let days: Vec<String> = occ
            .iter()
            .map(|o| o.start.format("%m-%d").to_string())
            .collect();
        assert_eq!(days, vec!["01-30", "02-27", "03-27", "04-24"]);
    }

    #[test]
    fn durations() {
        assert_eq!(parse_duration("PT1H30M"), Some(Duration::minutes(90)));
        assert_eq!(parse_duration("P1D"), Some(Duration::days(1)));
        assert_eq!(parse_duration("P1W"), Some(Duration::weeks(1)));
        assert_eq!(parse_duration("garbage"), None);
    }
}
