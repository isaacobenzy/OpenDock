/** How far a wheel event should move a dock strip. A horizontal dock treats an
 * ordinary (vertical) wheel as sideways scrolling, which is how a mouse reaches
 * a row. A trackpad's sideways gesture arrives as `deltaX` and wins. */
export function wheelDelta(deltaX: number, deltaY: number, vertical: boolean): number {
  if (vertical) return deltaY !== 0 ? deltaY : deltaX;
  return deltaX !== 0 ? deltaX : deltaY;
}

export function clampScroll(current: number, delta: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(max, Math.max(0, current + delta));
}

/** True when more content sits past either end. A couple of pixels don't count,
 * so sub-pixel rounding doesn't show a scroll button for a strip that fits. */
export function scrollEdges(offset: number, max: number): { start: boolean; end: boolean } {
  return { start: offset > 2, end: max - offset > 2 };
}

/** One click of a scroll button: most of a screen, at least one icon. */
export function pageScroll(viewport: number, icon: number): number {
  return Math.max(icon, Math.round(viewport * 0.8));
}
