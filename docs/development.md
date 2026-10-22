# Development setup

This guide gets a Windows machine ready to build and run OpenDock from source. It takes about 20 minutes, most of it downloads.

## Prerequisites

| Tool | Version | Why |
| --- | --- | --- |
| Windows | 10 or 11, 64-bit | OpenDock's shell integration is Windows-only today |
| [Rust](https://rustup.rs) | Stable, MSVC toolchain | The core; pinned by `rust-toolchain.toml` |
| Visual Studio 2022 Build Tools | *Desktop development with C++* workload | Linker and Windows SDK for Rust |
| [Node.js](https://nodejs.org) | 22 (see `.nvmrc`), 20 at minimum | Frontend tooling |
| [pnpm](https://pnpm.io) | 10 (see `packageManager` in `package.json`) | Workspace package manager |
| WebView2 runtime | Evergreen | Renders the UI; preinstalled on Windows 11 |

### Install with winget

```powershell
winget install --id Rustlang.Rustup
winget install --id Microsoft.VisualStudio.2022.BuildTools --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
winget install --id OpenJS.NodeJS.LTS
corepack enable
```

Restart the terminal, then check:

```powershell
rustc --version
node --version
pnpm --version
```

`rust-toolchain.toml` installs `rustfmt` and `clippy` automatically the first time you run `cargo`.

## Get the code

Fork the repository on GitHub, then:

```powershell
git clone https://github.com/<your-user>/OpenDock.git
cd OpenDock
git remote add upstream https://github.com/isaacobenzy/OpenDock.git
git switch develop
pnpm install
```

`develop` is where new work lands. `staging` is the release candidate. `main` is production, and the website deploys from it. See [Contributing](../CONTRIBUTING.md#branching-model).

## Everyday commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Runs the desktop app with hot reload for the UI. Rust changes trigger a rebuild. |
| `pnpm dev:web` | Runs the website at `http://localhost:4321` |
| `pnpm lint` | ESLint (including accessibility rules) and Astro checks |
| `pnpm typecheck` | TypeScript in every package |
| `pnpm test` | Vitest for the UI, schemas and website |
| `pnpm test:rust` | Rust unit tests |
| `pnpm fmt:check` | Rust formatting check (`cargo fmt` to fix) |
| `pnpm build:desktop` | Optimised release build of the app, without installers |
| `pnpm bundle:desktop` | Release build plus NSIS and MSI installers |
| `pnpm build:web` | Static website build in `apps/web/dist` |
| `pnpm lighthouse:web` | Builds the site and checks it against the Lighthouse budgets |

## Working safely with the taskbar

OpenDock can hide your taskbar while you develop. It's designed to always restore it, but development builds get killed in unusual ways. If the taskbar stays hidden:

```powershell
# From the repository, with a built binary:
cargo run --manifest-path apps/desktop/src-tauri/Cargo.toml -- --restore-taskbar
```

Or follow [Recovering the Windows taskbar](installation.md#recovering-the-windows-taskbar). Setting the taskbar mode to **Keep the taskbar** in the dock menu while you work avoids the issue entirely.

## Where your data lives during development

Development builds use the same locations as installed builds:

- Settings: `%APPDATA%\com.opendock.app\settings.json`
- Database: `%APPDATA%\com.opendock.app\opendock.db`
- Secrets: Windows Credential Manager, entries named `OpenDock`

To start fresh, quit OpenDock and delete the `com.opendock.app` folder. You'll see the welcome setup again on the next launch.

## Debugging

- **UI:** press `Ctrl+Shift+I` in a window (development builds only) to open the WebView2 developer tools. The dock and flyout handle right-clicks themselves, so the shortcut is the reliable way in.
- **Rust:** set `RUST_LOG=opendock_desktop_lib=debug` before `pnpm dev` for detailed logs.
- **Tests:** `pnpm --filter @opendock/desktop exec vitest` runs the UI tests in watch mode; `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml <name>` runs a single Rust test.

## Next steps

- Read [architecture.md](architecture.md) and the [engineering rules](../AGENTS.md).
- Pick an issue and follow the workflow in [CONTRIBUTING.md](../CONTRIBUTING.md).
