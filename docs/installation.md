# Installing OpenDock

## System requirements

- Windows 10 or Windows 11, 64-bit
- Microsoft Edge WebView2 runtime (preinstalled on Windows 11; the installer fetches it on Windows 10 if it's missing)
- About 30 MB of disk space

## Download

Get the latest version from [GitHub Releases](https://github.com/isaacobenzy/OpenDock/releases/latest). Each release has:

| File | Use it when |
| --- | --- |
| `OpenDock_<version>_x64-setup.exe` | You're installing for yourself. Recommended. |
| `OpenDock_<version>_x64_en-US.msi` | You deploy software with Group Policy, Intune or another management tool |
| `SHA256SUMS.txt` | You want to verify the download |

### Verify the download

In PowerShell, in your Downloads folder:

```powershell
Get-FileHash .\OpenDock_0.2.0_x64-setup.exe -Algorithm SHA256
```

The hash must match the line for that file in `SHA256SUMS.txt` (letter case doesn't matter).

## Install

1. Run the installer.
2. Pre-1.0 builds aren't code-signed yet, so Windows SmartScreen may show *Windows protected your PC*. If the checksum matched, choose **More info**, then **Run anyway**.
3. When OpenDock starts for the first time, the welcome setup asks three things:
   - **Taskbar:** *Replace the taskbar* (recommended), *Auto-hide* or *Keep the taskbar*.
   - **Your apps:** which of your current taskbar pins to bring over.
   - **Look and feel:** style, theme, and whether to start with Windows.

You can change all of these later from the dock menu (right-click an empty part of the dock) or the hub.

## Update

Install the newer version over the existing one. Your settings, pins, todos, notes, rules and calendars are kept. An automatic updater is planned for 1.0.

## Uninstall

Use **Settings → Apps → Installed apps → OpenDock → Uninstall**. The uninstaller:

1. Restores the Windows taskbar to how it was before OpenDock changed it.
2. Removes OpenDock from startup.
3. Removes the program files.

Your data stays in `%APPDATA%\com.opendock.app` in case you reinstall. To remove it too, delete that folder, and delete any `OpenDock` entries in **Credential Manager → Windows Credentials**.

## Recovering the Windows taskbar

OpenDock restores the taskbar when it quits, when it crashes (a small guard process watches for that), before it signs out, restarts or shuts down the PC from the launcher, and when it's uninstalled. If Windows ends OpenDock some other way, for example a sign-out from the Windows menu, OpenDock repairs the taskbar the next time it starts.

If the taskbar is still hidden, try these in order:

1. **Restore it from OpenDock:** right-click the dock and choose **Restore the Windows taskbar**, or use the same button in the quick-actions tray. Then choose **Quit OpenDock** if you want the app to exit.
2. **Run the restore command:** press `Win+R` and run:

   ```
   "%LOCALAPPDATA%\OpenDock\opendock-desktop.exe" --restore-taskbar
   ```

   Adjust the path if you installed somewhere else.
3. **Turn off auto-hide in Windows:** open **Settings → Personalization → Taskbar → Taskbar behaviors** and clear **Automatically hide the taskbar**.
4. **Restart Windows Explorer:** open Task Manager (`Ctrl+Shift+Esc`), find **Windows Explorer**, and choose **Restart**.

If none of these work, please [open a bug report](https://github.com/isaacobenzy/OpenDock/issues/new?template=bug_report.yml) with your Windows version.

## Build from source

See [development.md](development.md).
