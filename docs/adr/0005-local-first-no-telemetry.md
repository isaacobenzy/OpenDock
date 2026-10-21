# 0005. Local-first, no telemetry

- **Status:** Accepted
- **Date:** 2026-10-21

## Context

A dock sees a lot: window titles, running apps, calendar events, what you're listening to. Many similar tools sync to an account or collect usage analytics. Telemetry would help us prioritise, but it would put user trust at risk and require a backend to run, secure and pay for.

## Decision

OpenDock will work fully offline, with no account and no backend. It will not collect telemetry, analytics or remote crash reports, and won't fetch remote configuration. All network access goes through one module (`net.rs`) that only contacts hosts a feature declares, and every request is shown to the user in the Privacy Ledger. Secrets go in the operating system keychain.

## Consequences

- Users can verify our privacy claims themselves, in the app and in the code.
- We learn about usage only through issues, discussions and voluntary feedback, so we must make reporting bugs easy.
- Features that would need a server, such as sync between PCs, have to be designed peer-to-peer or through files the user controls, and would need their own ADR.
