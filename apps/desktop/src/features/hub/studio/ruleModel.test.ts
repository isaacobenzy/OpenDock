import { findEvent, ruleRecipes } from "@opendock/config-schema";
import { describe, expect, it } from "vitest";
import {
  blankRule,
  copyRecipe,
  defaultAction,
  defaultCondition,
  describeRule,
  operatorsFor,
  rowsToWhere,
  typedPayload,
  validateRule,
  whereToRows,
} from "./ruleModel";

const battery = findEvent("system.battery.changed");

describe("where clauses", () => {
  it("round-trips the recipes' comparators", () => {
    for (const recipe of ruleRecipes) {
      const event = findEvent(recipe.when.event);
      expect(rowsToWhere(whereToRows(recipe.when.where), event)).toEqual(recipe.when.where);
    }
  });

  it("types values by the event field", () => {
    const where = rowsToWhere(
      [
        { field: "percent", op: "lte", value: "20" },
        { field: "charging", op: "eq", value: "false" },
      ],
      battery,
    );
    expect(where).toEqual({ percent: { lte: 20 }, charging: { eq: false } });
  });

  it("merges several operators on one field", () => {
    const where = rowsToWhere(
      [
        { field: "percent", op: "gte", value: "10" },
        { field: "percent", op: "lt", value: "30" },
      ],
      battery,
    );
    expect(where).toEqual({ percent: { gte: 10, lt: 30 } });
  });

  it("leaves a non-numeric number for validation to reject", () => {
    const rule = blankRule([]);
    const where = rowsToWhere([{ field: "percent", op: "lte", value: "abc" }], battery);
    const result = validateRule({ ...rule, when: { event: "system.battery.changed", where } });
    expect(result.ok).toBe(false);
  });

  it("offers operators that fit each type", () => {
    expect(operatorsFor("boolean")).toEqual(["eq"]);
    expect(operatorsFor("string")).toContain("contains");
    expect(operatorsFor("number")).not.toContain("contains");
  });
});

describe("rules", () => {
  it("creates valid blank rules with unique ids", () => {
    const first = blankRule([]);
    expect(validateRule(first).ok).toBe(true);
    expect(blankRule([first.id]).id).not.toBe(first.id);
  });

  it("gives copied recipes a free id", () => {
    const recipe = ruleRecipes[0];
    expect(copyRecipe(recipe, []).id).toBe(recipe.id);
    const copy = copyRecipe(recipe, [recipe.id]);
    expect(copy.id).not.toBe(recipe.id);
    expect(copy.enabled).toBe(true);
    expect(validateRule(copy).ok).toBe(true);
  });

  it("builds valid default actions and conditions", () => {
    const rule = blankRule([]);
    for (const action of ["toast.show", "system.theme.set", "dock.theme.set", "focus.start", "dock.highlight", "media.pause"] as const) {
      expect(validateRule({ ...rule, then: [defaultAction(action)] }).ok, action).toBe(true);
    }
    for (const condition of ["quietHours", "timeBetween", "mediaPlaying"] as const) {
      expect(validateRule({ ...rule, unless: [defaultCondition(condition)] }).ok, condition).toBe(true);
    }
  });

  it("reports readable errors", () => {
    const result = validateRule({ ...blankRule([]), name: "  ", then: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.startsWith("Name"))).toBe(true);
      expect(result.errors.some((e) => e.startsWith("Actions"))).toBe(true);
    }
  });

  it("describes rules in plain English", () => {
    const lowBattery = ruleRecipes.find((r) => r.id === "battery-low");
    expect(lowBattery).toBeDefined();
    const text = describeRule(lowBattery!);
    expect(text.startsWith("When battery level changes")).toBe(true);
    expect(text).toContain("battery percent");
    expect(text.endsWith(".")).toBe(true);
  });

  it("types dry-run payloads", () => {
    expect(typedPayload(battery, { percent: "12", charging: "false" })).toEqual({ percent: 12, charging: false });
  });
});
