# Changelog

All notable changes to OpenDock are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/). Until 1.0, minor versions may include breaking changes; they are called out below.

## [Unreleased]

### Added

- The homepage has a dock you can use in the browser: open apps, search from Start, change the volume, switch skins, and turn widgets on and off.
- Now playing opens from the dock, not a separate block. Previous and next switch between *Just 2 Minutes of Fusion Jazz!* by Giulio Carmassi and *Tokyo* by Toshiki Soejima. YouTube loads only while that widget is open.
- Contributor branches now run `develop` → `staging` → `main`.
- **Restore the Windows taskbar** in the dock menu and the quick-actions tray. It puts the taskbar back without waiting for the guard process.

### Changed

- The website and the README describe taskbar restore as the exits OpenDock can see, including the gap when Windows kills OpenDock and the guard together. The manual results are in `docs/testing-matrix.md`.
- The footer link that said Pricing now says Free. There is no paid plan.

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
- **Three more dock styles.** Minimal, Neon and Ink sit alongside Glass, Solid and Midnight.
- **A scrolling apps row.** When the dock reaches the edge of the screen, the apps slide sideways. The Start button, volume, tray, clock and system widgets stay put. New app icons animate in, and the motion is skipped when reduced motion is on.
- The website follows the system colour scheme, with a Light, Dark and System control that is remembered on this device. The homepage and the README show a screenshot of OpenDock running on Windows.

### Changed

- Settings move to version 4. Older settings files are migrated automatically. Version 3 only added the Apps widget after Start; version 4 adds the new dock styles.
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
