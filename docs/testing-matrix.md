# Taskbar restore matrix

These are the ways OpenDock is supposed to give the Windows taskbar back. The code paths below exist. Automated tests cover the decision and the marker file. They do not drive the real Windows shell.

No row below has a recorded pass against an **installed** 0.2.0 build. Run them on a physical Windows 10 or 11 PC before treating the guarantee as proven, and write the result in the release pull request. A blank Result cell means it has not been run.

| Scenario | What the code does | Automated coverage | How to test it by hand | Result |
| --- | --- | --- | --- | --- |
| Quit | `RunEvent::Exit` in `apps/desktop/src-tauri/src/lib.rs` calls `taskbar.restore()`. | None for the Win32 call. | Turn on Replace. Quit from the dock menu. | Not recorded |
| Crash or force-close | A guard process started with `--taskbar-guard` waits for the main process and restores from `taskbar-restore.json` if the marker is still there. | `guard_args_are_recognised` checks the flag is recognised. It does not start a guard. | Turn on Replace. End only `opendock-desktop.exe` in Task Manager, not the guard. The taskbar should return within a few seconds. | Not recorded |
| Sign out, restart or shut down from the OpenDock launcher | `power_action` restores the taskbar before the power call when `PowerAction::ends_session()` is true. | `only_session_ending_power_actions_restore_the_taskbar_first` checks Lock and Sleep do not, and Sign out, Restart and Shut down do. | Turn on Replace. Sign out from the OpenDock launcher and confirm twice. Sign back in. The taskbar should have been restored before the session ended. | Not recorded |
| Windows ends the session some other way | On the next start, `recover_previous_run` restores a leftover marker before Replace is applied again. If Windows kills OpenDock and the guard together, auto-hide can stay on until that next start. The taskbar is still reachable by moving the pointer to the screen edge. See [ADR 0003](adr/0003-taskbar-replacement-with-guaranteed-restore.md). | `marker_round_trip` and `missing_marker_restores_nothing` cover the marker file only. | Turn on Replace. Sign out from the Windows menu. Sign back in before OpenDock starts, and check whether the taskbar is auto-hidden. Then start OpenDock and quit it. | Not recorded |
| Uninstall | `apps/desktop/src-tauri/windows/hooks.nsh` runs `opendock-desktop.exe --restore-taskbar` and removes the sign-in entry. | None. The flag is handled in `run_guard_from_args`. | Install 0.2.0, turn on Replace, uninstall from Settings → Apps. | Not recorded |
| Restore command | The dock menu and the quick-actions tray set the taskbar mode to Normal, which calls `restore()`. The same executable accepts `--restore-taskbar`. | The tray button is covered by `TrayTiles.test.tsx`. The command-line flag is not executed in tests, because it would change the machine running them. | With Replace on, choose **Restore the Windows taskbar** in the dock menu, and again from the tray icon. Then run the executable with `--restore-taskbar`. | Not recorded |

The marker file is `%APPDATA%\com.opendock.app\taskbar-restore.json`. It exists only while OpenDock has changed the taskbar. Restoring deletes it.

For the combined release, fault-injection tests additionally cover guard startup failure, partial apply rollback, failed restoration with retry, corrupted markers, repeated mode changes and a taskbar reappearing. These tests use a fake shell and do not count as installed-build passes. Verify a secondary taskbar reappearing while the primary remains hidden, a failed guard, startup error feedback and both NSIS/MSI uninstall paths on Windows. Failed restoration now retains the marker until the shell accepts the restore.

Recovery steps for someone whose taskbar is still hidden are in [installation.md](installation.md#recovering-the-windows-taskbar).
