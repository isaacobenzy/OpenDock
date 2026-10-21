import type { ToastPayload } from "../../services/ipc";

export const TOAST_MS = 6000;
const MAX_QUEUED = 5;

export const nextQueue = {
  /** Adds toasts, skipping ids already queued. Past the cap it drops the oldest waiting
   * toasts but never the one on screen. */
  push(queue: ToastPayload[], incoming: ToastPayload[]): ToastPayload[] {
    const seen = new Set(queue.map((t) => t.id));
    const next = [...queue, ...incoming.filter((t) => !seen.has(t.id))];
    if (next.length <= MAX_QUEUED) return next;
    return [next[0], ...next.slice(next.length - (MAX_QUEUED - 1))];
  },
  dismiss(queue: ToastPayload[], id: string): ToastPayload[] {
    return queue.filter((t) => t.id !== id);
  },
};
