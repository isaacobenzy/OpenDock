import { useEffect, useState } from "react";
import {
  errorText,
  hideToast,
  on,
  openHub,
  takePendingToasts,
  undoActivity,
  type ToastPayload,
} from "../../services/ipc";
import { Icon } from "../widgets/icons";
import { nextQueue, TOAST_MS } from "./queue";
import "./toast.css";

export function ToastApp() {
  const [queue, setQueue] = useState<ToastPayload[]>([]);
  const [hovered, setHovered] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const current = queue[0];

  useEffect(() => {
    void takePendingToasts()
      .then((pending) => setQueue((q) => nextQueue.push(q, pending)))
      .catch(() => undefined)
      .finally(() => setLoaded(true));
    return on("toast:show", (toast) => setQueue((q) => nextQueue.push(q, [toast])));
  }, []);

  useEffect(() => {
    if (!current || hovered) return;
    const timer = window.setTimeout(() => {
      setStatus(null);
      setQueue((q) => nextQueue.dismiss(q, current.id));
    }, TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [current, hovered]);

  useEffect(() => {
    if (loaded && queue.length === 0) void hideToast().catch(() => undefined);
  }, [loaded, queue.length]);

  if (!current) return null;

  const dismiss = () => {
    setStatus(null);
    setQueue((q) => nextQueue.dismiss(q, current.id));
  };

  const undo = () => {
    if (current.activityId === null) return;
    undoActivity(current.activityId)
      .then(() => {
        setStatus("Undone");
        window.setTimeout(dismiss, 900);
      })
      .catch((e) => setStatus(errorText(e)));
  };

  return (
    <div className="toast-frame">
      <div
        className="toast"
        role="status"
        aria-live="polite"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span className="toast-icon">
          <Icon name="spark" size={16} />
        </span>
        <button type="button" className="toast-body" onClick={() => void openHub("activity")}>
          <span className="toast-rule">{current.ruleName}</span>
          <span className="toast-text">{status ?? current.text}</span>
        </button>
        {queue.length > 1 ? <span className="toast-count">+{queue.length - 1}</span> : null}
        {current.canUndo && current.activityId !== null && status === null ? (
          <button type="button" className="toast-undo" onClick={undo}>
            <Icon name="undo" size={14} /> Undo
          </button>
        ) : null}
        <button type="button" className="toast-close" aria-label="Dismiss" onClick={dismiss}>
          <Icon name="close" size={14} />
        </button>
        {!hovered ? <span className="toast-timer" key={current.id} /> : null}
      </div>
    </div>
  );
}
