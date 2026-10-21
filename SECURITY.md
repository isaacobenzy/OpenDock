# Security Policy

OpenDock runs with the permissions of the signed-in user and can hide the Windows taskbar, enumerate windows and launch programs. We take reports about that surface seriously and appreciate responsible disclosure.

## Supported versions

OpenDock is pre-1.0. Only the latest release receives security fixes.

| Version | Supported |
| --- | --- |
| Latest release | Yes |
| Older releases | No, please upgrade |
| `develop` branch | Fixed before the next release |

## Reporting a vulnerability

**Please do not open a public issue, discussion or pull request for a vulnerability.**

Report it privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**, or go directly to the [private reporting form](https://github.com/isaacobenzy/OpenDock/security/advisories/new). Only maintainers can see the report.

Please include:

- The OpenDock version (shown in Windows Settings → Apps → Installed apps, or in the installer file name) and your Windows version
- What an attacker can achieve, and under which preconditions
- Steps to reproduce, or a proof of concept
- Any suggested fix or mitigation

## What to expect

| Step | Target time |
| --- | --- |
| Acknowledge your report | 3 working days |
| Confirm the issue and assess severity | 10 working days |
| Release a fix for high or critical issues | 30 days, sooner where possible |

We will keep you informed, agree a disclosure date with you, and credit you in the advisory and release notes unless you prefer to stay anonymous. We don't currently offer a paid bug bounty.

## Scope

In scope:

- The desktop application: the Rust core, the Tauri command surface and capabilities, and the React UI
- Taskbar and screen-edge handling, including restoring the taskbar on exit, crash and uninstall
- Settings, the SQLite store, keychain use and the network host allow-list
- Automation rules and templates
- The installers and the release artifacts published on GitHub
- The website in `apps/web`

Out of scope:

- Vulnerabilities in third-party services you connect, such as a calendar host, unless OpenDock's integration causes them
- Attacks that require an already-compromised account or administrator access to the machine
- Missing hardening headers on the website without a demonstrated impact
- Denial of service through local resource exhaustion by the same user

## Safe harbor

We will not pursue legal action against researchers who act in good faith, stay within this scope, avoid privacy violations and data destruction, and give us reasonable time to fix the issue before disclosure.

For how OpenDock is designed to protect users, see [docs/security.md](docs/security.md).
