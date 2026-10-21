export type FlyoutMemory = {
  /** The panel the dock last opened, until the panel reports it closed. */
  openKind: string | null;
  hiddenKind: string | null;
  hiddenAt: number;
};

/** A panel hides when it loses focus, which happens on the very click that would reopen it. */
export const REOPEN_GUARD_MS = 350;

/** Panels for different apps or widgets are different panels, even of the same kind. */
export function flyoutKey(kind: string, target?: string | null): string {
  return target ? `${kind}:${target}` : kind;
}

export function decideTileClick(memory: FlyoutMemory, kind: string, now: number): "open" | "ignore" {
  if (memory.hiddenKind === kind && now - memory.hiddenAt < REOPEN_GUARD_MS) {
    return "ignore";
  }
  return "open";
}
