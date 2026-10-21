import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { footerNav, isCurrent, isExternal, primaryNav } from "./nav";
import { pages } from "./pages";

const pagesDir = fileURLToPath(new URL("../pages/", import.meta.url));

function pageExists(path: string): boolean {
  const route = path.split("#")[0];
  if (route === "/") return existsSync(`${pagesDir}index.astro`);
  return existsSync(`${pagesDir}${route.replace(/^\/|\/$/g, "")}/index.astro`);
}

describe("site navigation", () => {
  it("only links to pages that exist", () => {
    const internal = [...primaryNav, ...footerNav.flatMap((group) => group.links)]
      .map((link) => link.href)
      .filter((href) => !isExternal(href));
    for (const href of internal) {
      expect(pageExists(href), href).toBe(true);
    }
  });

  it("lists every page in the sitemap", () => {
    for (const path of pages) {
      expect(pageExists(path), path).toBe(true);
    }
  });

  it("marks the current page but never anchors", () => {
    expect(isCurrent("/widgets/", "/widgets/")).toBe(true);
    expect(isCurrent("/", "/widgets/")).toBe(false);
    expect(isCurrent("/#features", "/")).toBe(false);
  });
});
