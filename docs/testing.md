# Testing

OpenDock has three layers of tests. Automated tests run on every pull request; the manual matrix runs before each release, because no automated test can stand in for the real Windows shell.

## Automated tests

| Command | What it covers | Where tests live |
| --- | --- | --- |
| `pnpm test` | Frontend models and view logic, shared schemas, website data | `apps/desktop/src/**/*.test.ts`, `packages/config-schema/src/*.test.ts`, `apps/web/src/**/*.test.ts` |
| `pnpm test:rust` | Settings validation, rule engine, iCal parser, storage, network allowlist, taskbar logic | `#[cfg(test)]` modules next to the code in `apps/desktop/src-tauri/src/` |
| `pnpm lint` | ESLint for TypeScript and React | – |
| `pnpm typecheck` | `tsc` for every package | – |
| `cargo fmt --check`, `cargo clippy -- -D warnings` | Rust style and lints | – |
| `pnpm --filter @opendock/web lighthouse` | Website performance, accessibility, SEO and best practices | `apps/web/lighthouserc.cjs` |

### What to test

- **Pure logic first.** Keep decisions in plain functions (`model.ts`, `ruleModel.ts`, `engine/*.rs`) and test those. Components should be thin enough not to need tests of their own.
- **Shared schemas need fixtures.** When you change a type in `packages/config-schema`, add valid and invalid cases to `packages/config-schema/fixtures/`. The Rust and TypeScript tests both load these files, so the two validators can't drift apart. See [ADR 0002](adr/0002-shared-schemas-with-parity-fixtures.md).
- **Platform code is tested through its seams.** Win32 calls in `platform/` aren't unit-tested; the logic around them (ordering, filtering, validation) is pulled into plain functions and tested in `services/`.
- **Every bug fix gets a test** that fails without the fix, where possible.

### Writing tests

TypeScript tests use [Vitest](https://vitest.dev):

```ts
import { describe, expect, it } from "vitest";
import { buildAppEntries } from "./model";

describe("buildAppEntries", () => {
  it("puts pinned apps first", () => {
    // ...
  });
});
```

Rust tests sit at the bottom of the file they test:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_hosts_outside_the_allowlist() {
        // ...
    }
}
```

Run one test while working: `pnpm --filter @opendock/desktop exec vitest run model` or `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --offline rules`.

## Manual Windows matrix

Run this on a physical Windows machine with the **installed release build** (not `pnpm dev`) before tagging a release. Record the Windows version and build, display scale, and monitor setup in the release pull request.

| Area | Steps | Expected |
| --- | --- | --- |
| Install | Run the NSIS installer on a machine without OpenDock | Installs without admin rights; welcome setup opens |
| Welcome | Pick *Replace the taskbar*, import pins, finish | Taskbar hidden; imported pins appear in the Apps widget |
| Work area | Maximise a window | Window stops at the dock and doesn't go underneath |
| Apps | Launch, focus, minimise, switch between apps | Running and active indicators are correct within half a second |
| Grouped apps | Open three windows of one app, click it | Window chooser lists all three |
| Previews | Right-click an app with windows open | Live previews show and follow window content; none linger after closing |
| Launcher | Open Start, search, launch with Enter | Results rank sensibly; app starts; panel closes |
| Power | Click Restart once | Asks for confirmation; nothing happens until the second click |
| Volume | Scroll, middle-click, change in Windows | Dock follows the system volume and mute both ways |
| Media | Play in Spotify or a browser | Title and controls work; widget hides when nothing plays |
| Fullscreen | Fullscreen video, game and slideshow | Dock hides and returns afterwards |
| Multi-monitor | Move the dock to another monitor, then unplug it | Dock follows the selected monitor, then falls back to the primary |
| Display scale | Switch between 100%, 150% and 200% | Dock stays sharp, correctly sized and in place |
| Single instance | Start OpenDock twice | No second dock appears; the existing dock is shown |
| Invalid settings | Break the JSON in `settings.json`, restart | `settings.invalid-*.json` backup is created; defaults are used |
| Sleep | Sleep and resume | Dock is visible and responsive; stats resume |
| Quit restore | Quit from the dock menu | Taskbar comes back exactly as before |
| Crash restore | End `opendock-desktop.exe` in Task Manager | Guard restores the taskbar within a few seconds |
| Launcher power | Sign out from the OpenDock launcher in replace mode, sign back in | Taskbar restored before sign-out; OpenDock replaces it again on start |
| Windows sign out | Sign out from the Windows menu in replace mode, sign back in | OpenDock starts, repairs the leftover state, and applies replace mode cleanly |
| Restore flag | Run the executable with `--restore-taskbar` | Taskbar restored; no dock starts |
| Uninstall | Uninstall from Settings → Apps | Taskbar restored; no startup entry left; data folder kept |
| Automations | Enable *Meeting mode*, add an event starting in 3 minutes | Rule fires once, toast shows, Undo works |
| Calendars | Add a Google or Outlook iCal link | Events appear; Privacy Ledger shows only that host |
| Weather | Set a city | Forecast appears; Privacy Ledger shows only Open-Meteo |
| Offline | Disconnect the network, restart | Everything except weather and calendar sync works; no error dialogs |

File any failure as a bug and link it in the release pull request. A release doesn't ship with a failing row in **Install**, **Work area**, any **restore** row, or **Uninstall**.
