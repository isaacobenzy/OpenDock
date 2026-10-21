# Governance

OpenDock is an open-source project licensed under MIT. This document describes how decisions are made and how contributors can take on more responsibility.

## Roles

**Users** run OpenDock and help by reporting bugs, requesting features and answering questions.

**Contributors** are anyone who has had a pull request, issue triage, documentation or design work accepted.

**Maintainers** review and merge pull requests, triage issues, cut releases and enforce the [Code of Conduct](CODE_OF_CONDUCT.md). Maintainers are listed in [`.github/CODEOWNERS`](.github/CODEOWNERS).

**Lead maintainer** has the final say when consensus can't be reached, owns the release keys and repository settings, and appoints maintainers. The project was started by [@isaacobenzy](https://github.com/isaacobenzy), who currently holds this role.

## Becoming a maintainer

Contributors who have made sustained, high-quality contributions over a few months, review others' work constructively, and follow the project's rules may be invited by an existing maintainer. The invitation is discussed among maintainers and accepted by lazy consensus (no objection within seven days).

Maintainers who are inactive for six months may be moved to emeritus status. They're welcome back at any time.

## Making decisions

- **Day-to-day changes** are decided in pull requests. One maintainer approval and green CI are enough.
- **Significant changes** (architecture, security boundaries, the rule format, new runtime dependencies, platform support) need an [architecture decision record](docs/adr/README.md) reviewed in a pull request, open for at least five days.
- **Disagreements** are resolved by discussion aimed at consensus. If that fails, the lead maintainer decides and records the reasoning in the ADR or issue.

## Code of Conduct

Everyone in the project's spaces follows the [Code of Conduct](CODE_OF_CONDUCT.md). Maintainers enforce it according to its enforcement guidelines.

## Changes to this document

Changes to governance follow the significant-change process above.
