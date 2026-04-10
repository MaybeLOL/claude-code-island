<p align="center">
  <img src="assets/island-compact.svg" alt="Claude Code Island" width="320"/>
</p>

<h1 align="center">Claude Code Island</h1>

<p align="center">
  A Dynamic Island-style floating widget for Windows that monitors your Claude Code sessions in real-time.
  <br/>Answer questions, track tools, watch activity — all without leaving your flow.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11-blue?style=flat-square" alt="Platform"/>
  <img src="https://img.shields.io/badge/electron-33+-purple?style=flat-square" alt="Electron"/>
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License"/>
</p>

---

## What It Does

A tiny frosted-glass pill floats at the top of your screen. It watches your Claude Code sessions and shows you what's happening in real time:

- See which tool Claude is using and on which file
- Answer `AskUserQuestion` prompts directly from the widget
- Track active tasks, session duration, CPU usage
- Get toast notifications when tasks complete
- Multi-session support with one-click terminal jump

<p align="center">
  <img src="assets/island-expanded.svg" alt="Expanded view" width="400"/>
</p>

## Quick Start

Three commands. That's it.

```bash
git clone https://github.com/MaybeLOL/claude-code-island.git
cd claude-code-island
npm install && npm run setup && npm start
```

`npm run setup` installs the required hooks into `~/.claude/` and configures `settings.json` automatically.

### Requirements

- Windows 10/11
- Node.js 18+
- Claude Code CLI installed

## Features

### Glassmorphism UI
Neutral frosted glass with 60px backdrop blur, soft shadows, and a clean line-art ghost mascot that changes expression based on Claude's state — idle, working, success, error.

### Smart Compact Pill
The pill shows what matters most, in priority order:
1. Pending questions ("? Which approach do you...")
2. Active tool with detail ("Reading src/main.js")
3. Current task ("Working: Fix auth bug")
4. Session count ("2 sessions active")
5. Idle state

### Rich Tool Activity
Every tool call shows real context — file paths for Read/Write/Edit, command snippets for Bash, search patterns for Grep/Glob, query text for WebSearch. No more generic "Reading..." labels.

### Question Answering
Answer Claude's questions directly from the Island widget:
- Single-select with numbered options
- Multi-select with checkboxes
- Free-text input via "Other..." option
- Multi-question sequencing with progress indicator
- 120-second timeout bar with color warnings
- Answer confirmation feedback

### Answer Mode Switcher
Choose how questions are handled in Settings:
- **Island Mode** — Questions appear in the Island. You answer there. Terminal is paused.
- **Terminal Mode** — Questions appear in the terminal as normal. Island shows a notification.

### Dashboard
- CPU and memory meters
- Session uptime (replaces RAM in compact view when active)
- Active session list with project names and current task
- Task tracker with status dots
- Session duration, prompt count, tool count stats

### Activity Feed
Chronological log of every tool call with color-coded dots — blue for reads, green for writes, orange for bash, purple for agents.

### Settings
- Opacity slider (30-100%)
- Polling speed (Fast/Normal)
- Notification mode (In-app / Native / Both)
- Theme toggle (Dark / Light)
- Answer mode (Island / Terminal)
- Position reset

### Other
- Drag anywhere on screen, position persists across restarts
- System tray with show/hide and auto-start option
- Notification history with bell icon
- Toast stacking (up to 3)
- Keyboard shortcut: Escape to collapse

## How It Works

The Island monitors `~/.claude/` for session files, task data, and history.

A `PreToolUse` hook (`island-status.js`) reports tool activity with enriched detail (file paths, commands, patterns) to the widget via a status file. The widget watches this file for real-time updates.

For questions, a separate hook (`island-ask.js`) connects to a TCP server inside the Island (port 47523). In Island mode, the hook blocks while the widget shows the question. When you click an option, the answer is sent back over TCP. In Terminal mode, the hook sends a notification and exits immediately.

Session detection uses per-PID `process.kill(pid, 0)` checks instead of `tasklist` polling — instant and lightweight. Stale session files are cleaned up automatically.

## Build

```bash
npm run build
```

Produces a portable `dist/ClaudeCodeIsland.exe` — no installer needed.

## Project Structure

```
main.js          Electron main process (TCP server, file watchers, system info)
index.html       UI (glassmorphism, line-art ghost, question panel, settings)
preload.js       IPC bridge
hooks/
  island-status.js   PreToolUse hook — reports tool activity with detail
  island-ask.js      PreToolUse hook — TCP client for AskUserQuestion
setup.js         Installs hooks and configures settings.json
```

## Changelog

### v2.0.0 — Glassmorphism + Core Overhaul

**Visual**
- Complete UI overhaul to macOS glassmorphism aesthetic
- Neutral frosted glass surfaces replacing purple-tinted backgrounds
- New line-art ghost mascot with expressive state animations
- Smaller footprint (240x42 compact, 320x380 expanded)
- Lighter typography, refined spacing, pill-shaped tab indicator
- Snappier animations (300ms spring transitions)
- Consolidated light/dark theme support

**Core**
- Enriched tool activity — file paths, commands, patterns instead of generic labels
- Per-PID session detection replacing `tasklist` polling (instant, no CPU overhead)
- Automatic stale session cleanup
- Multi-question sequencing with progress indicator
- Free-text input for questions via "Other..." option
- 120-second timeout bar with amber/red color warnings
- Priority-based compact pill text (questions > tools > tasks > sessions)
- Session uptime display in compact meta
- Active task shown in session rows
- Answer mode switcher (Island / Terminal)
- Debounced session file watching
- Duplicate notification deduplication

**Fixes**
- ECONNRESET crash in terminal answer mode
- Ghost wrap drop-shadow filters removed for cleaner rendering
- Dead CSS cleanup throughout

### v1.0.0 — Initial Release

- Floating pill widget with pixel-art ghost mascot
- Real-time session monitoring
- AskUserQuestion answering via TCP
- System info (CPU/RAM), task tracking
- Tab system (Dashboard, Activity, Settings)
- Toast notifications, notification history
- Drag positioning, opacity control
- Light/dark theme, auto-start option

## License

MIT
