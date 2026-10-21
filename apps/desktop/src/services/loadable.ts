export type Loadable<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; error: string };

export const loading = { status: "loading" } as const;

export function ready<T>(data: T): Loadable<T> {
  return { status: "ready", data };
}

export function failed<T>(error: string): Loadable<T> {
  return { status: "error", error };
}

export function dataOf<T>(value: Loadable<T>): T | undefined {
  return value.status === "ready" ? value.data : undefined;
}

/** Appends a sample and keeps the most recent `limit` values. */
export function pushSample(history: number[], value: number | null, limit = 30): number[] {
  if (value === null || Number.isNaN(value)) {
    return history;
  }
  const next = [...history, value];
  return next.length > limit ? next.slice(next.length - limit) : next;
}
