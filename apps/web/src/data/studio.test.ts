import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dockSkins, filterApps, nextFrontApp, studioApps } from "./studio";

const stylesSource = readFileSync(
  new URL("../../../../apps/desktop/src/features/dock/styles.ts", import.meta.url),
  "utf8",
);

describe("browser dock playground", () => {
  it("offers the same skins as the desktop app, in the same order", () => {
    const values = [...stylesSource.matchAll(/value: "([^"]+)"/g)].map((match) => match[1]);
    expect(dockSkins.map((skin) => skin.id)).toEqual(values);
  });

  it("filters apps by name and keeps the full list for a blank query", () => {
    expect(filterApps(studioApps, "   ")).toEqual([...studioApps]);
    expect(filterApps(studioApps, "no").map((app) => app.id)).toEqual(["notes"]);
    expect(filterApps(studioApps, "zzz")).toEqual([]);
  });

  it("brings a clicked app forward and minimises it on a second click", () => {
    expect(nextFrontApp(null, "files")).toBe("files");
    expect(nextFrontApp("files", "notes")).toBe("notes");
    expect(nextFrontApp("notes", "notes")).toBeNull();
  });
});
