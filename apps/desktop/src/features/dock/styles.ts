import type { DockStyle } from "@opendock/config-schema";

export type DockStyleOption = { value: DockStyle; label: string; description: string };

/** Every dock style in the order the pickers show them. */
export const DOCK_STYLES: readonly DockStyleOption[] = [
  { value: "glass", label: "Glass", description: "Frosted and see-through" },
  { value: "solid", label: "Solid", description: "Opaque, in the theme's colours" },
  { value: "midnight", label: "Midnight", description: "Deep gradient with an accent edge" },
  { value: "minimal", label: "Minimal", description: "No bar, so items float on your wallpaper" },
  { value: "neon", label: "Neon", description: "Dark with a glowing accent outline" },
  { value: "ink", label: "Ink", description: "Opaque and high contrast" },
];
