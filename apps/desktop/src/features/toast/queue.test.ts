import { describe, expect, it } from "vitest";
import type { ToastPayload } from "../../services/ipc";
import { nextQueue } from "./queue";

const toast = (id: string): ToastPayload => ({ id, ruleName: "Rule", text: id, activityId: 1, canUndo: true });

describe("toast queue", () => {
  it("skips duplicates", () => {
    const q = nextQueue.push([toast("a")], [toast("a"), toast("b")]);
    expect(q.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("caps the queue without dropping the toast on screen", () => {
    const q = nextQueue.push([toast("current")], ["1", "2", "3", "4", "5", "6"].map(toast));
    expect(q).toHaveLength(5);
    expect(q[0].id).toBe("current");
    expect(q[4].id).toBe("6");
  });

  it("dismisses by id", () => {
    expect(nextQueue.dismiss([toast("a"), toast("b")], "a").map((t) => t.id)).toEqual(["b"]);
  });
});
