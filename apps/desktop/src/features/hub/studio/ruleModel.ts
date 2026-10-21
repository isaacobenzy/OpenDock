import {
  actionCatalog,
  conditionCatalog,
  describeComparator,
  eventCatalog,
  findEvent,
  ruleSchema,
  slugifyRuleId,
  type ActionKind,
  type Comparator,
  type ConditionKind,
  type EventDefinition,
  type EventFieldType,
  type Rule,
  type RuleAction,
  type RuleCondition,
} from "@opendock/config-schema";

export type Operator = "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "contains";
export type WhereRow = { field: string; op: Operator; value: string };

export const operatorLabels: Record<Operator, string> = {
  eq: "is",
  neq: "is not",
  lt: "is below",
  lte: "is at most",
  gt: "is above",
  gte: "is at least",
  contains: "contains",
};

export function operatorsFor(type: EventFieldType): Operator[] {
  if (type === "number") return ["lte", "lt", "gte", "gt", "eq", "neq"];
  if (type === "boolean") return ["eq"];
  return ["eq", "neq", "contains"];
}

export function fieldType(event: EventDefinition | undefined, field: string): EventFieldType {
  return event?.fields.find((f) => f.key === field)?.type ?? "string";
}

export function whereToRows(where: Record<string, Comparator>): WhereRow[] {
  const rows: WhereRow[] = [];
  for (const [field, comparator] of Object.entries(where)) {
    for (const op of Object.keys(operatorLabels) as Operator[]) {
      const value = comparator[op];
      if (value !== undefined) rows.push({ field, op, value: String(value) });
    }
  }
  return rows;
}

/** Converts editor rows back to the rule's `where` map, typing values by the event's fields. */
export function rowsToWhere(rows: WhereRow[], event: EventDefinition | undefined): Record<string, Comparator> {
  const where: Record<string, Comparator> = {};
  for (const row of rows) {
    if (!row.field) continue;
    const type = fieldType(event, row.field);
    const comparator: Record<string, unknown> = { ...(where[row.field] ?? {}) };
    if (row.op === "contains") {
      comparator.contains = row.value;
    } else if (type === "number") {
      const n = Number(row.value);
      comparator[row.op] = row.value.trim() === "" || Number.isNaN(n) ? row.value : n;
    } else if (type === "boolean") {
      comparator[row.op] = row.value === "true";
    } else {
      comparator[row.op] = row.value;
    }
    where[row.field] = comparator as Comparator;
  }
  return where;
}

export function defaultRow(event: EventDefinition | undefined): WhereRow {
  const field = event?.fields[0];
  if (!field) return { field: "", op: "eq", value: "" };
  const op = operatorsFor(field.type)[0];
  return { field: field.key, op, value: field.type === "boolean" ? "true" : "" };
}

export function defaultAction(kind: ActionKind): RuleAction {
  switch (kind) {
    case "toast.show":
      return { action: "toast.show", text: "Heads up", undo: false };
    case "system.theme.set":
      return { action: "system.theme.set", mode: "dark" };
    case "dock.theme.set":
      return { action: "dock.theme.set", mode: "dark" };
    case "focus.start":
      return { action: "focus.start" };
    case "dock.highlight":
      return { action: "dock.highlight", widget: "calendar" };
    default:
      return { action: kind } as RuleAction;
  }
}

export function defaultCondition(kind: ConditionKind): RuleCondition {
  return kind === "timeBetween"
    ? { condition: "timeBetween", start: "09:00", end: "17:00" }
    : ({ condition: kind } as RuleCondition);
}

export function blankRule(takenIds: string[]): Rule {
  return {
    id: slugifyRuleId("new rule", takenIds),
    name: "New rule",
    enabled: true,
    when: { event: eventCatalog[0].name, where: {} },
    then: [defaultAction("toast.show")],
    unless: [],
    cooldownMinutes: 0,
  };
}

export function copyRecipe(recipe: Rule, takenIds: string[]): Rule {
  return {
    ...(JSON.parse(JSON.stringify(recipe)) as Rule),
    id: takenIds.includes(recipe.id) ? slugifyRuleId(recipe.name, takenIds) : recipe.id,
    enabled: true,
  };
}

export type Validation = { ok: true; rule: Rule } | { ok: false; errors: string[] };

const pathLabels: Record<string, string> = {
  name: "Name",
  when: "Trigger",
  then: "Actions",
  unless: "Exceptions",
  cooldownMinutes: "Cooldown",
};

export function validateRule(rule: unknown): Validation {
  const result = ruleSchema.safeParse(rule);
  if (result.success) return { ok: true, rule: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((issue) => {
      const head = String(issue.path[0] ?? "");
      const where = pathLabels[head] ?? (head || "Rule");
      const index = typeof issue.path[1] === "number" ? ` ${issue.path[1] + 1}` : "";
      return `${where}${index}: ${issue.message}`;
    }),
  };
}

export function actionLabel(kind: ActionKind): string {
  return actionCatalog.find((a) => a.action === kind)?.label ?? kind;
}

export function isUndoable(kind: ActionKind): boolean {
  return actionCatalog.find((a) => a.action === kind)?.undoable ?? false;
}

export function conditionLabel(condition: RuleCondition): string {
  if (condition.condition === "timeBetween") return `time is between ${condition.start} and ${condition.end}`;
  return (conditionCatalog.find((c) => c.condition === condition.condition)?.label ?? condition.condition).toLowerCase();
}

function describeAction(action: RuleAction): string {
  switch (action.action) {
    case "toast.show":
      return `show “${action.text}”`;
    case "system.theme.set":
      return action.mode === "toggle" ? "toggle the Windows theme" : `switch Windows to ${action.mode}`;
    case "dock.theme.set":
      return `make the dock ${action.mode}`;
    case "focus.start":
      return action.minutes ? `start a ${action.minutes} min focus round` : "start a focus round";
    case "dock.highlight":
      return `highlight ${action.widget}`;
    default:
      return actionLabel(action.action).toLowerCase();
  }
}

/** One plain-English sentence for the rule list. */
export function describeRule(rule: Rule): string {
  const event = findEvent(rule.when.event);
  const trigger = event ? event.label.charAt(0).toLowerCase() + event.label.slice(1) : rule.when.event;
  const filters = Object.entries(rule.when.where).map(([field, c]) => {
    const label = event?.fields.find((f) => f.key === field)?.label.toLowerCase() ?? field;
    return describeComparator(label, c);
  });
  let text = `When ${trigger}`;
  if (filters.length > 0) text += ` and ${filters.join(" and ")}`;
  text += `, ${rule.then.map(describeAction).join(", then ")}`;
  if (rule.unless.length > 0) text += `, unless ${rule.unless.map(conditionLabel).join(" or ")}`;
  return `${text}.`;
}

export function samplePayload(event: EventDefinition | undefined): Record<string, string> {
  const sample: Record<string, string> = {};
  for (const field of event?.fields ?? []) {
    sample[field.key] = field.type === "number" ? "10" : field.type === "boolean" ? "true" : "";
  }
  return sample;
}

export function typedPayload(
  event: EventDefinition | undefined,
  values: Record<string, string>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of event?.fields ?? []) {
    const raw = values[field.key] ?? "";
    if (field.type === "number") payload[field.key] = Number(raw) || 0;
    else if (field.type === "boolean") payload[field.key] = raw === "true";
    else payload[field.key] = raw;
  }
  return payload;
}
