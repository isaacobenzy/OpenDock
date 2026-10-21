# Project structure

OpenDock is a pnpm workspace with two apps and one shared package. This page is a map; [architecture.md](architecture.md) explains how the parts work together.

```
OpenDock/
├─ apps/
│  ├─ desktop/                 The OpenDock app
│  │  ├─ src/                  React UI (TypeScript)
│  │  └─ src-tauri/            Rust core and Tauri configuration
│  └─ web/                     Website (Astro, static)
├─ packages/
│  └─ config-schema/           Shared Zod schemas, migrations, automation catalog
├─ docs/                       Guides, architecture and decision records
├─ scripts/                    Maintainer scripts (release packaging)
└─ .github/                    CI, issue forms, PR template, CODEOWNERS
```

## `apps/desktop/src-tauri` — Rust core

```
src-tauri/
├─ build.rs                    Command allow-list; generates per-command permissions
├─ tauri.conf.json             App identity, window, CSP and installer settings
├─ capabilities/               What each window (dock, flyout, hub, toast) may call
├─ permissions/opendock.toml   Named groups of commands used by the capabilities
├─ windows/hooks.nsh           Installer hooks (restore the taskbar on uninstall)
└─ src/
   ├─ main.rs                  Entry point; handles the taskbar guard flags first
   ├─ lib.rs                   Builds the app: plugins, state, services, commands
   ├─ state.rs                 Shared application state and live caches
   ├─ geometry.rs              Dock rectangle maths (pure, unit tested)
   ├─ dock_layout.rs           Places the dock and reserves the screen edge
   ├─ net.rs                   The only HTTP client: host allow-list, size limits
   ├─ secrets.rs               OS keychain access
   ├─ commands/                Tauri commands, one file per area
   │  ├─ mod.rs                Settings, dock and system commands
   │  ├─ apps.rs               Windows, icons, launching, volume, power, previews
   │  ├─ widgets.rs            Todos, notes, focus, weather, calendars, ledger
   │  ├─ automation.rs         Rules, dry runs, activity and undo
   │  └─ windows.rs            Opening the hub, flyout and toast windows
   ├─ services/                Background work and the app catalog
   │  ├─ mod.rs                Pollers for system, media, fullscreen, focus, schedule
   │  ├─ apps.rs               Window and volume pollers, installed app index
   │  ├─ automation.rs         Bridges the event bus to the rule engine and actions
   │  ├─ calendar.rs           iCal feed refresh
   │  ├─ weather.rs            Open-Meteo forecasts and city search
   │  ├─ focus.rs              Focus timer state machine
   │  └─ windows.rs            Creating and positioning secondary windows
   ├─ engine/                  Logic with no Tauri dependency
   │  ├─ bus.rs                Event bus
   │  ├─ rules.rs              Rule validation and evaluation
   │  ├─ ical.rs               iCal parsing and recurrence
   │  └─ template.rs           `{{field}}` text templates
   ├─ settings/                Settings types, defaults, validation, migrations, file store
   ├─ store/                   SQLite: migrations and one module per table
   └─ platform/                The only place with OS-specific code
      ├─ mod.rs                Portable API and shared types
      ├─ win.rs                Monitors, fullscreen, media, stats, theme
      ├─ win_apps.rs           Windows, icons, launching, thumbnails, AppBar
      ├─ win_system.rs         Volume, shortcuts, power
      ├─ taskbar.rs            Taskbar modes, restore marker, guard process
      └─ fallback.rs           Non-Windows stand-ins
```

## `apps/desktop/src` — React UI

```
src/
├─ main.tsx                    Picks the root component from the window label
├─ app/App.tsx                 Dock window root
├─ services/                   The only code that talks to Tauri
│  ├─ ipc.ts                   Typed commands and events
│  ├─ live.tsx, liveContext.ts Live data providers (Loadable values)
│  ├─ settings.tsx             Settings provider with validated updates
│  ├─ appIcons.ts              Cached app icon lookups
│  └─ loadable.ts              loading | ready | error helper type
├─ features/
│  ├─ dock/                    Dock bar, drag to reorder, click guard
│  ├─ widgets/                 Widget catalog, tiles, icons, visuals, formatting
│  ├─ apps/                    Apps strip, tray and volume tiles, app model
│  ├─ flyout/                  Flyout root, dock menu and all panels
│  ├─ hub/                     Hub pages, Automation Studio, welcome flow
│  └─ toast/                   Toast window and queue
└─ styles/
   ├─ tokens.css               Design tokens: colour, radius, shadow, motion
   └─ base.css                 Shared primitives: buttons, inputs, states
```

Tests sit next to the code they cover (`*.test.ts`, `*.test.tsx`).

## `packages/config-schema`

```
config-schema/
├─ src/
│  ├─ settings.ts              Settings schema, defaults, migrations, pin helpers
│  ├─ rules.ts                 Rule schema and helpers
│  ├─ catalog.json             Automation events, conditions, actions and recipes
│  └─ index.ts                 Public exports
└─ fixtures/                   Valid and invalid examples shared with the Rust tests
```

## `apps/web`

```
web/
├─ astro.config.mjs            Site URL and build options
├─ lighthouserc.cjs            Accessibility, SEO and performance budgets
├─ public/                     Static assets, robots.txt, headers, llms.txt
└─ src/
   ├─ layouts/                 Page shell with metadata
   ├─ components/              Navigation, footer and shared sections
   ├─ data/                    Navigation, widgets, releases (single source for pages)
   ├─ pages/                   One folder per route
   └─ styles/global.css        Site styles
```
