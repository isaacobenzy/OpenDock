import { useEffect, useState } from "react";

type Props = {
  use24h: boolean;
};

function formatTime(date: Date, use24h: boolean): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: !use24h,
  }).format(date);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function ClockWidget({ use24h }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="dock-item clock-widget" aria-label="Clock">
      <time dateTime={now.toISOString()} className="clock-time">
        {formatTime(now, use24h)}
      </time>
      <span className="clock-date">{formatDate(now)}</span>
    </div>
  );
}
