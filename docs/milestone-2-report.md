# Milestone 2 report

Date: 2026-10-21  
Environment: Windows 10 (19045), Node 22.22.0, pnpm 10.34.4, Rust 1.99.1 (MSVC toolchain installed)

## Implemented

- Monorepo with `@opendock/desktop` (Tauri 2 + React) and `@opendock/config-schema`
- Floating dock window configuration (transparent, frameless, always on top, skip taskbar)
- Dock geometry engine with unit tests (all positions, pill/full modes)
- Versioned `settings.json` with atomic writes and invalid-file recovery
- Windows fullscreen detection thread (hides dock while another app is fullscreen)
- Single-instance and autostart plugins wired with least-privilege capabilities
- Dock UI: live clock, drag reorder, context menu, dark/light themes, reduced-motion CSS
- Marketing site `@opendock/web` (Astro) with Overview, Widgets, Showcase, Feedback, Docs, Pricing, Changelog, Roadmap navigation
- GitHub Actions CI for desktop checks; web Lighthouse gate in `apps/web/lighthouserc.cjs`

## Automated checks (local)

| Check | Result |
| --- | --- |
| `pnpm lint` | Pass |
| `pnpm typecheck` | Pass |
| `pnpm test` (Vitest) | Pass (5 tests across packages) |
| `pnpm --filter @opendock/desktop build` (frontend) | Pass |
| `cargo fmt --check` (desktop) | Pass |
| `cargo test` / `cargo clippy` / `pnpm build:desktop` | **Blocked** — MSVC `link.exe` not available while VS 2022 Build Tools install was still running |
| `pnpm build:web` | Pass |
| `pnpm lighthouse:web` | Pass (accessibility and SEO ≥ 0.95; performance ≥ 0.9 after removing render-blocking Google Fonts) |

## Performance measurements

Not recorded: native app could not be launched until Rust linking succeeds. Re-run after Build Tools installation completes:

1. Cold start via Task Manager (CPU/memory for `OpenDock.exe`)
2. Idle CPU after 2 minutes at dock rest
3. `pnpm lighthouse:web` on static `apps/web/dist`

## Known limitations

- Taskbar auto-hide integration is **not** implemented (documented as planned)
- Widget gallery button is a placeholder until Milestone 3
- SQLite persistence deferred to Milestone 4
- GitHub URLs point to `opendock/opendock` placeholder org — update when repository is published
- Windows installer not produced in Milestone 2

## Next milestone

Milestone 3: system monitor, tasks, and local calendar widgets with loading/error states and mocked provider tests.
