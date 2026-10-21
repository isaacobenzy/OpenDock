# Security Policy

## Supported versions

OpenDock is pre-1.0. Security fixes are applied on the `main` branch.

## Reporting a vulnerability

Please report security issues privately by opening a GitHub Security Advisory or emailing the maintainers listed in the repository. Do not file public issues for undisclosed vulnerabilities.

Include:

- Affected version or commit
- Steps to reproduce
- Impact assessment
- Suggested fix if available

We aim to acknowledge reports within seven days.

## Scope

In scope: OpenDock application code, Tauri command surface, local settings handling, widget permission boundaries, and bundled dependencies.

Out of scope: third-party services configured with user-provided credentials unless the issue is in OpenDock's integration code.
