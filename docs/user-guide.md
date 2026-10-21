# User guide

A tour of what OpenDock can do once it's installed. If you haven't installed it yet, start with [installation.md](installation.md).

## The dock

The dock sits on one edge of your screen. Everything on it is a **widget**, and you can rearrange them by dragging.

- **Right-click an empty part of the dock** for the dock menu: size, theme, style, taskbar mode, the widget gallery, Automation Studio, settings and Quit.
- **Right-click a widget** to remove it or open its settings.
- **Click a widget** to open its panel, for example the month view from the clock or the full forecast from the weather.

Change the edge, shape (pill or full width), size and theme in **Dock settings**. During fullscreen games, videos and presentations the dock hides itself; turn that off in **Dock settings → Behaviour**.

## Apps and windows

The **Apps** widget is what replaces the taskbar. It shows your pinned apps first, then every other app with an open window.

| You do | OpenDock does |
| --- | --- |
| Click an app that isn't running | Starts it |
| Click an app with one window | Brings it to the front, or minimises it if it's already in front |
| Click an app with several windows | Shows its windows so you can pick one |
| Shift-click or middle-click | Opens a new window |
| Right-click | Shows live previews of every window, plus *New window*, *Pin*, *Close window* and *Close all* |

A short line under an icon means the app is running; a longer, coloured line marks the window in front. A number shows how many windows an app has.

Manage pins in **Apps & taskbar**: reorder them, add apps by searching, or import your Windows taskbar pins. You can also turn off grouping, so each window gets its own icon, and show window titles next to icons.

## Start launcher

Click **Start** to open the launcher.

- Start typing to search every installed app. Use the arrow keys and Enter, or click.
- Pin or unpin an app with the pin button next to it.
- The bottom row has **Lock**, **Sleep**, **Sign out**, **Restart** and **Shut down**. The last three ask you to click twice, so a stray click can't end your session.
- **Windows Start** opens the regular Windows menu. To make the Start button always do that, change *Start button* in **Dock settings**.

## Volume and quick actions

- **Volume:** scroll over it to change the volume, middle-click to mute, click for a slider and presets.
- **Quick actions:** buttons for Windows quick settings (Wi-Fi, Bluetooth, sound output), notifications, and show desktop.

## Widgets

Open the **Widget gallery** from the dock menu to add widgets. Each one shows what it stores and which internet hosts, if any, it contacts.

| Widget | What it shows | Network |
| --- | --- | --- |
| Start | Launcher with search, pins and power | None |
| Apps | Pinned apps and open windows | None |
| Volume | Output volume and mute | None |
| Quick actions | Quick settings, notifications, show desktop | None |
| Clock | Time and date; panel with month and agenda | None |
| Now playing | Track and controls for the current media app | None |
| Focus timer | Pomodoro rounds and a week of history | None |
| Todos | A local to-do list | None |
| Notes | Pinnable scratch notes | None |
| Next event | Countdown to your next calendar event | Your calendar host |
| System | CPU and memory | None |
| Battery | Charge level and state | None |
| Weather | Conditions, next hours and week | Open-Meteo |
| Day progress | How much of the day, week and year has passed | None |

## Calendars

In **Calendars**, paste the secret iCal address from Google Calendar, Outlook, iCloud or any other provider. OpenDock reads it every 15 minutes and keeps events on your device. The address itself is stored in Windows Credential Manager, not in a file.

## Automation Studio

Rules make the dock act for you. Each rule has:

- **When:** an event, such as *a calendar event is about to start*, optionally with a filter (*within 5 minutes*).
- **Unless:** conditions that stop it, such as *during quiet hours*.
- **Then:** actions, such as *pause media* and *show a toast*.

Start from a **recipe** (Meeting mode, Low battery warning, Sunset dark mode, Pause music for calls and others) and adjust it. **Dry run** shows what a rule would do right now. **Activity** lists every rule that ran and why, and actions marked *undoable* can be undone from the toast or the activity list. Set quiet hours in **Dock settings**.

## Privacy Ledger

**Privacy** in the hub lists every internet request OpenDock made: which widget, which host, when and how many times. OpenDock never sends telemetry, and widgets can only contact the hosts they declare.

## Taskbar modes

| Mode | What happens |
| --- | --- |
| Replace the taskbar | The taskbar is hidden and the dock reserves its edge of the screen, so maximised windows stop at the dock |
| Auto-hide | The taskbar slides away and reappears when you point at the screen edge |
| Keep the taskbar | Windows behaves as usual alongside the dock |
| Hide completely | The taskbar is hidden without reserving room for the dock |

Whatever you choose, the original taskbar comes back when OpenDock quits, crashes or is uninstalled. If it ever doesn't, see [Recovering the taskbar](installation.md#recovering-the-windows-taskbar).
