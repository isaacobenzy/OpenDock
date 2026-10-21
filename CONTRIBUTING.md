# Contributing to OpenDock

Thank you for helping build OpenDock. This project targets a maintainable Tauri + Rust + React codebase with strong privacy defaults.

## Getting started

1. Install the toolchain listed in [docs/installation.md](docs/installation.md).
2. Run `pnpm install` from the repository root.
3. Use `pnpm dev` to launch the desktop app.

## Pull requests

- Keep changes focused and include tests when behavior changes.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm fmt:check`, and `pnpm test:rust` before opening a PR.
- Document user-visible changes in the README feature matrix or relevant docs.
- Do not commit secrets, API keys, or local `.env` files.

## Code style

- TypeScript: strict mode, accessible UI controls, business logic outside presentational components.
- Rust: `cargo fmt`, `clippy -D warnings`, validated inputs at command boundaries.

## Security

Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).
