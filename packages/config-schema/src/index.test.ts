import { describe, expect, it } from "vitest";
import rulesFixture from "../fixtures/rules.json";
import settingsFixture from "../fixtures/settings.json";
import {
  addDockItem,
  appSettingsSchema,
  DEFAULT_ITEM_ORDER,
  defaultAppSettings,
  eventCatalog,
  migrateAppSettings,
  movePinnedApp,
  parseAppSettings,
  pinApp,
  removeDockItem,
  unpinApp,
  renderTemplate,
  reorderDockItems,
  ruleRecipes,
  ruleSchema,
  slugifyRuleId,
} from "./index";

describe("appSettingsSchema", () => {
  it("accepts defaults", () => {
    expect(appSettingsSchema.parse(defaultAppSettings)).toEqual(defaultAppSettings);
  });

  it("rejects invalid item ids", () => {
    expect(() =>
      parseAppSettings({
        ...defaultAppSettings,
        dock: { ...defaultAppSettings.dock, itemOrder: ["Bad Id"] },
      }),
    ).toThrow();
  });

  it("migrates version 1 documents", () => {
    const migrated = migrateAppSettings({
      version: 1,
      dock: {
        position: "top",
        size: "s",
        mode: "full",
        theme: "light",
        monitorId: null,
        itemOrder: ["clock", "add-widget"],
        clock24h: true,
        launchAtStartup: false,
      },
    });
    expect(migrated.version).toBe(4);
    expect(migrated.dock.position).toBe("top");
    expect(migrated.dock.style).toBe("glass");
    expect(migrated.taskbar.mode).toBe("normal");
    expect(migrated.dock.itemOrder).toEqual(["apps", "clock", "add-widget"]);
    expect(migrated.onboarded).toBe(true);
  });

  it("migrates version 2 documents and puts apps after Start", () => {
    const migrated = migrateAppSettings({
      version: 2,
      dock: {
        position: "bottom",
        size: "m",
        mode: "pill",
        theme: "dark",
        style: "glass",
        monitorId: null,
        itemOrder: ["start", "clock", "add-widget"],
        clock24h: false,
        launchAtStartup: true,
        autoHideInFullscreen: true,
      },
      taskbar: { mode: "hidden" },
    });
    expect(migrated.dock.itemOrder).toEqual(["start", "apps", "clock", "add-widget"]);
    expect(migrated.dock.startAction).toBe("launcher");
    expect(migrated.apps).toEqual({ pinned: [], groupWindows: true, showTitles: false });
  });

  it("migrates version 3 documents without changing them", () => {
    const v3 = { ...defaultAppSettings, version: 3, onboarded: false, dock: { ...defaultAppSettings.dock, style: "midnight" } };
    const migrated = migrateAppSettings(v3);
    expect(migrated).toEqual({ ...v3, version: 4 });
  });

  it("greets new installs", () => {
    expect(defaultAppSettings.onboarded).toBe(false);
    expect(defaultAppSettings.dock.itemOrder).toEqual(DEFAULT_ITEM_ORDER);
  });
});

describe("pinned apps", () => {
  const a = { name: "A", path: "C:\\A.lnk", target: null };
  const b = { name: "B", path: "C:\\B.lnk", target: null };

  it("pins once, case-insensitively", () => {
    expect(pinApp([a], { ...a, path: "c:\\a.lnk" })).toEqual([a]);
    expect(pinApp([a], b)).toEqual([a, b]);
  });

  it("unpins and reorders", () => {
    expect(unpinApp([a, b], "c:\\a.LNK")).toEqual([b]);
    expect(movePinnedApp([a, b], "C:\\B.lnk", -1)).toEqual([b, a]);
    expect(movePinnedApp([a, b], "C:\\A.lnk", -1)).toEqual([a, b]);
  });
});

describe("settings parity fixtures (shared with Rust)", () => {
  it.each(settingsFixture.valid.map((s, i) => [i, s]))("accepts valid #%i", (_, input) => {
    expect(appSettingsSchema.safeParse(input).success).toBe(true);
  });
  it.each(settingsFixture.invalid.map((s, i) => [i, s]))("rejects invalid #%i", (_, input) => {
    expect(appSettingsSchema.safeParse(input).success).toBe(false);
  });
});

describe("rule parity fixtures (shared with Rust)", () => {
  it.each(rulesFixture.valid.map((r) => [r.id, r]))("accepts %s", (_, input) => {
    expect(ruleSchema.safeParse(input).success).toBe(true);
  });
  it.each(rulesFixture.invalid.map((r) => [r.id, r]))("rejects %s", (_, input) => {
    expect(ruleSchema.safeParse(input).success).toBe(false);
  });
});

describe("catalog", () => {
  it("only ships recipes that reference known events", () => {
    const names = new Set(eventCatalog.map((e) => e.name));
    for (const recipe of ruleRecipes) {
      expect(names.has(recipe.when.event)).toBe(true);
    }
  });

  it("has unique recipe ids", () => {
    const ids = ruleRecipes.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("dock item helpers", () => {
  it("moves an item", () => {
    expect(reorderDockItems(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
  });

  it("adds before the add button and ignores duplicates", () => {
    expect(addDockItem(["clock", "add-widget"], "media")).toEqual(["clock", "media", "add-widget"]);
    expect(addDockItem(["clock", "add-widget"], "clock")).toEqual(["clock", "add-widget"]);
  });

  it("never leaves the dock empty", () => {
    expect(removeDockItem(["clock"], "clock")).toEqual(["add-widget"]);
  });
});

describe("templates and ids", () => {
  it("renders placeholders", () => {
    expect(renderTemplate("{{title}} in {{ minutesUntil }} min{{missing}}", { title: "Standup", minutesUntil: 5 })).toBe(
      "Standup in 5 min",
    );
  });

  it("slugifies unique ids", () => {
    expect(slugifyRuleId("Meeting Mode!", ["meeting-mode"])).toBe("meeting-mode-2");
  });
});
