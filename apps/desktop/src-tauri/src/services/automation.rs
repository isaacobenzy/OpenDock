use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};
use std::thread;

use chrono::Local;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use crate::engine::bus::BusEvent;
use crate::engine::rules::{
    evaluate, parse_clock, Action, Decision, DockThemeMode, EvalContext, Rule, RuleEngine,
    SystemThemeMode,
};
use crate::platform::{self, MediaCommand};
use crate::settings::types::Theme;
use crate::state::{notify_changed, AppState};
use crate::store::{activity, now_ms, rules as rule_store};

use super::windows as dock_windows;

/// Reverse operations stored with each activity entry.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "op", rename_all = "camelCase")]
pub enum UndoOp {
    MediaPlay,
    MediaPause,
    SystemTheme { dark: bool },
    DockTheme { theme: Theme },
    FocusCancel,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToastPayload {
    pub id: String,
    pub rule_name: String,
    pub text: String,
    pub activity_id: Option<i64>,
    pub can_undo: bool,
}

#[derive(Default)]
pub struct Automation {
    engine: Mutex<RuleEngine>,
    rules: Mutex<Vec<Rule>>,
}

impl Automation {
    pub fn reload(&self, state: &AppState) {
        let loaded = state.db.with(rule_store::list).unwrap_or_default();
        if let Ok(mut rules) = self.rules.lock() {
            *rules = loaded;
        }
    }

    pub fn forget(&self, rule_id: &str) {
        if let Ok(mut engine) = self.engine.lock() {
            engine.forget(rule_id);
        }
    }

    fn snapshot(&self) -> Vec<Rule> {
        self.rules.lock().map(|r| r.clone()).unwrap_or_default()
    }
}

pub fn eval_context(state: &AppState) -> EvalContext {
    let settings = state.settings();
    let quiet = &settings.automation.quiet_hours;
    EvalContext {
        now: Some(Local::now().time()),
        quiet_hours: if quiet.enabled {
            parse_clock(&quiet.start).zip(parse_clock(&quiet.end))
        } else {
            None
        },
        focus_active: state.focus.is_focusing(),
        fullscreen_active: state.live.fullscreen.load(Ordering::Relaxed),
        media_playing: state.live.media.lock().map(|m| m.playing).unwrap_or(false),
    }
}

/// Studio dry run: what would this rule do for this event right now?
pub fn dry_run(state: &AppState, rule: &Rule, event: &BusEvent) -> Decision {
    if !rule.enabled {
        return Decision::Skip {
            reason: "rule is off".into(),
        };
    }
    evaluate(rule, event, &eval_context(state))
}

pub fn start(app: AppHandle, automation: Arc<Automation>) {
    let state = app.state::<AppState>();
    automation.reload(&state);
    let rx = state.bus.subscribe();
    thread::spawn(move || {
        for event in rx {
            let state = app.state::<AppState>();
            let _ = app.emit("bus:event", &event);
            if !state.settings().automation.enabled {
                continue;
            }
            for rule in automation.snapshot() {
                if rule.when.event != event.name {
                    continue;
                }
                let decision = {
                    let ctx = eval_context(&state);
                    let Ok(mut engine) = automation.engine.lock() else {
                        continue;
                    };
                    engine.decide(&rule, &event, &ctx, now_ms())
                };
                if let Decision::Fire { actions } = decision {
                    run_actions(&app, &state, &rule, &event, &actions);
                }
            }
        }
    });
}

struct Outcome {
    summaries: Vec<String>,
    undo: Vec<UndoOp>,
    toasts: Vec<(String, bool)>,
}

fn run_actions(
    app: &AppHandle,
    state: &AppState,
    rule: &Rule,
    event: &BusEvent,
    actions: &[Action],
) {
    let mut outcome = Outcome {
        summaries: vec![],
        undo: vec![],
        toasts: vec![],
    };
    for action in actions {
        if let Err(error) = execute(app, state, action, &mut outcome) {
            tracing::warn!(rule = rule.id, ?action, %error, "automation action failed");
            outcome.summaries.push(format!("failed: {error}"));
        }
    }
    if outcome.summaries.is_empty() && outcome.toasts.is_empty() {
        return;
    }
    let mut summary = outcome.summaries.join(", ");
    if summary.is_empty() {
        summary = "Showed a toast".into();
    }
    let undo_json = (!outcome.undo.is_empty())
        .then(|| serde_json::to_string(&outcome.undo).ok())
        .flatten();
    let can_undo = undo_json.is_some();
    let activity_id = state
        .db
        .with(|c| {
            activity::record(
                c,
                activity::NewEntry {
                    at: now_ms(),
                    rule_id: &rule.id,
                    rule_name: &rule.name,
                    event: &event.name,
                    summary: &summary,
                    undo: undo_json,
                },
            )
        })
        .ok();
    notify_changed(app, "activity");
    for (text, wants_undo) in outcome.toasts {
        dock_windows::show_toast(
            app,
            ToastPayload {
                id: format!("{}-{}", rule.id, now_ms()),
                rule_name: rule.name.clone(),
                text,
                activity_id,
                can_undo: wants_undo && can_undo,
            },
        );
    }
}

fn set_dock_theme(app: &AppHandle, state: &AppState, theme: Theme) -> Result<Theme, String> {
    let mut settings = state.settings();
    let previous = settings.dock.theme;
    settings.dock.theme = theme;
    crate::commands::persist_settings(app, state, settings)?;
    Ok(previous)
}

fn execute(
    app: &AppHandle,
    state: &AppState,
    action: &Action,
    out: &mut Outcome,
) -> Result<(), String> {
    match action {
        Action::MediaPause => {
            let playing = state.live.media.lock().map(|m| m.playing).unwrap_or(false);
            if playing {
                platform::media_command(MediaCommand::Pause)?;
                out.undo.push(UndoOp::MediaPlay);
                out.summaries.push("Paused media".into());
            }
        }
        Action::MediaPlay => {
            platform::media_command(MediaCommand::Play)?;
            out.undo.push(UndoOp::MediaPause);
            out.summaries.push("Played media".into());
        }
        Action::MediaNext => {
            platform::media_command(MediaCommand::Next)?;
            out.summaries.push("Skipped to the next track".into());
        }
        Action::ToastShow { text, undo } => {
            out.toasts.push((text.clone(), *undo));
        }
        Action::SystemThemeSet { mode } => {
            let was_dark = platform::system_dark_mode()
                .ok_or_else(|| "system theme is not available".to_string())?;
            let dark = match mode {
                SystemThemeMode::Dark => true,
                SystemThemeMode::Light => false,
                SystemThemeMode::Toggle => !was_dark,
            };
            if dark != was_dark {
                platform::set_system_dark_mode(dark)?;
                out.undo.push(UndoOp::SystemTheme { dark: was_dark });
                out.summaries.push(format!(
                    "Switched Windows to {}",
                    if dark { "dark" } else { "light" }
                ));
            }
        }
        Action::DockThemeSet { mode } => {
            let theme = match mode {
                DockThemeMode::Dark => Theme::Dark,
                DockThemeMode::Light => Theme::Light,
            };
            let previous = set_dock_theme(app, state, theme)?;
            if previous != theme {
                out.undo.push(UndoOp::DockTheme { theme: previous });
                out.summaries.push("Changed the dock theme".into());
            }
        }
        Action::FocusStart { minutes } => {
            let minutes = minutes.unwrap_or(state.settings().widgets.focus.focus_minutes);
            state.focus.start(&state.db, &state.bus, minutes)?;
            super::emit_focus(app, state);
            out.undo.push(UndoOp::FocusCancel);
            out.summaries
                .push(format!("Started a {minutes} min focus round"));
        }
        Action::FocusStop => {
            state.focus.stop(&state.db, &state.bus)?;
            super::emit_focus(app, state);
            out.summaries.push("Stopped the focus round".into());
        }
        Action::DockHighlight { widget } => {
            let _ = app.emit("dock:highlight", widget);
            out.summaries.push(format!("Highlighted {widget}"));
        }
    }
    Ok(())
}

pub fn undo(app: &AppHandle, state: &AppState, activity_id: i64) -> Result<(), String> {
    let entry = state
        .db
        .with(|c| activity::get(c, activity_id))?
        .ok_or_else(|| "activity not found".to_string())?;
    if entry.undone {
        return Ok(());
    }
    let ops: Vec<UndoOp> = entry
        .undo
        .as_deref()
        .map(serde_json::from_str)
        .transpose()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "this run cannot be undone".to_string())?;
    for op in ops.iter().rev() {
        match op {
            UndoOp::MediaPlay => {
                platform::media_command(MediaCommand::Play)?;
            }
            UndoOp::MediaPause => {
                platform::media_command(MediaCommand::Pause)?;
            }
            UndoOp::SystemTheme { dark } => platform::set_system_dark_mode(*dark)?,
            UndoOp::DockTheme { theme } => {
                set_dock_theme(app, state, *theme)?;
            }
            UndoOp::FocusCancel => {
                state.focus.stop(&state.db, &state.bus)?;
                super::emit_focus(app, state);
            }
        }
    }
    state.db.with(|c| activity::mark_undone(c, activity_id))?;
    notify_changed(app, "activity");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn undo_ops_round_trip() {
        let ops = vec![
            UndoOp::MediaPlay,
            UndoOp::SystemTheme { dark: true },
            UndoOp::DockTheme {
                theme: Theme::Light,
            },
            UndoOp::FocusCancel,
        ];
        let json = serde_json::to_string(&ops).unwrap();
        assert!(json.contains(r#""op":"systemTheme""#));
        let back: Vec<UndoOp> = serde_json::from_str(&json).unwrap();
        assert_eq!(back, ops);
    }
}
