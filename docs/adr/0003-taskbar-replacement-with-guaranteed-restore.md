# 0003. Taskbar replacement with a guaranteed restore

- **Status:** Accepted
- **Date:** 2026-10-21

## Context

Users want OpenDock to replace the Windows taskbar, not sit next to it. Windows has no supported API for replacing the taskbar. What it does offer is:

- turning on taskbar auto-hide through the app bar API (`SHAppBarMessage`), which Windows remembers across sessions;
- hiding the taskbar windows (`Shell_TrayWnd` and the secondary taskbars), which lasts until Explorer restarts;
- registering an app bar, which reserves an edge of the screen so maximised windows don't cover it.

Any approach that changes the taskbar can leave a user without one if OpenDock exits badly. A desktop without a taskbar is a serious failure: many users won't know how to recover.

## Decision

Replace mode will combine all three: auto-hide on, taskbar windows hidden, and the dock registered as an app bar on its edge. Before changing anything, OpenDock saves the user's original auto-hide setting to a marker file, `taskbar-restore.json`. The restore is layered:

1. Quitting, or switching back to *Keep the taskbar*, restores immediately.
2. A panic hook restores before the process aborts.
3. A small guard process, which is the same executable started with `--taskbar-guard`, waits for the main process to exit and restores from the marker if it's still there.
4. Power actions from the launcher restore before signing out, restarting or shutting down.
5. On the next start, a leftover marker is restored before anything else runs.
6. The uninstaller runs the executable with `--restore-taskbar`.

The marker exists only while the taskbar is changed, so restoring is idempotent and safe to run from any process. A watcher re-applies the mode if Explorer restarts and brings the taskbar back.

## Consequences

- The taskbar comes back in every exit path we can detect. The remaining gap is a session end that kills both processes at once; auto-hide then stays on until OpenDock next starts, and the taskbar is still reachable at the screen edge.
- The guard process is visible in Task Manager. That's an acceptable cost for the guarantee.
- Changes to taskbar code require running the restore rows of the [manual matrix](../testing.md#manual-windows-matrix).
