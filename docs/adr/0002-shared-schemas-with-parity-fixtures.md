# 0002. Shared schemas with parity fixtures

- **Status:** Accepted
- **Date:** 2026-10-21

## Context

Settings and automation rules cross the boundary between the React frontend and the Rust backend. Both sides must agree on what is valid: the UI needs to validate edits before saving and show helpful errors, and the backend must never trust what the UI sends, because a compromised webview could send anything.

Options considered:

1. **Validate only in Rust.** Simple, but the UI can't give instant feedback and would have to round-trip every keystroke.
2. **Generate TypeScript from Rust** (or the reverse). Removes duplication, but the generators don't express our refinements (ranges, cross-field rules, allowlists) and add build tooling contributors must understand.
3. **Two hand-written validators, held together by shared fixtures.**

## Decision

We will keep a Zod schema in `packages/config-schema` and Rust types with explicit `validate()` functions in `src-tauri/src/settings` and `src-tauri/src/engine`. Both are tested against the same JSON fixture files in `packages/config-schema/fixtures/`, which list valid and invalid documents. A change to either validator must come with fixture changes, and both test suites must pass.

## Consequences

- Each side uses idiomatic code and gives errors in its own terms.
- Drift is caught by tests rather than by users.
- Every schema change touches two languages, and contributors must remember to add fixtures. The pull request template and [AGENTS.md](../../AGENTS.md) call this out.
