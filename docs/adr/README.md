# Architecture decision records

An architecture decision record (ADR) captures one significant decision: the context, what was decided, and the consequences. They explain *why* the code looks the way it does, so new contributors don't have to guess or relitigate settled questions.

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](0002-shared-schemas-with-parity-fixtures.md) | Shared schemas with parity fixtures | Accepted |
| [0003](0003-taskbar-replacement-with-guaranteed-restore.md) | Taskbar replacement with a guaranteed restore | Accepted |
| [0004](0004-rules-are-data.md) | Automation rules are data, not code | Accepted |
| [0005](0005-local-first-no-telemetry.md) | Local-first, no telemetry | Accepted |

## Writing one

Write an ADR when a change is hard to reverse, affects several parts of the system, or is likely to be questioned later: a new dependency with a large footprint, a new storage format, a change to the security model, a new window or process.

1. Copy [template.md](template.md) to `NNNN-short-title.md` with the next number.
2. Fill it in and open a pull request. Discussion happens on the pull request.
3. Once merged, an ADR isn't edited except for its status. To change a decision, write a new ADR that supersedes it and mark the old one *Superseded by NNNN*.
