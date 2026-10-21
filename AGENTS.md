# Engineering rules

These rules apply to every change in this repository, whether it's written by a person or with an AI coding assistant. Reviewers check them; CI enforces the ones a machine can.

Read [docs/architecture.md](docs/architecture.md) and any relevant [decision record](docs/adr/README.md) before changing a module.

## Architecture

1. **React presents, it doesn't decide.** Components render state and call `apps/desktop/src/services/ipc.ts`. Logic lives in Rust, or in plain TypeScript models and hooks with their own tests (for example `features/apps/model.ts`).
2. **One schema, two languages.** Every setting, rule or manifest field has a Rust type and a Zod schema in `packages/config-schema`, and a case in the shared fixtures (`packages/config-schema/fixtures`) that both test suites load. If they drift, CI fails.
3. **Platform code stays in `platform/`.** Win32 and other OS-specific calls live only in `apps/desktop/src-tauri/src/platform/`. No `cfg(windows)` anywhere else; expose a portable function with a fallback instead.
4. **Settings are versioned.** Changing the settings shape means bumping `SETTINGS_VERSION` and adding a migration in both Rust and TypeScript, with tests for upgrading older files.
5. **Database migrations are append-only.** Never edit a shipped migration in `store/mod.rs`; add a new one.

## Privacy and security

6. **No undeclared network access.** All HTTP goes through `net.rs`, which only allows hosts the caller declares. Widgets list their hosts in the catalog, and every request is written to the Privacy Ledger.
7. **No telemetry, ever.** No analytics, crash reporters that phone home, or remote feature flags.
8. **Secrets go in the OS keychain** through `secrets.rs`. Never in `settings.json`, SQLite, logs or error messages.
9. **Commands validate their input.** Every Tauri command checks its arguments, limits sizes, and only acts on known windows, apps and paths. New commands are added to the allow-list in `build.rs` and granted to the narrowest window capability that needs them.
10. **Always give the taskbar back.** Any code path that hides the taskbar or reserves a screen edge must restore it on exit, on crash (the guard process) and before power actions.

## User interface

11. **Every widget is complete.** It renders sizes `s`, `m` and `l`, and has loading, empty and error states, covered by `tiles.test.tsx`.
12. **Design tokens only.** Colours, radii, shadows and motion come from `apps/desktop/src/styles/tokens.css`. No raw hex values in components or feature CSS.
13. **Accessible by default.** Everything works with the keyboard, has a visible focus state and an accessible name, meets 4.5:1 contrast, and respects reduced motion.
14. **Write for people.** UI text is plain and specific. Say what happened and what to do next.

## Code quality

15. **Small, tested changes.** Add or update tests with every behaviour change. Prefer pure functions that are easy to test.
16. **Leave it green.** Before you finish, run:

    ```powershell
    pnpm lint; pnpm typecheck; pnpm test; pnpm fmt:check; pnpm test:rust
    cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml --all-targets -- -D warnings
    ```

17. **Justify dependencies.** New runtime dependencies need a reason in the pull request, a compatible license (MIT, Apache-2.0, BSD, ISC, MPL-2.0 or Zlib) and active maintenance.
18. **Comments explain constraints, not code.** Write a comment only when it tells the reader something the code can't, such as an OS quirk or an invariant.
19. **Update the docs.** User-visible changes update `CHANGELOG.md` under *Unreleased* and the relevant guide in `docs/`.

## Notes for AI coding assistants

- Work on one issue at a time and touch only what it needs.
- Don't invent APIs, versions or commit hashes. Look them up, and verify pinned action SHAs before using them.
- Don't commit generated files, local planning material, credentials or anything in `.gitignore`.
- Summarise what you changed, how you verified it, and any risk you couldn't rule out.
