import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { currentRelease } from "./releases";
import { widgets } from "./widgets";

const repoFile = (path: string) => readFileSync(new URL(`../../../../${path}`, import.meta.url), "utf8");

describe("website facts match the product", () => {
  it("lists exactly the widgets the app ships", () => {
    const catalog = repoFile("apps/desktop/src/features/widgets/catalog.ts");
    const appIds = [...catalog.matchAll(/^\s{4}id: "([^"]+)"/gm)].map((match) => match[1]).sort();
    expect(appIds.length).toBeGreaterThan(0);
    expect(widgets.map((widget) => widget.id).sort()).toEqual(appIds);
  });

  it("declares the same network hosts as the app", () => {
    const catalog = repoFile("apps/desktop/src/features/widgets/catalog.ts");
    const weather = /id: "weather"[\s\S]*?network: \[([^\]]*)\]/.exec(catalog)?.[1] ?? "";
    const hosts = [...weather.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
    expect(widgets.find((widget) => widget.id === "weather")?.network).toEqual(hosts);
  });

  it("advertises the version the installers are built with", () => {
    const tauri = JSON.parse(repoFile("apps/desktop/src-tauri/tauri.conf.json")) as { version: string };
    expect(currentRelease.version).toBe(tauri.version);
    expect(currentRelease.tag).toBe(`v${tauri.version}`);
    for (const file of currentRelease.files) {
      expect(file.name).toContain(`_${tauri.version}_`);
    }
  });

  it("has a changelog entry for the advertised version", () => {
    const changelog = repoFile("CHANGELOG.md");
    expect(changelog).toContain(`## [${currentRelease.version}] - ${currentRelease.date}`);
  });
});
