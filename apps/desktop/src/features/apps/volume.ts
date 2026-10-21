import type { IconName } from "../widgets/icons";

export function volumeIcon(level: number, muted: boolean): IconName {
  if (muted || level === 0) return "volume-mute";
  return level < 50 ? "volume-low" : "volume";
}
