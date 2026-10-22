import { dockStyleSchema } from "@opendock/config-schema";
import { describe, expect, it } from "vitest";
import { DOCK_STYLES } from "./styles";

describe("DOCK_STYLES", () => {
  it("offers every style the settings accept, once", () => {
    expect(DOCK_STYLES.map((s) => s.value)).toEqual(dockStyleSchema.options);
  });

  it("gives each style a label and a description", () => {
    for (const style of DOCK_STYLES) {
      expect(style.label.length).toBeGreaterThan(0);
      expect(style.description.length).toBeGreaterThan(0);
    }
  });
});
