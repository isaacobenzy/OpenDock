import { describe, expect, it } from "vitest";
import { decideTileClick, flyoutKey, REOPEN_GUARD_MS } from "./dockClick";

describe("dock tile clicks", () => {
  it("treats a click right after its panel closed as a close", () => {
    const memory = { openKind: null, hiddenKind: "media", hiddenAt: 1000 };
    expect(decideTileClick(memory, "media", 1000 + REOPEN_GUARD_MS - 1)).toBe("ignore");
  });

  it("opens other panels and later clicks", () => {
    const memory = { openKind: null, hiddenKind: "media", hiddenAt: 1000 };
    expect(decideTileClick(memory, "weather", 1001)).toBe("open");
    expect(decideTileClick(memory, "media", 1000 + REOPEN_GUARD_MS + 1)).toBe("open");
  });

  it("lets another app's panel open while one is closing", () => {
    const memory = { openKind: null, hiddenKind: flyoutKey("app", "c:\\code.exe"), hiddenAt: 1000 };
    expect(decideTileClick(memory, flyoutKey("app", "c:\\chrome.exe"), 1001)).toBe("open");
    expect(decideTileClick(memory, flyoutKey("app", "c:\\code.exe"), 1001)).toBe("ignore");
  });
});
