import { z } from "zod";
import catalogJson from "./catalog.json";
import { dockItemIdSchema } from "./settings";

const clockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:MM");
const scalarSchema = z.union([z.number(), z.string().max(200), z.boolean()]);

export const comparatorSchema = z
  .object({
    eq: scalarSchema.optional(),
    neq: scalarSchema.optional(),
    lt: z.number().optional(),
    lte: z.number().optional(),
    gt: z.number().optional(),
    gte: z.number().optional(),
    contains: z.string().max(200).optional(),
  })
  .refine((c) => Object.values(c).some((v) => v !== undefined), "comparator needs an operator");

export const triggerSchema = z.object({
  event: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z]+(\.[a-z]+)+$/, "event names look like calendar.event.starting"),
  where: z.record(z.string().min(1).max(64), comparatorSchema).default({}),
});

export const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("media.pause") }),
  z.object({ action: z.literal("media.play") }),
  z.object({ action: z.literal("media.next") }),
  z.object({
    action: z.literal("toast.show"),
    text: z.string().min(1).max(200),
    undo: z.boolean().default(false),
  }),
  z.object({ action: z.literal("system.theme.set"), mode: z.enum(["dark", "light", "toggle"]) }),
  z.object({ action: z.literal("dock.theme.set"), mode: z.enum(["dark", "light"]) }),
  z.object({ action: z.literal("focus.start"), minutes: z.number().int().min(1).max(180).optional() }),
  z.object({ action: z.literal("focus.stop") }),
  z.object({ action: z.literal("dock.highlight"), widget: dockItemIdSchema }),
]);

export const conditionSchema = z.discriminatedUnion("condition", [
  z.object({ condition: z.literal("quietHours") }),
  z.object({ condition: z.literal("focusActive") }),
  z.object({ condition: z.literal("fullscreenActive") }),
  z.object({ condition: z.literal("mediaPlaying") }),
  z.object({ condition: z.literal("timeBetween"), start: clockTimeSchema, end: clockTimeSchema }),
]);

export const ruleSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(1).max(80),
  enabled: z.boolean().default(true),
  when: triggerSchema,
  then: z.array(actionSchema).min(1).max(8),
  unless: z.array(conditionSchema).max(6).default([]),
  cooldownMinutes: z.number().int().min(0).max(1440).default(0),
});

export type Comparator = z.infer<typeof comparatorSchema>;
export type Trigger = z.infer<typeof triggerSchema>;
export type RuleAction = z.infer<typeof actionSchema>;
export type RuleCondition = z.infer<typeof conditionSchema>;
export type Rule = z.infer<typeof ruleSchema>;
export type ActionKind = RuleAction["action"];
export type ConditionKind = RuleCondition["condition"];

export type EventFieldType = "number" | "string" | "boolean";
export type EventField = { key: string; label: string; type: EventFieldType };
export type EventDefinition = { name: string; label: string; source: string; fields: EventField[] };
export type ActionDefinition = { action: ActionKind; label: string; undoable: boolean };
export type ConditionDefinition = { condition: ConditionKind; label: string };

export const eventCatalog = catalogJson.events as EventDefinition[];
export const actionCatalog = catalogJson.actions as ActionDefinition[];
export const conditionCatalog = catalogJson.conditions as ConditionDefinition[];
export const ruleRecipes: Rule[] = catalogJson.recipes.map((recipe) => ruleSchema.parse(recipe));

export function findEvent(name: string): EventDefinition | undefined {
  return eventCatalog.find((event) => event.name === name);
}

export function parseRule(input: unknown): Rule {
  return ruleSchema.parse(input);
}

/** Renders `{{field}}` placeholders from an event payload. Mirrors the Rust template module. */
export function renderTemplate(text: string, payload: Record<string, unknown>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = payload[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

export function describeComparator(field: string, comparator: Comparator): string {
  const parts: string[] = [];
  if (comparator.eq !== undefined) parts.push(`${field} is ${String(comparator.eq)}`);
  if (comparator.neq !== undefined) parts.push(`${field} is not ${String(comparator.neq)}`);
  if (comparator.lt !== undefined) parts.push(`${field} < ${comparator.lt}`);
  if (comparator.lte !== undefined) parts.push(`${field} ≤ ${comparator.lte}`);
  if (comparator.gt !== undefined) parts.push(`${field} > ${comparator.gt}`);
  if (comparator.gte !== undefined) parts.push(`${field} ≥ ${comparator.gte}`);
  if (comparator.contains !== undefined) parts.push(`${field} contains "${comparator.contains}"`);
  return parts.join(" and ");
}

export function slugifyRuleId(name: string, taken: string[]): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 56) || "rule";
  let candidate = base;
  let n = 2;
  while (taken.includes(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}
