# Changelog

All notable changes to OpenDock are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/). Until 1.0, minor versions may include breaking changes; they are called out below.

## [Unreleased]

Nothing yet.

## [0.2.0] - 2026-10-21

The first release that can stand in for the Windows taskbar.

### Added

- **Taskbar replacement.** A new *Replace* mode hides the Windows taskbar and reserves the dock's screen edge, so maximised windows never sit under the dock. Auto-hide and keep-the-taskbar modes remain available.
- **Apps on the dock.** Pinned apps and open windows, grouped by app with a window count, running and active indicators, and optional window titles. Click to switch, click again to minimise, Shift-click or middle-click for a new window.
- **Live window previews.** Right-click an app to see a live preview of each window, switch to it, close it, open a new window, or pin and unpin the app.
- **Start launcher.** Search installed apps from the Start button, pin them, and lock, sleep, sign out, restart or shut down. Destructive power actions ask for a second click.
- **Volume and quick actions.** A volume widget (scroll to change, middle-click to mute, click for a slider and presets) and buttons for Windows quick settings, notifications and show desktop.
- **Welcome setup.** First launch walks through the taskbar choice, importing your pinned taskbar apps, and look and feel.
- **Apps & taskbar settings page.** Reorder, add and remove pins, import from the Windows taskbar, and choose grouping and titles.
- **Widget gallery.** Fourteen widgets in three sizes with loading, empty and error states: Start, Apps, Volume, Quick actions, Clock, Now playing, Focus timer, Todos, Notes, Next event, System, Battery, Weather and Day progress.
- **Local data layer.** A versioned SQLite store for todos, notes, focus sessions, rules, activity, calendars, a forecast cache and the network log.
- **Automation Studio.** Rules made of events, conditions and actions, with eleven recipes, dry runs, an activity log and Undo. New events: `app.window.opened` and `app.window.focused`.
- **Calendars.** Read-only iCal subscriptions. Feed links are stored in the OS keychain.
- **Privacy Ledger.** A record of every network request each widget made, kept on your device.
- **Guaranteed taskbar restore.** A guard process restores the taskbar if OpenDock crashes, and the uninstaller restores it and removes the sign-in entry.

### Changed

- Settings move to version 3. Older settings files are migrated automatically, and the Apps widget is added after Start.
- The Start button opens the OpenDock launcher by default. You can switch back to Windows Start in Dock settings.

### Fixed

- Clicking a different app while another app's panel was closing no longer gets swallowed.

## [0.1.0-milestone-2] - 2026-10-21

### Added

- Tauri 2 and React monorepo.
- Floating dock prototype with a live clock and persisted layout.
- Fullscreen auto-hide on Windows.
- Settings stored in `settings.json`, validated in Rust and with Zod.
- Marketing website.

[Unreleased]: https://github.com/isaacobenzy/OpenDock/compare/v0.2.0...develop
[0.2.0]: https://github.com/isaacobenzy/OpenDock/compare/v0.1.0-milestone-2...v0.2.0
[0.1.0-milestone-2]: https://github.com/isaacobenzy/OpenDock/releases/tag/v0.1.0-milestone-2
