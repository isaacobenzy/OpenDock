import type { PinnedApp } from "@opendock/config-schema";
import { describe, expect, it } from "vitest";
import type { AppWindow, ShellApp, WindowsSnapshot } from "../../services/ipc";
import { buildAppEntries, decideAppClick, findEntry, isPinned, monogramTone, rankApps, toPinned } from "./model";

function win(id: number, exe: string, extra: Partial<AppWindow> = {}): AppWindow {
  return { id, title: `Window ${id}`, appId: exe.toLowerCase(), exe, appName: exe.split("\\").pop() ?? exe, minimized: false, ...extra };
}

const code: PinnedApp = { name: "Code", path: "C:\\Start\\Code.lnk", target: "C:\\Apps\\Code.exe" };
const notes: PinnedApp = { name: "Notes", path: "C:\\Apps\\Notes.exe", target: null };

const snapshot: WindowsSnapshot = {
  windows: [win(1, "C:\\Apps\\Code.exe"), win(2, "C:\\Apps\\Browser.exe"), win(3, "C:\\Apps\\Code.exe")],
  active: 3,
};

describe("app entries", () => {
  it("puts pins first and groups windows under them", () => {
    const entries = buildAppEntries([code, notes], snapshot, true);
    expect(entries.map((e) => e.name)).toEqual(["Code", "Notes", "Browser.exe"]);
    expect(entries[0].windows.map((w) => w.id)).toEqual([1, 3]);
    expect(entries[0]).toMatchObject({ pinned: true, active: true, launchPath: code.path });
    expect(entries[1]).toMatchObject({ windows: [], active: false });
    expect(entries[2]).toMatchObject({ pinned: false, launchPath: "C:\\Apps\\Browser.exe" });
  });

  it("gives every window its own entry when ungrouped", () => {
    const entries = buildAppEntries([code, notes], snapshot, false);
    expect(entries.map((e) => e.key)).toEqual(["c:\\apps\\code.exe#1", "c:\\apps\\code.exe#3", "c:\\apps\\notes.exe", "c:\\apps\\browser.exe#2"]);
    expect(entries.filter((e) => e.active).map((e) => e.key)).toEqual(["c:\\apps\\code.exe#3"]);
    expect(findEntry(entries, "c:\\apps\\notes.exe")?.name).toBe("Notes");
    expect(findEntry(entries, null)).toBeUndefined();
  });
});

describe("clicking an app", () => {
  const [pinnedCode, idleNotes, browser] = buildAppEntries([code, notes], snapshot, true);

  it("launches a pinned app that isn't running", () => {
    expect(decideAppClick(idleNotes, 3)).toEqual({ kind: "launch", path: notes.path });
  });

  it("brings a single window forward, then minimises it", () => {
    expect(decideAppClick(browser, 3)).toEqual({ kind: "activate", id: 2 });
    expect(decideAppClick(browser, 2)).toEqual({ kind: "minimize", id: 2 });
    const minimised = { ...browser, windows: [{ ...browser.windows[0], minimized: true }] };
    expect(decideAppClick(minimised, 2)).toEqual({ kind: "activate", id: 2 });
  });

  it("previews when an app has several windows", () => {
    expect(decideAppClick(pinnedCode, 3)).toEqual({ kind: "preview" });
  });

  it("does nothing for an unlaunchable idle entry", () => {
    expect(decideAppClick({ ...idleNotes, launchPath: null }, null)).toEqual({ kind: "none" });
  });
});

describe("launcher search", () => {
  const apps: ShellApp[] = ["Visual Studio Code", "Calculator", "Code Runner", "Microsoft Edge", "Notepad"].map((name) => ({
    name,
    path: `C:\\Start\\${name}.lnk`,
    target: null,
  }));

  it("ranks name prefixes over word prefixes over substrings", () => {
    expect(rankApps(apps, "code").map((a) => a.name)).toEqual(["Code Runner", "Visual Studio Code"]);
    expect(rankApps(apps, "ed").map((a) => a.name)).toEqual(["Microsoft Edge"]);
    expect(rankApps(apps, "vsc").map((a) => a.name)).toEqual(["Visual Studio Code"]);
    expect(rankApps(apps, "zzz")).toEqual([]);
  });

  it("lists everything up to the limit without a query", () => {
    expect(rankApps(apps, "  ", 2)).toHaveLength(2);
  });

  it("pins by path, ignoring case", () => {
    const pin = toPinned(apps[1]);
    expect(isPinned([pin], "c:\\start\\calculator.LNK")).toBe(true);
    expect(isPinned([pin], "c:\\start\\notepad.lnk")).toBe(false);
  });

  it("picks a stable monogram tone", () => {
    expect(monogramTone("Code")).toBe(monogramTone("Code"));
    expect(monogramTone("Code")).toBeGreaterThanOrEqual(0);
    expect(monogramTone("Code")).toBeLessThan(6);
  });
});
