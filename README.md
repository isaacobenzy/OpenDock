# OpenDock

Privacy-first, open-source desktop dock and widget platform for Windows. OpenDock runs locally without a mandatory account or cloud backend.

## Status (Milestone 2)

| Area | Status |
| --- | --- |
| Tauri 2 + React shell | Implemented |
| Floating dock window | Implemented (prototype) |
| Settings persistence (`settings.json`) | Implemented |
| Clock widget | Implemented |
| Widget gallery | Planned (Milestone 3) |
| SQLite data layer | Planned (Milestone 4) |
| Automation studio | Planned (Milestone 5) |
| Taskbar auto-hide integration | Planned (not in M2) |

## Requirements

- Windows 10/11 (64-bit)
- [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) runtime
- Node.js 20+
- pnpm 9+
- Rust stable (MSVC toolchain) with `rustfmt` and `clippy`
- Visual Studio 2022 Build Tools with the **Desktop development with C++** workload

See [docs/installation.md](docs/installation.md) for verified toolchain versions on the reference machine.

## Development

```powershell
pnpm install
pnpm dev
```

Other commands:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm fmt:check
pnpm test:rust
pnpm build:desktop
```

## Marketing site

```powershell
pnpm dev:web
pnpm build:web
pnpm lighthouse:web
```

Deploy to Cloudflare Pages: [docs/deployment-cloudflare.md](docs/deployment-cloudflare.md).

## Documentation

- [Architecture](docs/architecture.md)
- [Security](docs/security.md)
- [Manual Windows test matrix](docs/testing-matrix.md)
- [Milestone 2 report](docs/milestone-2-report.md)
- [Cloudflare deployment](docs/deployment-cloudflare.md)

## License

MIT — see [LICENSE](LICENSE).
