# Core Function Overhaul

**Date:** 2026-04-09
**Approach:** Enhanced Hooks + Richer Protocol — upgrade existing hook-based architecture with richer data, better session detection, multi-question support, and free-text input.

## Summary

Overhaul all four core functions of Claude Code Island: session monitoring, tool activity tracking, question answering, and compact status display. No new dependencies, no architecture changes — the hook + file-watch + TCP model stays, but every layer gets smarter.

## Files Modified

- `hooks/island-status.js` — enriched tool detail extraction
- `hooks/island-ask.js` — multi-question and free-text response support
- `main.js` — session detection, PID checking, status parsing, question handling
- `index.html` — question panel UI, activity feed, compact pill priority, free-text input

## Files NOT Modified

- `preload.js` — no new IPC channels needed (all improvements use existing channels)
- `setup.js` — untouched

---

## 1. Session Monitoring

### Current problems
- `tasklist /FO CSV /NH` polls the entire process list every 1.5-3s — slow and CPU-heavy
- Sessions appear/disappear with noticeable lag
- Phantom sessions persist when PIDs die between polls

### Changes

**Replace `tasklist` with per-PID `process.kill(pid, 0)`:**
- `checkAliveSessions()` currently shells out to `tasklist` and parses CSV output
- Replace with synchronous `process.kill(pid, 0)` wrapped in try/catch per session PID
- Returns instantly, no child process spawn, no CSV parsing
- Catch `ESRCH` (process not found) to mark session as dead

**Enhance `watchSessions()`:**
- Currently just calls `sendClaudeStatus()` on any change
- Add debouncing (200ms) to batch rapid file changes
- On file removal, immediately mark that session as ended (don't wait for next poll)

**Session cleanup:**
- When a session PID is confirmed dead, delete the session file from `~/.claude/sessions/`
- This prevents phantom sessions on next app launch
- Only delete if the file's PID matches the dead PID (safety check)

**Richer session display:**
- Read `cwd` from session file (already done) and show project name more prominently
- If a session has an active in_progress task, show the task subject in the session row

**Reduce poll interval:**
- Default poll interval for session checks: 1000ms (was 1500ms)
- PID check is now cheap enough to justify faster polling
- System info stays at 2000ms

## 2. Tool Activity Tracking

### Current problems
- `island-status.js` only sends tool name and a generic label ("Reading...", "Writing...")
- The hook receives full `tool_input` but discards it
- Activity feed and compact pill show no useful detail

### Changes

**Enrich `island-status.js` hook:**

Extract meaningful detail from `tool_input` per tool type:

| Tool | Detail extracted | Example |
|------|-----------------|---------|
| `Read` | `tool_input.file_path` last 2 path segments | `src/main.js` |
| `Write` | `tool_input.file_path` last 2 path segments | `hooks/island-ask.js` |
| `Edit` | `tool_input.file_path` last 2 path segments | `index.html` |
| `Bash` | `tool_input.command` first 40 chars | `git add -A && git commit...` |
| `Grep` | `tool_input.pattern` | `renderGhost` |
| `Glob` | `tool_input.pattern` | `**/*.js` |
| `Agent` | `tool_input.prompt` first 30 chars | `Subagent: Review the auth...` |
| `WebSearch` | `tool_input.query` first 40 chars | `electron file watcher API` |
| `WebFetch` | URL domain from `tool_input.url` | `docs.anthropic.com` |
| `AskUserQuestion` | First question text, truncated 40 chars | `Which approach do you...` |
| `TaskCreate` | `tool_input.subject` | `Fix auth bug` |
| `TaskUpdate` | `tool_input.subject` or task ID | `Task #3 completed` |

**Updated status file format:**

```json
{
  "tool": "Read",
  "label": "Reading src/main.js",
  "detail": "src/main.js",
  "timestamp": 1712649600000,
  "needsInput": false
}
```

New field: `detail` — the raw extracted detail string. `label` is now constructed as `"{verb} {detail}"` instead of just `"{verb}..."`.

**UI changes:**
- Compact pill shows the enriched label (e.g. "Reading src/main.js" instead of "Reading...")
- Activity feed entries show tool + detail
- Activity feed entry label uses `detail` if available, falls back to `label`

## 3. Question Answering

### Current problems
- Only shows the first question when Claude sends multiple
- No free-text/custom input support
- Minimal feedback after answering
- No timeout awareness

### Changes

**Multi-question sequencing:**
- `showQuestion()` receives `allQuestions` array (already sent from main process)
- Track `currentQuestionIndex` starting at 0
- After answering a question, increment index and show the next question
- Show progress indicator: "Question 1 of 3" above the question text
- Collect all answers in an `answers` object keyed by question index
- Only send the TCP response after the last question is answered

**Free-text input:**
- Add an "Other..." option at the bottom of every single-select question
- When clicked, hide the options and show a text input field + "Send" button
- On submit, store the answer as `customText[questionIndex]` in the response
- The hook already handles `customText` in the response payload — no hook changes needed for this
- For multi-select questions, no free-text option (doesn't make sense)

**Answer confirmation:**
- After sending the TCP response, show "Answer sent ✓" in the question panel for 1.5s
- If `socket.write()` throws or socket is destroyed, show "Failed — fell back to terminal" in the panel for 2s, styled with error state color
- Then hide the question panel

**Timeout indicator:**
- The hook has a 120s timeout
- Show a thin progress bar at the bottom of the question panel
- Bar fills from left to right over 120s using CSS animation
- At 100s (83%), bar color changes from `var(--body)` to amber `#e0a878`
- At 110s (92%), bar color changes to error `#d08080`
- If timeout expires, the hook exits and the question disappears — show "Timed out" briefly

**Compact pill question state:**
- When a question is pending, override the compact pill text with "? " + truncated question text
- Add a subtle pulse animation to the compact label when a question is pending
- This ensures the user notices the question even without expanding

### IPC changes

New IPC channel needed in `preload.js`:
- None — the existing `onShowQuestion` channel already passes `allQuestions`. The multi-question logic is purely renderer-side.

## 4. Compact Status & System Info

### Current problems
- Compact pill shows generic tool labels with no priority system
- No way to tell at a glance if a question is pending vs. Claude is just working
- System info is basic CPU/RAM with no session awareness

### Changes

**Compact pill text priority system:**

The pill label follows this priority (highest first):

1. **Pending question** → "? " + truncated question text, with pulse animation on the label
2. **Active tool** → enriched label from status hook ("Reading src/main.js")
3. **Active task started** → "Working: " + task subject (from `task-started` event)
4. **Idle with sessions** → "{n} session{s} active"
5. **No sessions** → "Idling..."

Each level overrides the one below. Tool status resets to idle after 5s of inactivity (existing behavior). Question state persists until answered or timed out.

**Implementation:** Add a `pillPriority` variable that tracks the current priority level. Each event handler checks if its priority is >= current before updating the label. Question state (priority 1) can only be cleared by answering, timeout, or a new non-question tool firing.

**Session uptime in compact meta:**
- When at least one session is active, replace the RAM display in compact meta with session uptime (e.g. "12m")
- Format: `<1m` → "0m", 1-59m → "Nm", 1-23h → "Nh Nm", 24h+ → "Nd"
- When no sessions are active, show CPU and RAM as before

**Session-aware CPU (expanded dashboard only):**
- In the expanded dashboard meters, add a third meter: "Claude" showing estimated CPU usage of Claude Code processes
- Read CPU times for each alive session PID using `process.cpuUsage()` — but this only works for the current process. Instead, on Windows, use `wmic process where ProcessId={pid} get KernelModeTime,UserModeTime` to get per-process CPU time, then compute delta-based usage.
- Actually, this adds significant complexity for marginal value. **Descoped** — keep the two existing meters (CPU, RAM). The per-PID check is already a win for session detection; adding per-PID CPU monitoring is a separate concern.

## 5. Preload.js Changes

No new IPC channels needed. All improvements work within existing channels:
- `show-question` already passes `allQuestions`
- `tool-status` already passes the full status object (just adding `detail` field)
- `claude-status` already passes sessions, tasks, stats

## 6. Hook Changes Summary

### `island-status.js`
- Parse `tool_input` to extract detail per tool type
- Construct enriched `label` as `"{verb} {detail}"`
- Add `detail` field to status JSON
- Keep 5s timeout, keep existing error handling

### `island-ask.js`
- No changes needed — multi-question and free-text handling is all renderer-side
- The hook already forwards the full `questions` array and handles `customText` in responses

## 7. Out of Scope

- Per-process CPU monitoring (descoped — too complex for marginal value)
- Persistent notification of missed questions (if Island wasn't running)
- Session history / past session browsing
- Hook auto-update mechanism
- Any changes to `setup.js`
