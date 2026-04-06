# Claude Code Island — UI Refinement & Features Design

## Overview

Incremental enhancement of the existing Claude Code Island widget. Refine the current glassmorphism aesthetic, add a 3-tab expanded view (Dashboard / Activity / Settings), improve the notification system, and add session stats. All changes stay within the existing single-file `index.html` + `main.js` architecture.

## Architecture

No structural changes. The project remains:
- `main.js` — Electron main process (add activity log accumulation, settings persistence, stats tracking)
- `index.html` — Single-file renderer (add tab system, activity feed, settings panel, visual polish)
- `preload.js` — IPC bridge (add new channels)
- Hooks unchanged

## 1. Tab System

### Layout
The expanded view (360x420) keeps its fixed size. The top header (ghost + title + close button) stays. Below it, a tab bar with 3 tabs:

| Tab | Content |
|-----|---------|
| Dashboard | Sessions list, tasks, CPU/RAM meters, stats row (session duration, prompt count, tool breakdown) |
| Activity | Full-height scrollable feed of tool calls, prompts, events with timestamps |
| Settings | Opacity slider, position reset, polling interval, notification prefs, theme toggle |

### Tab Bar
- Text-only labels: "Dashboard", "Activity", "Settings"
- Animated sliding underline indicator (var(--body) color, 2px height)
- Font: 11px, weight 600, uppercase, letter-spacing 0.5px
- Active tab: white text. Inactive: #666
- Transition: underline slides 200ms ease, content crossfades 200ms

### Dashboard Tab
- The current 3-line "terminal" box is removed (Activity tab replaces it)
- Stats row sits between meters and sessions: 3 inline key-value pairs
  - Session duration (e.g. "12m"), Prompts (e.g. "24"), Tools (e.g. "47")
  - Font: 10px label (#555), 13px value (#fff, weight 700)
- Sessions and tasks remain as-is but inherit visual polish

### Activity Tab
- Scrollable list, max 100 entries in memory (oldest dropped)
- Each entry: colored dot (by tool type), label text, relative timestamp
- Tool type colors: Read/Glob/Grep = blue, Write/Edit = green, Bash = orange, Agent = purple, other = gray
- Auto-scrolls to bottom on new entry
- Empty state: "No activity yet" centered, #555
- Replaces the current 3-line "terminal" box on Dashboard (removed)

### Settings Tab
- Opacity: slider 0.3–1.0, default 0.88, live preview via `setOpacity()`
- Position: "Reset to center" button
- Polling: toggle Fast (1.5s) / Normal (3s)
- Notifications: radio group — In-app only / Native only / Both (default)
- Theme: toggle Dark (default) / Light. Light theme swaps CSS variables only: `--bg-tint` to `rgba(240,238,250,0.92)`, text colors invert (labels become #333, values become #111), meter tracks become `rgba(0,0,0,0.08)`. Ghost colors and state colors stay the same.
- All settings persist to `~/.claude/island-settings.json`

## 2. Visual Polish

### Compact Pill
- Subtle outer glow matching ghost state color: `box-shadow: 0 0 20px rgba(stateColor, 0.15)`
- Backdrop blur increased from 40px to 50px
- Hover: `transform: scale(1.02)` with 200ms ease
- Border: `rgba(255,255,255,0.08)` (up from 0.06)

### Transitions
- Unified 0.4s ease for all state color changes (currently mixed 0.55s/0.6s)
- Tab content: crossfade via opacity 200ms
- Ghost state change: 150ms fade out, swap, 150ms fade in (keep current approach)

### Typography
- Compact label: 13.5px (from 13px)
- Body text: weight 500
- Headings: weight 700 (already there)
- Tighter letter-spacing on `.label`: 0.6px (from 0.8px)

### Ghost
- Drop shadow under ghost matching state color: `filter: drop-shadow(0 2px 4px rgba(stateColor, 0.3))`
- Keep pixel art style and all current animations unchanged

### Question Panel
- Pulsing border animation when question is waiting: `@keyframes qpulse` alternating border opacity
- Option button border-radius: 14px (from 10px)

### Notification Toast
- Combined slide + fade: `top` transition + `opacity` 0→1
- Glow matches ghost state color
- Click-to-dismiss on the toast itself

## 3. Notification System

### Toast Stacking
- Max 3 visible toasts, stacked vertically with 8px gap
- New toasts push older ones down
- Each auto-hides after 4s independently
- Click any toast to dismiss immediately

### Notification History
- Bell icon in expanded header (between title and close button)
- Click opens a dropdown overlay (280px wide, max 300px tall, scrollable)
- Last 20 notifications stored in memory
- Each entry: type icon (dot/checkmark/question mark as text), message, relative timestamp
- "Clear all" button at bottom
- Grouped visually by type via left-border color

### Settings Integration
- Notification preference (in-app / native / both) respected by `showToast()` in main.js
- Native notifications can be toggled off without affecting in-app toasts

## 4. Main Process Changes (main.js)

### Activity Log
- Accumulate tool events from `watchStatus()` in an array (max 100)
- Each entry: `{ tool, label, timestamp, sessionId }`
- New IPC channel: `activity-log` — send full log on tab switch, incremental on new event
- New preload method: `onActivityLog(cb)`, `requestActivityLog()`

### Session Stats
- Track in memory per-session: prompt count, tool call counts by type, session start time
- Add `stats` field to existing `claude-status` payload:
  ```json
  { "duration": 720, "promptCount": 24, "toolCounts": { "Read": 12, "Bash": 8, ... } }
  ```
- Reset when session ends

### Settings Persistence
- File: `~/.claude/island-settings.json`
- Load on startup, apply values (opacity, position, polling interval, theme, notifications)
- New IPC: `save-settings(data)`, `load-settings` → returns settings object
- New preload methods: `saveSettings(data)`, `onSettingsLoaded(cb)`

### Opacity
- New IPC: `set-opacity(value)` → `mainWindow.setOpacity(value)`
- New preload method: `setOpacity(value)`

### Window Position
- Save bounds to settings on `drag-end`
- Restore saved position on startup (fall back to center-top if no saved position)

### Polling Interval
- Make `setInterval` for `sendClaudeStatus()` configurable
- On settings change, clear and recreate interval with new value

## 5. Preload.js Additions

New methods exposed via `contextBridge`:
- `onActivityLog(cb)` — receive activity log updates
- `requestActivityLog()` — request full activity log
- `saveSettings(data)` — persist settings
- `onSettingsLoaded(cb)` — receive settings on load
- `setOpacity(value)` — change window opacity
- `onNotificationHistory(cb)` — receive notification history
- `requestNotificationHistory()` — request notification list

## 6. Files Changed

| File | Changes |
|------|---------|
| `index.html` | Tab system, activity feed, settings panel, notification history dropdown, visual polish CSS, all new JS logic |
| `main.js` | Activity log accumulation, stats tracking, settings persistence, opacity control, position persistence, configurable polling |
| `preload.js` | New IPC bridge methods |
| `hooks/*` | No changes |
| `setup.js` | No changes |
| `package.json` | No changes |

## 7. What's NOT Changing

- TCP question server and AskUserQuestion flow
- Hook scripts (island-status.js, island-ask.js)
- Setup script
- Ghost pixel art design and animation keyframes
- Compact pill dimensions (280x48)
- Expanded dimensions (360x420)
- Electron version or dependencies
