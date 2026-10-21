import { describe, expect, it } from "vitest";
import { reorderDockItems } from "@opendock/config-schema";

describe("keyboard reorder helper", () => {
  it("moves items for sortable keyboard interactions", () => {
    expect(reorderDockItems(["clock", "add-widget"], "clock", "add-widget")).toEqual([
      "add-widget",
      "clock",
    ]);
  });
});
