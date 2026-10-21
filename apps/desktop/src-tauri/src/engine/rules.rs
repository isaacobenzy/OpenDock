use std::collections::{BTreeMap, HashMap, HashSet};

use chrono::NaiveTime;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::bus::BusEvent;
use super::template;

const MAX_SEEN_KEYS: usize = 5_000;

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct Comparator {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub eq: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub neq: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lt: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lte: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gt: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gte: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub contains: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Trigger {
    pub event: String,
    #[serde(default, rename = "where")]
    pub where_: BTreeMap<String, Comparator>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SystemThemeMode {
    Dark,
    Light,
    Toggle,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DockThemeMode {
    Dark,
    Light,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "action")]
pub enum Action {
    #[serde(rename = "media.pause")]
    MediaPause,
    #[serde(rename = "media.play")]
    MediaPlay,
    #[serde(rename = "media.next")]
    MediaNext,
    #[serde(rename = "toast.show")]
    ToastShow {
        text: String,
        #[serde(default)]
        undo: bool,
    },
    #[serde(rename = "system.theme.set")]
    SystemThemeSet { mode: SystemThemeMode },
    #[serde(rename = "dock.theme.set")]
    DockThemeSet { mode: DockThemeMode },
    #[serde(rename = "focus.start")]
    FocusStart {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        minutes: Option<u32>,
    },
    #[serde(rename = "focus.stop")]
    FocusStop,
    #[serde(rename = "dock.highlight")]
    DockHighlight { widget: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "condition", rename_all = "camelCase")]
pub enum Condition {
    QuietHours,
    FocusActive,
    FullscreenActive,
    MediaPlaying,
    TimeBetween { start: String, end: String },
}

impl Condition {
    pub fn label(&self) -> String {
        match self {
            Condition::QuietHours => "quiet hours".into(),
            Condition::FocusActive => "a focus round is running".into(),
            Condition::FullscreenActive => "a fullscreen app is open".into(),
            Condition::MediaPlaying => "media is playing".into(),
            Condition::TimeBetween { start, end } => format!("time is between {start} and {end}"),
        }
    }
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Rule {
    pub id: String,
    pub name: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    pub when: Trigger,
    pub then: Vec<Action>,
    #[serde(default)]
    pub unless: Vec<Condition>,
    #[serde(default)]
    pub cooldown_minutes: u32,
}

pub fn is_valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

fn is_valid_event_name(name: &str) -> bool {
    if name.is_empty() || name.len() > 64 {
        return false;
    }
    let parts: Vec<&str> = name.split('.').collect();
    parts.len() >= 2
        && parts
            .iter()
            .all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_lowercase()))
}

pub fn parse_clock(value: &str) -> Option<NaiveTime> {
    let bytes = value.as_bytes();
    if bytes.len() != 5 || bytes[2] != b':' {
        return None;
    }
    NaiveTime::parse_from_str(value, "%H:%M").ok()
}

fn is_scalar(value: &Value) -> bool {
    match value {
        Value::Number(_) | Value::Bool(_) => true,
        Value::String(s) => s.chars().count() <= 200,
        _ => false,
    }
}

impl Rule {
    pub fn validate(&self) -> Result<(), String> {
        if !is_valid_id(&self.id) {
            return Err(format!("invalid rule id: {}", self.id));
        }
        let name_len = self.name.trim().chars().count();
        if name_len == 0 || name_len > 80 {
            return Err("rule name must be 1-80 characters".into());
        }
        if !is_valid_event_name(&self.when.event) {
            return Err(format!("invalid event name: {}", self.when.event));
        }
        for (field, cmp) in &self.when.where_ {
            if field.is_empty() || field.len() > 64 {
                return Err("invalid where field".into());
            }
            let has_op = cmp.eq.is_some()
                || cmp.neq.is_some()
                || cmp.lt.is_some()
                || cmp.lte.is_some()
                || cmp.gt.is_some()
                || cmp.gte.is_some()
                || cmp.contains.is_some();
            if !has_op {
                return Err(format!("comparator for {field} needs an operator"));
            }
            for v in [&cmp.eq, &cmp.neq].into_iter().flatten() {
                if !is_scalar(v) {
                    return Err(format!("comparator for {field} must compare a scalar"));
                }
            }
            if cmp
                .contains
                .as_ref()
                .is_some_and(|s| s.chars().count() > 200)
            {
                return Err("contains value is too long".into());
            }
        }
        if self.then.is_empty() || self.then.len() > 8 {
            return Err("a rule needs 1-8 actions".into());
        }
        for action in &self.then {
            match action {
                Action::ToastShow { text, .. } => {
                    let len = text.chars().count();
                    if len == 0 || len > 200 {
                        return Err("toast text must be 1-200 characters".into());
                    }
                }
                Action::FocusStart { minutes: Some(m) } if !(1..=180).contains(m) => {
                    return Err("focus minutes must be 1-180".into());
                }
                Action::DockHighlight { widget } if !is_valid_id(widget) => {
                    return Err(format!("invalid widget id: {widget}"));
                }
                _ => {}
            }
        }
        if self.unless.len() > 6 {
            return Err("a rule can have at most 6 unless conditions".into());
        }
        for condition in &self.unless {
            if let Condition::TimeBetween { start, end } = condition {
                if parse_clock(start).is_none() || parse_clock(end).is_none() {
                    return Err("timeBetween needs HH:MM times".into());
                }
            }
        }
        if self.cooldown_minutes > 1440 {
            return Err("cooldown must be at most 1440 minutes".into());
        }
        Ok(())
    }
}

/// Live facts the engine needs to evaluate `unless` conditions.
#[derive(Debug, Clone, Default)]
pub struct EvalContext {
    pub now: Option<NaiveTime>,
    pub quiet_hours: Option<(NaiveTime, NaiveTime)>,
    pub focus_active: bool,
    pub fullscreen_active: bool,
    pub media_playing: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "outcome", rename_all = "camelCase")]
pub enum Decision {
    Fire { actions: Vec<Action> },
    Skip { reason: String },
}

pub fn time_in_window(now: NaiveTime, start: NaiveTime, end: NaiveTime) -> bool {
    if start <= end {
        now >= start && now < end
    } else {
        now >= start || now < end
    }
}

fn as_f64(value: &Value) -> Option<f64> {
    match value {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.parse().ok(),
        _ => None,
    }
}

fn values_equal(a: &Value, b: &Value) -> bool {
    match (as_f64(a), as_f64(b)) {
        (Some(x), Some(y)) if a.is_number() || b.is_number() => (x - y).abs() < 1e-9,
        _ => match (a, b) {
            (Value::String(x), Value::String(y)) => x.eq_ignore_ascii_case(y),
            _ => a == b,
        },
    }
}

pub fn comparator_matches(cmp: &Comparator, value: Option<&Value>) -> bool {
    let Some(value) = value else {
        return false;
    };
    if let Some(eq) = &cmp.eq {
        if !values_equal(value, eq) {
            return false;
        }
    }
    if let Some(neq) = &cmp.neq {
        if values_equal(value, neq) {
            return false;
        }
    }
    let numeric = as_f64(value);
    type NumericCheck = (Option<f64>, fn(f64, f64) -> bool);
    let checks: [NumericCheck; 4] = [
        (cmp.lt, |v, t| v < t),
        (cmp.lte, |v, t| v <= t),
        (cmp.gt, |v, t| v > t),
        (cmp.gte, |v, t| v >= t),
    ];
    for (threshold, check) in checks {
        if let Some(t) = threshold {
            match numeric {
                Some(v) if check(v, t) => {}
                _ => return false,
            }
        }
    }
    if let Some(needle) = &cmp.contains {
        let haystack = match value {
            Value::String(s) => s.to_lowercase(),
            other => other.to_string().to_lowercase(),
        };
        if !haystack.contains(&needle.to_lowercase()) {
            return false;
        }
    }
    true
}

fn blocking_condition(rule: &Rule, ctx: &EvalContext) -> Option<String> {
    rule.unless.iter().find_map(|condition| {
        let blocked = match condition {
            Condition::QuietHours => match (ctx.now, ctx.quiet_hours) {
                (Some(now), Some((start, end))) => time_in_window(now, start, end),
                _ => false,
            },
            Condition::FocusActive => ctx.focus_active,
            Condition::FullscreenActive => ctx.fullscreen_active,
            Condition::MediaPlaying => ctx.media_playing,
            Condition::TimeBetween { start, end } => {
                match (ctx.now, parse_clock(start), parse_clock(end)) {
                    (Some(now), Some(s), Some(e)) => time_in_window(now, s, e),
                    _ => false,
                }
            }
        };
        blocked.then(|| condition.label())
    })
}

/// Applies the event payload to action templates.
pub fn render_actions(actions: &[Action], payload: &Value) -> Vec<Action> {
    actions
        .iter()
        .map(|action| match action {
            Action::ToastShow { text, undo } => Action::ToastShow {
                text: template::render(text, payload),
                undo: *undo,
            },
            other => other.clone(),
        })
        .collect()
}

/// Stateless check used by both the live engine and the Studio dry run.
pub fn evaluate(rule: &Rule, event: &BusEvent, ctx: &EvalContext) -> Decision {
    if rule.when.event != event.name {
        return Decision::Skip {
            reason: format!("waits for {}, got {}", rule.when.event, event.name),
        };
    }
    for (field, cmp) in &rule.when.where_ {
        if !comparator_matches(cmp, event.payload.get(field)) {
            return Decision::Skip {
                reason: format!(
                    "{field} is {}",
                    template::display(event.payload.get(field)).trim()
                ),
            };
        }
    }
    if let Some(label) = blocking_condition(rule, ctx) {
        return Decision::Skip {
            reason: format!("held because {label}"),
        };
    }
    Decision::Fire {
        actions: render_actions(&rule.then, &event.payload),
    }
}

/// A rule firing more often than this per minute is assumed to be feeding itself.
const MAX_FIRES_PER_MINUTE: usize = 6;

/// Stateful wrapper adding cooldowns, once-per-occurrence semantics and a loop breaker.
#[derive(Default)]
pub struct RuleEngine {
    last_fired_ms: HashMap<String, i64>,
    recent_fires: HashMap<String, Vec<i64>>,
    seen: HashSet<(String, String)>,
}

impl RuleEngine {
    pub fn decide(
        &mut self,
        rule: &Rule,
        event: &BusEvent,
        ctx: &EvalContext,
        now_ms: i64,
    ) -> Decision {
        if !rule.enabled {
            return Decision::Skip {
                reason: "rule is off".into(),
            };
        }
        if let Some(key) = &event.dedupe_key {
            if self.seen.contains(&(rule.id.clone(), key.clone())) {
                return Decision::Skip {
                    reason: "already handled this occurrence".into(),
                };
            }
        }
        if rule.cooldown_minutes > 0 {
            if let Some(last) = self.last_fired_ms.get(&rule.id) {
                let cooldown_ms = i64::from(rule.cooldown_minutes) * 60_000;
                if now_ms - last < cooldown_ms {
                    return Decision::Skip {
                        reason: "cooling down".into(),
                    };
                }
            }
        }
        let recent = self.recent_fires.entry(rule.id.clone()).or_default();
        recent.retain(|t| now_ms - t < 60_000);
        if recent.len() >= MAX_FIRES_PER_MINUTE {
            return Decision::Skip {
                reason: "fired too often in the last minute".into(),
            };
        }
        let decision = evaluate(rule, event, ctx);
        if matches!(decision, Decision::Fire { .. }) {
            recent.push(now_ms);
            self.last_fired_ms.insert(rule.id.clone(), now_ms);
            if let Some(key) = &event.dedupe_key {
                if self.seen.len() >= MAX_SEEN_KEYS {
                    self.seen.clear();
                }
                self.seen.insert((rule.id.clone(), key.clone()));
            }
        }
        decision
    }

    pub fn forget(&mut self, rule_id: &str) {
        self.last_fired_ms.remove(rule_id);
        self.recent_fires.remove(rule_id);
        self.seen.retain(|(id, _)| id != rule_id);
    }
}

#[derive(Debug, Deserialize)]
pub struct Catalog {
    pub recipes: Vec<Rule>,
}

const CATALOG_JSON: &str = include_str!("../../../../../packages/config-schema/src/catalog.json");

/// Built-in rule recipes shared with the TypeScript catalog.
pub fn recipes() -> Vec<Rule> {
    serde_json::from_str::<Catalog>(CATALOG_JSON)
        .map(|c| c.recipes)
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn meeting_rule() -> Rule {
        recipes()
            .into_iter()
            .find(|r| r.id == "meeting-mode")
            .expect("meeting-mode recipe")
    }

    fn starting(minutes: i64, key: &str) -> BusEvent {
        BusEvent::new(
            "calendar.event.starting",
            "calendar",
            json!({ "title": "Standup", "minutesUntil": minutes }),
        )
        .with_dedupe(key)
    }

    #[test]
    fn recipes_parse_and_validate() {
        let all = recipes();
        assert!(all.len() >= 5);
        for rule in all {
            rule.validate().unwrap();
        }
    }

    #[test]
    fn meeting_mode_fires_once_per_occurrence() {
        let rule = meeting_rule();
        let mut engine = RuleEngine::default();
        let ctx = EvalContext::default();
        assert!(matches!(
            engine.decide(&rule, &starting(10, "a"), &ctx, 0),
            Decision::Skip { .. }
        ));
        match engine.decide(&rule, &starting(5, "a"), &ctx, 1) {
            Decision::Fire { actions } => {
                assert!(actions.contains(&Action::MediaPause));
                assert!(actions.contains(&Action::ToastShow {
                    text: "Standup in 5 min".into(),
                    undo: true
                }));
            }
            other => panic!("expected fire, got {other:?}"),
        }
        assert!(matches!(
            engine.decide(&rule, &starting(4, "a"), &ctx, 2),
            Decision::Skip { .. }
        ));
        assert!(matches!(
            engine.decide(&rule, &starting(4, "b"), &ctx, 3),
            Decision::Fire { .. }
        ));
    }

    #[test]
    fn quiet_hours_hold_rules() {
        let rule = meeting_rule();
        let ctx = EvalContext {
            now: parse_clock("23:00"),
            quiet_hours: Some((parse_clock("22:00").unwrap(), parse_clock("07:00").unwrap())),
            ..Default::default()
        };
        match evaluate(&rule, &starting(3, "x"), &ctx) {
            Decision::Skip { reason } => assert!(reason.contains("quiet hours")),
            other => panic!("expected skip, got {other:?}"),
        }
    }

    #[test]
    fn cooldown_blocks_repeat_fires() {
        let mut rule = meeting_rule();
        rule.cooldown_minutes = 10;
        let mut engine = RuleEngine::default();
        let ctx = EvalContext::default();
        let event = |m| {
            BusEvent::new(
                "calendar.event.starting",
                "t",
                json!({ "minutesUntil": m, "title": "x" }),
            )
        };
        assert!(matches!(
            engine.decide(&rule, &event(1), &ctx, 0),
            Decision::Fire { .. }
        ));
        assert!(matches!(
            engine.decide(&rule, &event(1), &ctx, 60_000),
            Decision::Skip { .. }
        ));
        assert!(matches!(
            engine.decide(&rule, &event(1), &ctx, 11 * 60_000),
            Decision::Fire { .. }
        ));
    }

    #[test]
    fn self_feeding_rules_are_throttled() {
        let rule = Rule {
            id: "loop".into(),
            name: "Loop".into(),
            enabled: true,
            when: Trigger {
                event: "focus.session.started".into(),
                where_: BTreeMap::new(),
            },
            then: vec![Action::FocusStart { minutes: None }],
            unless: vec![],
            cooldown_minutes: 0,
        };
        let mut engine = RuleEngine::default();
        let ctx = EvalContext::default();
        let event = BusEvent::new("focus.session.started", "focus", json!({}));
        let fired = (0..20)
            .filter(|i| {
                matches!(
                    engine.decide(&rule, &event, &ctx, *i),
                    Decision::Fire { .. }
                )
            })
            .count();
        assert_eq!(fired, MAX_FIRES_PER_MINUTE);
    }

    #[test]
    fn comparators() {
        let c = Comparator {
            gte: Some(20.0),
            lt: Some(30.0),
            ..Default::default()
        };
        assert!(comparator_matches(&c, Some(&json!(25))));
        assert!(!comparator_matches(&c, Some(&json!(30))));
        assert!(!comparator_matches(&c, None));
        let eq_bool = Comparator {
            eq: Some(json!(false)),
            ..Default::default()
        };
        assert!(comparator_matches(&eq_bool, Some(&json!(false))));
        assert!(!comparator_matches(&eq_bool, Some(&json!(true))));
        let contains = Comparator {
            contains: Some("STAND".into()),
            ..Default::default()
        };
        assert!(comparator_matches(&contains, Some(&json!("Daily standup"))));
        let eq_time = Comparator {
            eq: Some(json!("21:30")),
            ..Default::default()
        };
        assert!(comparator_matches(&eq_time, Some(&json!("21:30"))));
    }

    #[test]
    fn time_windows_wrap_midnight() {
        let t = |s| parse_clock(s).unwrap();
        assert!(time_in_window(t("23:00"), t("22:00"), t("07:00")));
        assert!(time_in_window(t("06:59"), t("22:00"), t("07:00")));
        assert!(!time_in_window(t("12:00"), t("22:00"), t("07:00")));
        assert!(time_in_window(t("12:00"), t("09:00"), t("17:00")));
    }

    #[derive(Deserialize)]
    struct Fixture {
        valid: Vec<Value>,
        invalid: Vec<Value>,
    }

    fn parse_and_validate(value: &Value) -> Result<Rule, String> {
        let rule: Rule = serde_json::from_value(value.clone()).map_err(|e| e.to_string())?;
        rule.validate()?;
        Ok(rule)
    }

    #[test]
    fn parity_with_zod_rule_fixtures() {
        let fixture: Fixture = serde_json::from_str(include_str!(
            "../../../../../packages/config-schema/fixtures/rules.json"
        ))
        .unwrap();
        for value in &fixture.valid {
            parse_and_validate(value).unwrap_or_else(|e| panic!("{value}: {e}"));
        }
        for value in &fixture.invalid {
            assert!(
                parse_and_validate(value).is_err(),
                "expected invalid: {value}"
            );
        }
    }
}
