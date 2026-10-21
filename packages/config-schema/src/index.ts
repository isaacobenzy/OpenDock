import { z } from "zod";

export const SETTINGS_VERSION = 1;

export const dockPositionSchema = z.enum(["top", "bottom", "left", "right"]);
export const dockSizeSchema = z.enum(["s", "m", "l"]);
export const dockModeSchema = z.enum(["pill", "full"]);
export const themeSchema = z.enum(["dark", "light"]);

export const dockItemIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/);

export const dockSettingsSchema = z.object({
  position: dockPositionSchema.default("bottom"),
  size: dockSizeSchema.default("m"),
  mode: dockModeSchema.default("pill"),
  theme: themeSchema.default("dark"),
  monitorId: z.string().max(256).nullable().default(null),
  itemOrder: z.array(dockItemIdSchema).min(1).max(32).default(["clock", "add-widget"]),
  clock24h: z.boolean().default(false),
  launchAtStartup: z.boolean().default(false),
});

export const appSettingsSchema = z.object({
  version: z.literal(SETTINGS_VERSION),
  dock: dockSettingsSchema,
});

export type DockPosition = z.infer<typeof dockPositionSchema>;
export type DockSize = z.infer<typeof dockSizeSchema>;
export type DockMode = z.infer<typeof dockModeSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type DockSettings = z.infer<typeof dockSettingsSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;

export const defaultAppSettings: AppSettings = appSettingsSchema.parse({
  version: SETTINGS_VERSION,
  dock: {},
});

export function parseAppSettings(input: unknown): AppSettings {
  return appSettingsSchema.parse(input);
}

export function reorderDockItems(
  order: string[],
  activeId: string,
  overId: string,
): string[] {
  if (activeId === overId) {
    return order;
  }
  const from = order.indexOf(activeId);
  const to = order.indexOf(overId);
  if (from < 0 || to < 0) {
    return order;
  }
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, activeId);
  return next;
}
