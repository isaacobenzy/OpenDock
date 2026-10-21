# Installation and toolchain

## Supported platforms

| OS | Status |
| --- | --- |
| Windows 11 x64 | Supported (primary) |
| Windows 10 x64 | Supported (best-effort) |

Minimum build targets follow Tauri 2 and WebView2 requirements documented upstream. Re-validate after upgrading `@tauri-apps/cli`.

## Reference toolchain (local dev machine)

Record actual versions after install:

- Node.js 22.22.0
- pnpm 10.34.4
- Rust stable MSVC (`rust-toolchain.toml` pins stable + rustfmt + clippy)
- WebView2 runtime 155.x
- Visual Studio 2022 Build Tools with C++ workload

## Install dependencies

### Rust

```powershell
winget install Rustlang.Rustup
rustup default stable-x86_64-pc-windows-msvc
rustup component add rustfmt clippy
```

### Visual Studio Build Tools

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

### Node and pnpm

Use Node 20+ and enable pnpm via Corepack or a global install.

## Clone and run

```powershell
git clone <your-fork-url> OpenDock
cd OpenDock
pnpm install
pnpm dev
```

## Production build (no installer yet)

```powershell
pnpm build:desktop
```

Windows installer packaging is scheduled for Milestone 7.
