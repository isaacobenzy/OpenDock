# Security overview (Milestone 2)

## Privacy defaults

- No mandatory account or OpenDock-hosted backend
- No telemetry SDK in the application
- Settings stored locally under the Tauri app config directory
- Strict CSP in `tauri.conf.json` (`default-src 'self'`)

## Tauri surface

- Custom commands are explicit Rust functions registered in `lib.rs`.
- Capabilities grant window, event, and autostart permissions only.
- The opener plugin is not bundled in Milestone 2.

## Credentials

- No provider API keys are embedded in the repository.
- Secure OS credential storage will back integrations in later milestones.

## Untrusted input

- Settings files and IPC payloads are validated in Rust and with Zod on the frontend.
- Invalid settings files are quarantined to `settings.invalid-<timestamp>.json` and replaced with defaults.

## Reporting

See [SECURITY.md](../SECURITY.md) for vulnerability reporting.
