import { describe, expect, it } from "vitest";
import {
  appSettingsSchema,
  defaultAppSettings,
  parseAppSettings,
  reorderDockItems,
} from "./index";

describe("appSettingsSchema", () => {
  it("accepts defaults", () => {
    expect(appSettingsSchema.parse(defaultAppSettings)).toEqual(defaultAppSettings);
  });

  it("rejects invalid item ids", () => {
    expect(() =>
      parseAppSettings({
        version: 1,
        dock: { ...defaultAppSettings.dock, itemOrder: ["Bad Id"] },
      }),
    ).toThrow();
  });
});

describe("reorderDockItems", () => {
  it("moves an item", () => {
    expect(reorderDockItems(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
  });
});
