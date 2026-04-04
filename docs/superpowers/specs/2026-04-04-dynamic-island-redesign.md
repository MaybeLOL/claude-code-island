# Claude Code Dynamic Island — Redesign Spec

**Date**: 2026-04-04
**Project**: `C:\Users\cydao\Desktop\claude-code-island`
**Stack**: Electron 33 (single-file HTML renderer + Node main process)

---

## 1. Overview

Redesign the Claude Code Dynamic Island Electron app with two changes:

1. **Pixel ghost mascot** — replaces the current SVG blob character. A cute pixel-art ghost that changes color and expression based on Claude Code's real-time state.
2. **iOS dark glassmorphism UI** — replaces the current flat-dark UI with frosted glass surfaces, smooth animations, and Apple-inspired minimal typography.

The app remains a frameless, always-on-top, transparent Electron window that floats at the top of the screen. It reads real Claude Code data from `~/.claude/` (sessions, tasks, history).

---

## 2. Pixel Ghost Mascot

### 2.1 Character Design

- **Shape**: Classic ghost silhouette — rounded head, body tapering into 2–3 wavy tail tendrils
- **Grid**: 32×32 pixel grid, rendered as SVG `<rect>` elements with `image-rendering: pixelated`
- **Face**: Two eyes + mouth. Eyes and mouth change per state (see §2.2)
- **No limbs**: Ghost has no arms or legs — expression and color carry all emotion

### 2.2 State-Based Appearance

| State | Trigger | Colors (highlight → body → shadow) | Eyes | Mouth | Particles |
|-------|---------|-------------------------------------|------|-------|-----------|
| **Idle** | No active Claude Code sessions | `#d0c8f0` → `#b8aedd` → `#6858a0` (Lavender Dream) | Closed horizontal lines (sleeping) | Flat line or tiny smile | Zzz floating up-right |
| **Working** | ≥1 active session with alive PID | `#f4c0b0` → `#e8a090` → `#d89080` (Peach Rose) | Open 3×3 squares with white highlight pixel | Determined smile (V-shape) | Sparkle dots flicker |
| **Success** | Task status changes to `completed` | `#a0f0b8` → `#70e090` → `#50c070` (Mint Fresh) | Happy squint `^ ^` (inverted-V per eye) | Wide smile (U-shape) | Stars float upward |
| **Error** | Error detected in session or task | `#f0a8a8` → `#e08080` → `#c06060` (Soft Rose) | Large hollow circles (O_O) with small pupil | Wavy zigzag mouth | Sweat drop on right side |

### 2.3 Animations

All animations via SVG `<animate>` or CSS keyframes:

- **Idle**: Slow vertical bob (2px, 3s cycle). Zzz particles fade in/out and drift upward.
- **Working**: Faster bob (1.5s cycle). Sparkle particles appear/disappear rapidly around the ghost.
- **Success**: Quick bounce up then settle. Stars eject outward then fade. Lasts 4 seconds, then transition back to Working or Idle.
- **Error**: Horizontal shake (±1px, 0.3s). Sweat drop slides down. Lasts until error state clears.

### 2.4 Transition

When state changes, the ghost smoothly transitions color over 0.6s using CSS `transition` on the SVG fill properties (applied via class toggling on a container element). The face swaps instantly (no crossfade needed — pixel art reads better with instant swap).

---

## 3. UI Design

### 3.1 Design Language

- **Glassmorphism**: `background: rgba(22,22,30,0.88)` + `backdrop-filter: blur(40px)` + `border: 1px solid rgba(255,255,255,0.06)`
- **Corners**: `border-radius: 24px` (compact pill), `28px` (expanded panel)
- **Shadows**: `box-shadow: 0 8px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)`
- **Typography**: `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif`
- **Mono font** (terminal): `'SF Mono', 'Cascadia Code', 'Fira Code', monospace`
- **Color accent**: Adapts to current ghost state color (the body mid-tone). All UI accent colors (status dot, meter bars, terminal text, session dots) match the ghost.

### 3.2 Layout States

Two states only (simplified from previous three):

#### Compact (pill)
- **Size**: 280×48px
- **Layout**: `[Ghost 34px] [StatusDot 6px] [Label flex-1] [CPU% MemG]`
- **Background tint**: Shifts subtly to match ghost state (e.g., slight lavender tint when idle, slight peach when working)
- **Click** → expands to Expanded

#### Expanded (panel)
- **Size**: 360×auto (max ~420px height)
- **Layout** (top to bottom):
  1. **Header row**: Ghost 48px + "Claude Code" title + status subtitle + close button (X circle)
  2. **Activity section**: Label "ACTIVITY" + terminal box (monospace, 3 lines, shows recent history entries)
  3. **Meters section**: CPU + Memory side-by-side progress bars
  4. **Sessions section**: Label "SESSIONS" + list of active sessions (dot + project name + duration)
  5. **Tasks section**: Label "TASKS" + list of tasks (colored dot by status + task name)
- **Click close button or press Escape** → collapses to Compact

#### Removed from previous design
- **Full state**: Removed. The expanded state now shows everything.
- **Tools row**: Removed (was decorative).
- **Action buttons** (/commit, /review, etc.): Removed (cannot actually trigger commands from the widget).

### 3.3 Notification Toast

- Appears above the island when: task completes, session starts/ends, errors detected
- **Style**: Same glassmorphism pill, slides down from top with spring animation
- Contains: Mini ghost (24px) + message text
- Auto-dismisses after 4 seconds
- Also triggers a native Windows `Notification`

### 3.4 Micro-Animations

- **Expand/collapse**: `transition: all 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)` (spring)
- **Meter bars**: `transition: width 0.8s cubic-bezier(0.25, 0.1, 0.25, 1)`
- **Status dot**: Pulse animation `opacity 0.3→1→0.3` over 2s when active
- **Background tint shift**: `transition: background 0.6s ease` when ghost state changes

---

## 4. Main Process (main.js)

### 4.1 Kept As-Is

These parts of the current `main.js` work correctly and need no changes:

- Window creation (frameless, transparent, always-on-top, skip-taskbar)
- IPC handlers: `resize-island`, `drag-start`, `drag-move`, `drag-end`, `close-app`, `toggle-click-through`
- System info polling (`os.cpus()`, `os.totalmem()`, delta-based CPU%)
- Claude status polling: `readSessions()`, `checkAliveSessions()`, `readTasks()`, `readRecentHistory()`
- History file watcher (`fs.watch` on `history.jsonl`)
- Tray icon + context menu (show/hide/quit/autostart)
- Toast/notification system

### 4.2 Changes

- **Window sizes**: Update constants to match new two-state layout:
  - `COMPACT_WIDTH: 280, COMPACT_HEIGHT: 48`
  - `EXPANDED_WIDTH: 360, EXPANDED_HEIGHT: 420`
  - Remove `FULL_*` constants
- **Resize IPC handler**: Remove `full` state, keep only `compact` and `expanded`
- **State detection logic**: Add IPC channel `ghost-state` that sends one of `idle | working | success | error` to the renderer, computed from:
  - `idle`: no alive sessions
  - `working`: ≥1 alive session
  - `success`: a task just changed to `completed` (stays for 4s, then reverts)
  - `error`: a task has `error` status or session exited with error (stays until cleared)

### 4.3 Preload

No changes needed. The current `preload.js` IPC bridge covers all needed channels.

Add one new channel:
- `onGhostState: (cb) => ipcRenderer.on('ghost-state', (_, state) => cb(state))`

---

## 5. Renderer (index.html)

Complete rewrite. Single HTML file containing:

### 5.1 CSS
- CSS custom properties for each ghost state's color palette
- Glassmorphism base styles
- Compact and expanded layout styles
- Animation keyframes (bob, shake, pulse, spring transitions)
- Scrollbar styling (thin, dark)

### 5.2 SVG Ghost Component
- Four ghost SVGs defined in a hidden `<defs>` block (one per state)
- JavaScript swaps which ghost is visible based on `ghost-state` IPC
- Color transition via CSS `transition` on a wrapping `<g>` with `fill` override

### 5.3 JavaScript
- State machine: `compact ↔ expanded` (click to expand, X/Escape to collapse)
- Ghost state manager: listens to `ghost-state` IPC, swaps SVG + updates CSS variables
- System info updater: updates meters, compact metrics
- Claude status updater: updates sessions list, tasks list, terminal lines
- History updater: typewriter effect for new prompts
- Notification handler: slide-in toast
- Drag handler (kept from current)

---

## 6. File Structure

```
claude-code-island/
├── main.js          # Electron main process (minor edits)
├── preload.js       # IPC bridge (add onGhostState)
├── index.html       # Full rewrite — renderer
├── package.json     # No changes
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-04-04-dynamic-island-redesign.md  # This file
```

No new files. No new dependencies. Everything stays in the single `index.html`.

---

## 7. Testing

- `npm start` (or `npx electron .`) launches the app
- **Compact state**: Verify ghost appears at screen top center, shows lavender idle ghost when no Claude sessions
- **Working state**: Start a Claude Code session in a terminal — ghost should turn peach rose, eyes open
- **Expand/collapse**: Click pill → panel slides open. Click X or Escape → collapses.
- **Success**: Complete a task in Claude Code — ghost flashes mint green for 4s
- **Error**: Kill a session abruptly — ghost turns soft rose briefly
- **Drag**: Mouse drag moves the pill anywhere on screen
- **Tray**: Right-click tray icon for show/hide/quit
- **Notification**: Task completion triggers both in-app toast and Windows notification
