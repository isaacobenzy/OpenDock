# Combined desktop feature release

Approved scope: 2026-10-22. This is the implementation and acceptance record for one combined release. Work is delivered in reviewable changes, but the release is held until the agreed requirements and platform gates pass. An unchecked item is not shipped functionality.

## Product scope

- [ ] Reliable Windows taskbar replacement: repeat launch, startup, Explorer restart, secondary monitors, rollback and recovery.
- [ ] Visual appearance editor: six styles, four edges, pill/full width, preview, grouping, spacing, icon sizing, undo/reset and accessible controls.
- [ ] Broader application discovery: desktop shortcuts, packaged apps, portable apps selected by the user, meeting and development applications, stable pinned/running identity.
- [ ] Independent monitor layouts, edge reservations, mixed DPI, unplug/reconnect and correctly anchored flyouts.
- [ ] Google Calendar and Outlook/Microsoft 365 account connections, read-only access, calendar selection, refresh/revocation, offline events and validated meeting join links. Retain iCal feeds.
- [ ] Optional custom desktop with custom icons and built-in widgets; retain a Windows-icons mode. Preserve files and restore original visibility on exit/failure. Include layout editing, snapping, locking and saved scenes.
- [ ] Windows signing, signed updates, winget manifest, accessibility audit and localisation framework.
- [ ] Widget SDK: versioned widget.json, shared Rust/Zod validation, isolated webviews, permission broker, permission revocation, resource limits, starter and complete widget states.
- [ ] Linux builds and distribution packages in the same release, with documented desktop/session support and installation tests.

## Implementation order and dependencies

1. Build and release infrastructure: native Windows and Linux jobs, explicit packages, artifact validation, checksums and test reporting.
2. Taskbar recovery: testable platform adapter, guard failures, transactional application and restoration, primary/secondary visibility, startup feedback and settings rollback.
3. App discovery and appearance: stable app identity, richer sources, visual presets/editor and accessible keyboard behaviour.
4. Monitor/window architecture and custom desktop: write an ADR before replacing the single-window/single-AppBar design; prototype desktop layering and recovery before adding canvas editing.
5. Calendar providers: extend the HTTP broker for authenticated requests with redirect validation and redacted ledger entries; system-browser OAuth with PKCE and keychain tokens; provider tests and real account validation.
6. SDK isolation: manifest and broker ADR, narrow window capabilities, reject direct network/native calls, resource and crash tests, then starter/documentation.
7. Distribution readiness: signing/update keys, updater broker integration, translations, accessibility audit, installed-build verification and release publication.

Each settings shape change increments SETTINGS_VERSION in both languages, migrates prior files and adds shared fixtures. Database migrations are append-only. OS-specific code stays under platform/. All application HTTP uses net.rs and the Privacy Ledger. No telemetry is introduced.

## Linux build and distro matrix

The user approved GitHub Actions Linux runners after inspection found no connected Cursor Linux sandbox and no installed WSL distribution. The local Cursor editor is not a Linux build environment.

| Target | Package | Build gate | Runtime gate |
| --- | --- | --- | --- |
| Windows x64 | NSIS EXE, MSI | Native Windows build, all checks | Windows 10/11 install, upgrade, uninstall and shell recovery |
| Ubuntu / Debian family x64 | DEB | Native Ubuntu build, package metadata validation | Install and launch on supported versions with WebKitGTK 4.1 |
| Fedora / compatible RPM family x64 | RPM | Native Linux build, RPM metadata/dependency validation | Install and launch on a documented compatible Fedora release |
| Other compatible Linux x64 desktops | AppImage | Native Linux build, extraction/package checks | Launch on documented glibc-compatible distributions |

Package format does not prove distro compatibility. Linux X11 and Wayland are separate runtime rows. GNOME, KDE Plasma and wlroots desktops must be evaluated separately; unsupported shell operations must be visible as unsupported, never silently reported as successful. A fallback-only build is not complete Linux shell integration. Flatpak/AUR and ARM64 require separate validated packaging and are not implied by x64 artifacts.

Required Linux functionality: app discovery/launching, supported window management, system stats, audio/media where available, keychain persistence and truthful capability-aware UI. Shell replacement and desktop layering depend on the desktop/compositor, with documented fallback behaviour.

## Test and release gates

- [x] Baseline before implementation: lint, typecheck, 170 TypeScript tests, formatting, 60 Rust tests, Clippy with warnings denied.
- [ ] Regression tests for every changed behaviour and shared migration fixtures.
- [ ] pnpm lint; pnpm typecheck; pnpm test; pnpm fmt:check; pnpm test:rust.
- [ ] cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml --all-targets -- -D warnings.
- [ ] Windows and Linux production builds from the exact candidate commit.
- [ ] Install, upgrade, uninstall, repeat launch, crash, Explorer restart, sleep/resume, offline, keyboard/screen-reader and mixed-DPI manual results recorded.
- [ ] DEB/RPM/AppImage runtime matrix recorded against downloaded release artifacts.
- [ ] OAuth sign-in, denied consent, expired token, recurrence/timezone, meeting-link validation and disconnect tested for both providers.
- [ ] Native and custom desktop modes recover without moving/deleting desktop files.
- [ ] SDK permission-bypass, navigation, malformed-manifest, resource-limit and widget-crash tests pass.
- [ ] Installer signatures, updater signatures, checksums and downloaded-artifact verification pass.
- [ ] Changelog, guides, architecture/ADRs, platform matrix and website download data reflect verified capabilities.

Build credentials must be supplied through existing CI secret stores. Public OAuth client IDs can be configured as public build inputs; private keys and tokens must never enter this document, source control or logs. Provider registration and signing-service configuration are prerequisites for the respective end-to-end release gates.

## Publication

Keep the current released version until the candidate is ready; choose the final version once scope and compatibility are verified. Follow feature branch -> develop -> staging -> main, then tag the tested commit. Create a draft release, build Windows/Linux artifacts, download and verify them, and publish only after the combined acceptance checklist passes. Submit winget metadata using the immutable published URLs and checksums. Do not label unverified Linux desktop behaviour or unfinished account/SDK features as complete.

## Evidence log

- 2026-10-22: repository indexed; baseline automated checks passed. Installed-build taskbar recovery has no recorded pass yet.
- 2026-10-22: user approved the entire feature plan and requested Linux packages in the same release; GitHub Actions Linux runners approved as the build environment.
