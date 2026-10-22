# Contributing to OpenDock

Thanks for helping build OpenDock. This guide explains how work flows through the project, from an idea to a release. Read it once before your first pull request; it will save you and the reviewers time.

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute

- **Report a bug** with the [bug report form](https://github.com/isaacobenzy/OpenDock/issues/new?template=bug_report.yml). Include your Windows version and steps to reproduce.
- **Suggest a feature or widget** with the [feature](https://github.com/isaacobenzy/OpenDock/issues/new?template=feature_request.yml) or [widget](https://github.com/isaacobenzy/OpenDock/issues/new?template=widget_request.yml) forms.
- **Improve the docs or website.** Small fixes can go straight to a pull request.
- **Write code.** Pick an issue labelled [`good first issue`](https://github.com/isaacobenzy/OpenDock/labels/good%20first%20issue) or [`help wanted`](https://github.com/isaacobenzy/OpenDock/labels/help%20wanted), and comment so nobody duplicates the work.
- **Report a vulnerability** privately, never in a public issue. See [SECURITY.md](SECURITY.md).

For anything larger than a bug fix, open an issue first so we can agree on the approach before you invest time. Changes to architecture, security boundaries or the automation rule format need a short [decision record](docs/adr/README.md).

## Set up your environment

Follow [docs/development.md](docs/development.md). In short: Node.js 20+, pnpm 9+, Rust stable (MSVC) and the Visual Studio 2022 C++ build tools, then:

```powershell
pnpm install
pnpm dev
```

## Branching model

Work moves in one direction:

```text
feat/*  →  develop  →  staging  →  main
```

| Branch | Purpose | Who merges |
| --- | --- | --- |
| `main` | Production. Always releasable. The website deploys from here, and every release is a tag on `main`. | Maintainers, from `staging` or a `hotfix/*` branch |
| `staging` | The release candidate. What is about to go to production. | Maintainers, from `develop` |
| `develop` | Integration branch. All feature work lands here first. | Maintainers, after review and green CI |
| `feat/<short-name>` | New features | Opened against `develop` |
| `fix/<short-name>` | Bug fixes | Opened against `develop` |
| `docs/<short-name>` | Documentation and website | Opened against `develop` |
| `chore/<short-name>` | Tooling, dependencies, CI | Opened against `develop` |
| `release/<version>` | Release preparation: version bump, changelog | Merged into `staging`, then `staging` into `main`, then `main` back into `develop` |
| `hotfix/<version>` | Urgent fix for a published release | Merged into `main`, then back into `staging` and `develop` |

`main`, `staging` and `develop` are protected: changes arrive by pull request with passing CI and at least one approving review.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/) so the changelog can be assembled from history:

```
feat(apps): show live window previews in the app panel
fix(taskbar): restore the taskbar when the dock crashes
docs: explain how to recover the taskbar after an uninstall
```

Common types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`. Use the scope for the area you touched (`dock`, `apps`, `widgets`, `automation`, `settings`, `platform`, `web`, `schema`). Mark breaking changes with `!` after the type and a `BREAKING CHANGE:` footer.

## Engineering rules

Every change follows [AGENTS.md](AGENTS.md). The short version:

- React components present; logic lives in Rust or in hooks and models. Components call `services/ipc.ts`.
- Every new setting, rule or manifest field gets a Rust type, a Zod schema and a parity fixture.
- Platform-specific code stays under `apps/desktop/src-tauri/src/platform/`.
- No network access without a declared host, and never any telemetry.
- Secrets go in the OS keychain, never in `settings.json` or SQLite.
- Every widget renders all sizes and its loading, empty and error states.
- Use design tokens; no raw colours in components.

## Before you open a pull request

Run the same checks CI runs:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm fmt:check
pnpm test:rust
cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml --all-targets -- -D warnings
```

If you touched the website, also run `pnpm build:web` and `pnpm lighthouse:web`.

If you changed anything that touches the Windows shell (taskbar, window enumeration, AppBar, startup), also walk the relevant rows of the [manual test matrix](docs/testing.md#manual-windows-matrix) and say in the PR which ones you ran.

## Definition of done

A pull request is ready to merge when:

1. It does what the linked issue describes, and the PR shows it (screenshot or short clip for UI changes).
2. Tests cover the new behaviour, and CI is green.
3. Documentation and `CHANGELOG.md` (under **Unreleased**) are updated for user-visible changes.
4. Accessibility is checked: keyboard use, labels and contrast.
5. There are no secrets, undeclared network calls, debug leftovers or dead code.
6. New dependencies are justified in the PR description.

## Review

- Keep pull requests focused. One concern per PR is easier to review and to revert.
- Reviewers aim to respond within a few days. A friendly ping after a week is welcome.
- Address feedback with new commits; maintainers squash-merge, so the PR title becomes the commit message and must follow Conventional Commits.

## Releases

Maintainers cut releases following [docs/releasing.md](docs/releasing.md). Contributors don't need to bump versions.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
