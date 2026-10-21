# Manual Windows test matrix (Milestone 2)

Run on a physical Windows machine. Record OS build, display scale, and result.

| Scenario | Steps | Expected | Result |
| --- | --- | --- | --- |
| First launch | Start `pnpm dev` | Dock appears at bottom, clock updates | |
| Reorder widgets | Drag clock and add button | Order persists after restart | |
| Context menu | Right-click dock | Position/size/theme/quit actions work | |
| Fullscreen hide | Open fullscreen video or game | Dock hides, returns after exit | |
| Multi-monitor | Move dock to secondary monitor via settings monitor id | Layout follows work area | |
| DPI 150% | Change display scale | Dock size/position remain usable | |
| Second instance | Launch app twice | Existing window focuses | |
| Invalid settings | Corrupt `settings.json` | Backup created, defaults used | |
| Sleep/resume | Suspend PC, resume | Dock visible and responsive | |
| Taskbar overlap | Default taskbar + bottom dock | Dock sits above work area | |

Automated coverage complements this matrix but does not replace native shell behavior checks.
