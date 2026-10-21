# Security and privacy model

This page describes how OpenDock protects users and what it deliberately doesn't do. To report a vulnerability, follow [SECURITY.md](../SECURITY.md).

## Promises

1. **No account, no backend.** OpenDock has no server. Nothing requires signing in.
2. **No telemetry.** No analytics, usage tracking, remote crash reporting or remote configuration.
3. **Declared network access only.** A widget can reach only the hosts it declares, and every request is logged locally.
4. **Secrets stay in the OS keychain.** Never in settings files, the database or logs.
5. **The taskbar always comes back.** OpenDock never leaves the system without its taskbar.

## Threat model

OpenDock runs as the signed-in user, without elevation. It reads window titles, app names and media metadata, controls volume, launches programs, and hides the taskbar. The main risks are:

| Risk | Mitigation |
| --- | --- |
| A compromised or malicious page in a webview calls native commands | Strict CSP with no remote scripts; each window gets a capability with only the commands it needs; every command validates its input |
| Commands used to launch arbitrary programs | `launch_app` only accepts pinned apps, apps found in the Start menu, and executables of windows that are already running |
| Commands used to act on arbitrary windows | Window actions and previews only accept window handles the enumerator has reported |
| Data sent to unexpected hosts | `net.rs` rejects any host not explicitly allowed, before connecting; responses are size-limited; requests are recorded in the Privacy Ledger |
| Leaking calendar feed links (they act as passwords) | Stored in Windows Credential Manager; the database keeps only a display name and host |
| Rules triggering harmful actions | The action list is fixed and declared in the catalog; there's no shell or script action; actions that change state are undoable |
| Corrupt or hostile settings files | Parsed into strict types, size-limited and validated; invalid files are quarantined and defaults used |
| Taskbar left hidden after a crash | A guard process restores it from a marker file; restore also runs on panic, power actions and uninstall |
| Tampered downloads | SHA-256 checksums are published with every release; code signing is planned for 1.0 |

## Webview hardening

- Content Security Policy: `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self' ipc: http://ipc.localhost; script-src 'self'`. No remote scripts, frames or connections from the UI.
- Only Tauri's core APIs and two plugins are enabled: single instance and autostart. There's no shell, file system or opener plugin.
- Each window has its own capability file in `src-tauri/capabilities/`. See the permission table in [architecture.md](architecture.md#permissions).
- Custom commands are listed explicitly in `build.rs`; a command that isn't listed can't be called.

## Network access

All HTTP goes through `apps/desktop/src-tauri/src/net.rs`:

- The caller passes the list of allowed hosts; the URL's host must match exactly.
- Only HTTPS is used for remote hosts (`webcal://` links are upgraded to `https://`).
- Response bodies are capped at 5 MB, with timeouts.
- Each request is written to the `network_log` table with the widget, host, time and result.

Hosts contacted today:

| Feature | Hosts | When |
| --- | --- | --- |
| Weather | `api.open-meteo.com` | Every 30 minutes while a city is set |
| City search | `geocoding-api.open-meteo.com` | Only while you type in the city search |
| Calendars | The host of each feed you add | Every 15 minutes, or when you press refresh |

The installed app makes no other network requests. Installing, uninstalling and the first-run setup work offline (on Windows 10, the installer may download the WebView2 runtime from Microsoft if it's missing).

## Data at rest

| Data | Location | Notes |
| --- | --- | --- |
| Settings | `%APPDATA%\com.opendock.app\settings.json` | No secrets |
| Todos, notes, focus history, rules, activity, calendar events, forecast cache, network log | `%APPDATA%\com.opendock.app\opendock.db` | SQLite, readable by your user account only (standard profile permissions) |
| Calendar feed links | Windows Credential Manager | Service `OpenDock` |

OpenDock doesn't encrypt the database itself; it relies on Windows profile permissions, like most desktop apps. Window titles are kept in memory and not saved, unless a user-written rule puts one in its message; rule messages are stored in the activity log, which the user can clear.

## Supply chain

- Dependencies are pinned through `pnpm-lock.yaml` and `Cargo.lock`, and CI installs with `--frozen-lockfile` and `--locked`.
- GitHub Actions are pinned to full commit SHAs.
- Dependabot proposes weekly updates; the dependency review workflow blocks pull requests that add known-vulnerable or incompatibly licensed packages.
- CodeQL scans the TypeScript, Rust and workflow code on every pull request and weekly.
- Release artifacts are published with SHA-256 checksums. See [releasing.md](releasing.md).

## Known limitations

- Pre-1.0 installers aren't code-signed, so SmartScreen warns on first run.
- Widgets are built in and run in the same webview as the dock. Sandboxed third-party widgets with a permission broker are planned with the widget SDK.
