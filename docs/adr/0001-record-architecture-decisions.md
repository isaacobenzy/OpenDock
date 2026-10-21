# 0001. Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-10-21

## Context

OpenDock is opening up to outside contributors. Several of its design choices (two validators for the same schema, a guard process for the taskbar, rules stored as JSON) look surprising without their history, and that history so far lived only in the maintainers' heads.

## Decision

We will record significant architecture decisions as short Markdown files in `docs/adr/`, using the format in [template.md](template.md). They are numbered, kept forever, and changed only by being superseded.

## Consequences

- New contributors can learn why things are the way they are without asking.
- Proposals that reverse a decision have to engage with its original reasoning.
- Writing an ADR adds a small cost to large changes. That cost is intended.
