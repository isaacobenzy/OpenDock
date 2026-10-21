# 0004. Automation rules are data, not code

- **Status:** Accepted
- **Date:** 2026-10-21

## Context

Automation Studio lets users make the dock react to events: an upcoming meeting, low battery, sunset. A scripting language (JavaScript, Lua) would be the most flexible option, but it would make rules hard to show in a visual editor, impossible to explain in an activity log, and a security risk: a shared rule could run arbitrary code.

## Decision

Rules are JSON documents with a fixed shape: **when** (one event plus optional field filters), **unless** (conditions such as quiet hours or "a focus round is running") and **then** (a list of actions). Events, conditions and actions are a closed set: Rust enums in `engine/rules.rs`, and one catalog of labels, filter fields and recipes in `packages/config-schema/src/catalog.json`, which the Rust engine and the TypeScript editor both load. Rules are validated by the same parity-tested schemas as settings ([ADR 0002](0002-shared-schemas-with-parity-fixtures.md)).

The engine adds guarantees no script could:

- a per-rule cooldown and a global limit of a few runs per minute, so a rule can't loop;
- de-duplication, so the same event doesn't fire a rule twice;
- an activity log entry for every run, with the reason it fired;
- an undo for actions that change state;
- a dry run that shows what a rule would do now, without doing it.

## Consequences

- Rules are safe to share and import, and every one can be edited in the visual editor.
- Adding a capability means adding an event or action to the catalog, with Rust and TypeScript changes and tests. That's slower than writing a script, on purpose.
- Some advanced automations can't be expressed. If demand grows, a sandboxed extension point would get its own ADR.
