import { describe, expect, it } from "vitest";
import { footerNav, primaryNav } from "./nav";

describe("site nav", () => {
  it("includes core marketing sections", () => {
    const labels = primaryNav.flatMap((group) => group.links.map((link) => link.label));
    expect(labels).toEqual(
      expect.arrayContaining(["Overview", "Widgets", "Showcase", "Feedback", "Docs", "Pricing"]),
    );
    expect(footerNav.length).toBeGreaterThan(0);
  });
});
