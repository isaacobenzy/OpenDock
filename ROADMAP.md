# Roadmap

OpenDock is **the local-first smart dock you can read, extend and trust.** Widgets publish facts on a local event bus, and rules you can see turn those facts into helpful actions. Nothing leaves your machine unless a widget declares it.

Three principles guide every decision:

1. **Glanceable.** Each widget answers one question in under two seconds.
2. **Acting, not just showing.** The dock pauses music before a meeting, warns before a limit, and always offers Undo.
3. **Auditable.** Open source, a privacy ledger, and no accounts, telemetry or license keys.

This roadmap is a statement of direction, not a promise of dates. Progress is tracked in [GitHub milestones](https://github.com/isaacobenzy/OpenDock/milestones), and anything here is open for discussion.

## Where we are

| Milestone | Scope | Status |
| --- | --- | --- |
| Foundations | Tauri shell, settings, floating dock, website | Done (0.1) |
| Dock core | Widget gallery, sizes, themes, dock styles, drag to reorder | Done (0.2) |
| Data layer | SQLite store and migrations, event bus, first-party widgets | Done (0.2) |
| Automations | Rule engine, Automation Studio, recipes, activity log and Undo | Done (0.2) |
| Windows shell integration | Taskbar replacement, screen-edge reservation, live window previews, restore on the exits OpenDock can see | Shipped in 0.2. A session end that kills OpenDock and the guard together can leave auto-hide on until the next launch. The manual restore rows are not yet recorded. |
| **1.0 for Windows** | Code-signed installer, auto-updater, winget package, accessibility audit, localisation framework, per-monitor layouts | **Next** |
| Widget SDK | `widget.json` manifest, sandboxed widget webviews, permission broker, starter template | Planned |
| Linux | X11 and wlroots compositors (KDE Plasma, Sway, Hyprland), MPRIS, Secret Service, AppImage, deb, Flatpak | Planned |
| macOS | Overlay panel dock, Keychain, vibrancy, notarised dmg | Planned |
| Ecosystem | Community widget index, scenes, shareable recipes | Planned |

## Ideas we're exploring

- **Scenes.** One-click profiles (Work, Focus, Present, Evening) that change the layout, quiet hours and active rules together.
- **Context-aware dock.** Widgets that adapt to the focused app, such as CI status when an editor is active.
- **Command palette and CLI.** A global hotkey to launch apps, run rules and toggle scenes, plus an `opendock` CLI and `opendock://` links.
- **Developer widgets.** Pull request reviews, CI status, container lists and a local webhook tile you can update with `curl`.
- **Personalisation.** Theme packs, widget stacks, and layout export and import.

## Platform notes

The dock sits at the operating system's shell boundary, so each platform has its own constraints:

- **Linux.** GNOME on Wayland doesn't support the layer-shell protocol, so a fully docked bar isn't possible there without an extension. Planned tiers: full support on KDE Plasma, Sway, Hyprland and X11 sessions; a floating dock on GNOME Wayland.
- **macOS.** There's no public API for system-wide media control, so media widgets will be best effort.

## Non-goals for 1.0

- A cloud service or account system of any kind
- A paid marketplace
- Hundreds of built-in widgets; a small set of excellent ones and an SDK come first

## Have an idea?

Open a [feature request](https://github.com/isaacobenzy/OpenDock/issues/new?template=feature_request.yml) or start a thread in [Discussions](https://github.com/isaacobenzy/OpenDock/discussions).
