import { describe, expect, it } from "vitest";
import { clampScroll, pageScroll, scrollEdges, wheelDelta } from "./overflow";

describe("wheelDelta", () => {
  it("scrolls a horizontal dock with the mouse wheel", () => {
    expect(wheelDelta(0, 40, false)).toBe(40);
  });

  it("prefers a trackpad's sideways gesture", () => {
    expect(wheelDelta(-12, 40, false)).toBe(-12);
  });

  it("keeps a vertical dock on the wheel's own axis", () => {
    expect(wheelDelta(8, 30, true)).toBe(30);
    expect(wheelDelta(8, 0, true)).toBe(8);
  });
});

describe("clampScroll", () => {
  it("stays inside the strip", () => {
    expect(clampScroll(0, -20, 100)).toBe(0);
    expect(clampScroll(90, 40, 100)).toBe(100);
    expect(clampScroll(10, 15, 100)).toBe(25);
  });

  it("is zero when everything fits", () => {
    expect(clampScroll(0, 30, 0)).toBe(0);
  });
});

describe("scrollEdges", () => {
  it("reports which ends still have icons", () => {
    expect(scrollEdges(0, 200)).toEqual({ start: false, end: true });
    expect(scrollEdges(40, 200)).toEqual({ start: true, end: true });
    expect(scrollEdges(200, 200)).toEqual({ start: true, end: false });
  });

  it("ignores a couple of leftover pixels", () => {
    expect(scrollEdges(1, 2)).toEqual({ start: false, end: false });
  });
});

describe("pageScroll", () => {
  it("moves most of the visible strip, and at least one icon", () => {
    expect(pageScroll(200, 32)).toBe(160);
    expect(pageScroll(20, 32)).toBe(32);
  });
});
