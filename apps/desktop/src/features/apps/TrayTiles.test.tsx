import { defaultAppSettings, type AppSettings } from "@opendock/config-schema";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsContext } from "../../services/settingsContext";
import { TrayTile } from "./TrayTiles";

describe("Restore the Windows taskbar", () => {
  it("sets the taskbar mode back to normal, including on a compact dock", async () => {
    const update = vi.fn(async (change: (current: AppSettings) => AppSettings) => {
      const next = change({ ...defaultAppSettings, taskbar: { mode: "replace" } });
      expect(next.taskbar.mode).toBe("normal");
      return null;
    });
    const { getByRole } = render(
      <SettingsContext.Provider
        value={{
          settings: { ...defaultAppSettings, taskbar: { mode: "replace" } },
          ready: true,
          update,
        }}
      >
        <TrayTile compact />
      </SettingsContext.Provider>,
    );

    await userEvent.click(getByRole("button", { name: "Restore the Windows taskbar" }));
    expect(update).toHaveBeenCalledOnce();
  });
});
