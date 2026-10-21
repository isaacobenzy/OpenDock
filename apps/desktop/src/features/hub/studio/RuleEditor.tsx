import {
  actionCatalog,
  conditionCatalog,
  eventCatalog,
  findEvent,
  type ActionKind,
  type ConditionKind,
  type Rule,
  type RuleAction,
  type RuleCondition,
} from "@opendock/config-schema";
import { useMemo, useState } from "react";
import { dryRunRule, errorText, type Decision } from "../../../services/ipc";
import { widgetCatalog } from "../../widgets/catalog";
import { Icon } from "../../widgets/icons";
import {
  actionLabel,
  conditionLabel,
  defaultAction,
  defaultCondition,
  defaultRow,
  fieldType,
  isUndoable,
  operatorLabels,
  operatorsFor,
  rowsToWhere,
  samplePayload,
  typedPayload,
  validateRule,
  whereToRows,
  type Operator,
  type WhereRow,
} from "./ruleModel";

const sources = Array.from(new Set(eventCatalog.map((e) => e.source)));

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="icon-button" aria-label={label} title={label} onClick={onClick}>
      <Icon name="close" size={14} />
    </button>
  );
}

function ActionFields({ action, onChange }: { action: RuleAction; onChange: (a: RuleAction) => void }) {
  switch (action.action) {
    case "toast.show":
      return (
        <>
          <input
            className="text-input grow"
            aria-label="Toast text"
            value={action.text}
            maxLength={200}
            placeholder="Text, e.g. {{title}} starts in {{minutesUntil}} min"
            onChange={(e) => onChange({ ...action, text: e.target.value })}
          />
          <label className="check">
            <input
              type="checkbox"
              checked={action.undo}
              onChange={(e) => onChange({ ...action, undo: e.target.checked })}
            />
            Offer Undo
          </label>
        </>
      );
    case "system.theme.set":
      return (
        <select
          className="select"
          aria-label="Windows theme"
          value={action.mode}
          onChange={(e) => onChange({ ...action, mode: e.target.value as typeof action.mode })}
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="toggle">Toggle</option>
        </select>
      );
    case "dock.theme.set":
      return (
        <select
          className="select"
          aria-label="Dock theme"
          value={action.mode}
          onChange={(e) => onChange({ ...action, mode: e.target.value as typeof action.mode })}
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      );
    case "focus.start":
      return (
        <input
          className="text-input narrow"
          type="number"
          min={1}
          max={180}
          aria-label="Minutes"
          placeholder="Default"
          value={action.minutes ?? ""}
          onChange={(e) =>
            onChange({ ...action, minutes: e.target.value === "" ? undefined : Number(e.target.value) })
          }
        />
      );
    case "dock.highlight":
      return (
        <select
          className="select"
          aria-label="Widget"
          value={action.widget}
          onChange={(e) => onChange({ ...action, widget: e.target.value })}
        >
          {widgetCatalog.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      );
    default:
      return null;
  }
}

function ConditionFields({
  condition,
  onChange,
}: {
  condition: RuleCondition;
  onChange: (c: RuleCondition) => void;
}) {
  if (condition.condition !== "timeBetween") return null;
  return (
    <>
      <input
        className="text-input narrow"
        type="time"
        aria-label="From"
        value={condition.start}
        onChange={(e) => onChange({ ...condition, start: e.target.value })}
      />
      <span className="muted">to</span>
      <input
        className="text-input narrow"
        type="time"
        aria-label="To"
        value={condition.end}
        onChange={(e) => onChange({ ...condition, end: e.target.value })}
      />
    </>
  );
}

function DryRun({ candidate }: { candidate: Rule | null }) {
  const event = candidate ? findEvent(candidate.when.event) : undefined;
  const [values, setValues] = useState<Record<string, string>>(() => samplePayload(event));
  const [eventName, setEventName] = useState(event?.name);
  const [result, setResult] = useState<Decision | string | null>(null);

  if (event?.name !== eventName) {
    setEventName(event?.name);
    setValues(samplePayload(event));
    setResult(null);
  }

  const run = () => {
    if (!candidate || !event) return;
    dryRunRule(candidate, { name: event.name, payload: typedPayload(event, values) })
      .then(setResult)
      .catch((e) => setResult(errorText(e)));
  };

  return (
    <section className="studio-card">
      <header className="studio-card-head">
        <span className="studio-step">Test</span>
        <h3>Dry run</h3>
        <p className="muted">Pretend the event happened now. Nothing is executed.</p>
      </header>
      {event && event.fields.length > 0 ? (
        <div className="sample-grid">
          {event.fields.map((field) => (
            <label key={field.key} className="field">
              <span>{field.label}</span>
              {field.type === "boolean" ? (
                <select
                  className="select"
                  value={values[field.key] ?? "true"}
                  onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : (
                <input
                  className="text-input"
                  type={field.type === "number" ? "number" : "text"}
                  value={values[field.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                />
              )}
            </label>
          ))}
        </div>
      ) : (
        <p className="muted">This event has no details to fill in.</p>
      )}
      <div className="button-row">
        <button type="button" className="button" disabled={!candidate} onClick={run}>
          <Icon name="play" size={12} /> Run test
        </button>
        {!candidate ? <span className="muted">Fix the errors above to test.</span> : null}
      </div>
      {result === null ? null : typeof result === "string" ? (
        <p className="callout is-error" role="alert">
          {result}
        </p>
      ) : result.outcome === "fire" ? (
        <div className="callout is-ok" role="status">
          <strong>Would run:</strong>
          <ul>
            {result.actions.map((a, i) => (
              <li key={i}>
                {actionLabel(a.action)}
                {a.action === "toast.show" ? ` — “${a.text}”` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="callout is-warn" role="status">
          <strong>Would skip:</strong> {result.reason}
        </p>
      )}
    </section>
  );
}

export function RuleEditor({
  rule,
  isNew,
  onSave,
  onDelete,
}: {
  rule: Rule;
  isNew: boolean;
  onSave: (rule: Rule) => Promise<string | null>;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<Rule>(rule);
  const [rows, setRows] = useState<WhereRow[]>(() => whereToRows(rule.when.where));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const event = findEvent(draft.when.event);

  const candidateInput = useMemo(
    () => ({ ...draft, when: { event: draft.when.event, where: rowsToWhere(rows, event) } }),
    [draft, rows, event],
  );
  const validation = validateRule(candidateInput);
  const candidate = validation.ok ? validation.rule : null;
  const dirty = isNew || JSON.stringify(candidateInput) !== JSON.stringify(rule);

  const setAction = (i: number, action: RuleAction) =>
    setDraft({ ...draft, then: draft.then.map((a, j) => (j === i ? action : a)) });
  const setCondition = (i: number, condition: RuleCondition) =>
    setDraft({ ...draft, unless: draft.unless.map((c, j) => (j === i ? condition : c)) });
  const setRow = (i: number, row: WhereRow) => setRows(rows.map((r, j) => (j === i ? row : r)));

  const save = () => {
    if (!candidate) return;
    setSaving(true);
    setSaveError(null);
    void onSave(candidate).then((error) => {
      setSaving(false);
      setSaveError(error);
    });
  };

  const undoable = draft.then.some((a) => isUndoable(a.action));

  return (
    <div className="rule-editor">
      <div className="rule-editor-head">
        <input
          className="title-input"
          aria-label="Rule name"
          value={draft.name}
          maxLength={80}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <label className="switch">
          <input
            type="checkbox"
            role="switch"
            checked={draft.enabled}
            onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
          />
          <span className="switch-track" aria-hidden />
          <span>{draft.enabled ? "On" : "Off"}</span>
        </label>
      </div>

      <section className="studio-card">
        <header className="studio-card-head">
          <span className="studio-step">When</span>
          <h3>Trigger</h3>
        </header>
        <select
          className="select wide"
          aria-label="Event"
          value={draft.when.event}
          onChange={(e) => {
            setDraft({ ...draft, when: { event: e.target.value, where: {} } });
            setRows([]);
          }}
        >
          {sources.map((source) => (
            <optgroup key={source} label={source}>
              {eventCatalog
                .filter((ev) => ev.source === source)
                .map((ev) => (
                  <option key={ev.name} value={ev.name}>
                    {ev.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        {rows.map((row, i) => {
          const type = fieldType(event, row.field);
          return (
            <div className="clause-row" key={i}>
              <span className="clause-joiner">and</span>
              <select
                className="select"
                aria-label="Detail"
                value={row.field}
                onChange={(e) => {
                  const nextType = fieldType(event, e.target.value);
                  setRow(i, {
                    field: e.target.value,
                    op: operatorsFor(nextType)[0],
                    value: nextType === "boolean" ? "true" : "",
                  });
                }}
              >
                {event?.fields.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
              <select
                className="select"
                aria-label="Comparison"
                value={row.op}
                onChange={(e) => setRow(i, { ...row, op: e.target.value as Operator })}
              >
                {operatorsFor(type).map((op) => (
                  <option key={op} value={op}>
                    {operatorLabels[op]}
                  </option>
                ))}
              </select>
              {type === "boolean" ? (
                <select
                  className="select"
                  aria-label="Value"
                  value={row.value}
                  onChange={(e) => setRow(i, { ...row, value: e.target.value })}
                >
                  <option value="true">yes</option>
                  <option value="false">no</option>
                </select>
              ) : (
                <input
                  className="text-input grow"
                  aria-label="Value"
                  type={type === "number" && row.op !== "contains" ? "number" : "text"}
                  value={row.value}
                  maxLength={200}
                  onChange={(e) => setRow(i, { ...row, value: e.target.value })}
                />
              )}
              <RemoveButton label="Remove condition" onClick={() => setRows(rows.filter((_, j) => j !== i))} />
            </div>
          );
        })}
        {event && event.fields.length > 0 ? (
          <button type="button" className="text-button" onClick={() => setRows([...rows, defaultRow(event)])}>
            <Icon name="plus" size={12} /> Only if…
          </button>
        ) : null}
      </section>

      <section className="studio-card">
        <header className="studio-card-head">
          <span className="studio-step">Then</span>
          <h3>Actions</h3>
          {event && event.fields.length > 0 ? (
            <p className="muted">
              Toast text can use {event.fields.map((f) => `{{${f.key}}}`).join(", ")}
            </p>
          ) : null}
        </header>
        {draft.then.map((action, i) => (
          <div className="clause-row" key={i}>
            <span className="clause-joiner">{i === 0 ? "do" : "then"}</span>
            <select
              className="select"
              aria-label="Action"
              value={action.action}
              onChange={(e) => setAction(i, defaultAction(e.target.value as ActionKind))}
            >
              {actionCatalog.map((a) => (
                <option key={a.action} value={a.action}>
                  {a.label}
                </option>
              ))}
            </select>
            <ActionFields action={action} onChange={(a) => setAction(i, a)} />
            {draft.then.length > 1 ? (
              <RemoveButton
                label="Remove action"
                onClick={() => setDraft({ ...draft, then: draft.then.filter((_, j) => j !== i) })}
              />
            ) : null}
          </div>
        ))}
        {draft.then.length < 8 ? (
          <button
            type="button"
            className="text-button"
            onClick={() => setDraft({ ...draft, then: [...draft.then, defaultAction("toast.show")] })}
          >
            <Icon name="plus" size={12} /> Add action
          </button>
        ) : null}
        {undoable ? (
          <p className="muted small hint-row">
            <Icon name="undo" size={12} /> These changes can be undone from the toast or the activity log.
          </p>
        ) : null}
      </section>

      <section className="studio-card">
        <header className="studio-card-head">
          <span className="studio-step">Unless</span>
          <h3>Exceptions</h3>
        </header>
        {draft.unless.length === 0 ? <p className="muted">Always runs when the trigger matches.</p> : null}
        {draft.unless.map((condition, i) => (
          <div className="clause-row" key={i}>
            <span className="clause-joiner">{i === 0 ? "unless" : "or"}</span>
            <select
              className="select"
              aria-label="Exception"
              value={condition.condition}
              onChange={(e) => setCondition(i, defaultCondition(e.target.value as ConditionKind))}
            >
              {conditionCatalog.map((c) => (
                <option key={c.condition} value={c.condition}>
                  {c.label}
                </option>
              ))}
            </select>
            <ConditionFields condition={condition} onChange={(c) => setCondition(i, c)} />
            <RemoveButton
              label={`Remove ${conditionLabel(condition)}`}
              onClick={() => setDraft({ ...draft, unless: draft.unless.filter((_, j) => j !== i) })}
            />
          </div>
        ))}
        {draft.unless.length < 6 ? (
          <button
            type="button"
            className="text-button"
            onClick={() => setDraft({ ...draft, unless: [...draft.unless, defaultCondition("quietHours")] })}
          >
            <Icon name="plus" size={12} /> Add exception
          </button>
        ) : null}
        <label className="field inline">
          <span>Wait at least</span>
          <input
            className="text-input narrow"
            type="number"
            min={0}
            max={1440}
            value={draft.cooldownMinutes}
            onChange={(e) => setDraft({ ...draft, cooldownMinutes: Number(e.target.value) || 0 })}
          />
          <span>minutes between runs</span>
        </label>
      </section>

      <DryRun candidate={candidate} />

      {!validation.ok ? (
        <ul className="callout is-error" role="alert">
          {validation.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
      {saveError ? (
        <p className="callout is-error" role="alert">
          {saveError}
        </p>
      ) : null}

      <footer className="rule-editor-foot">
        <button type="button" className="button is-danger" onClick={onDelete}>
          <Icon name="trash" size={14} /> {isNew ? "Discard" : "Delete"}
        </button>
        <span className="grow" />
        {dirty && !isNew ? (
          <button
            type="button"
            className="button"
            onClick={() => {
              setDraft(rule);
              setRows(whereToRows(rule.when.where));
            }}
          >
            Revert
          </button>
        ) : null}
        <button type="button" className="button is-primary" disabled={!candidate || !dirty || saving} onClick={save}>
          {saving ? "Saving…" : isNew ? "Create rule" : "Save changes"}
        </button>
      </footer>
    </div>
  );
}
