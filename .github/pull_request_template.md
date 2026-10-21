## What and why

<!-- What does this change, and why? Link the issue it closes. -->

Closes #

## How it was tested

<!-- Commands you ran, and manual steps. For UI changes, add a screenshot or short clip. -->

- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test`
- [ ] `pnpm fmt:check`, `pnpm test:rust` and clippy with `-D warnings`
- [ ] Manual Windows matrix rows (list them) if this touches the taskbar, windows, AppBar or startup
- [ ] `pnpm build:web` and `pnpm lighthouse:web` if this touches the website

## Checklist

- [ ] Follows [AGENTS.md](../AGENTS.md): no logic in components, schema parity, platform code in `platform/`, tokens only
- [ ] No undeclared network access, telemetry or secrets outside the keychain
- [ ] Widgets render every size and their loading, empty and error states
- [ ] Keyboard, labels and contrast checked
- [ ] `CHANGELOG.md` updated under *Unreleased* for user-visible changes
- [ ] Docs updated where behaviour or architecture changed
- [ ] New dependencies are justified below

## Notes for reviewers

<!-- Risks, follow-ups, or anything you'd like a second opinion on. -->
