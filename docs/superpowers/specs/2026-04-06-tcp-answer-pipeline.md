# AskUserQuestion TCP Socket Answer Pipeline

## Problem

Claude Code Island shows `AskUserQuestion` prompts in its floating UI, but clicking an option doesn't deliver the answer back to Claude. The user has to answer again in the terminal.

Root cause: Claude Code's hook system has no mechanism to inject tool results for `AskUserQuestion`. `PreToolUse` hooks can only allow (exit 0) or block (exit 2) — they cannot provide an answer. Exit code 2 with stderr feedback is the closest option: Claude receives the feedback text but treats it as a blocked tool.

## Solution

TCP socket-based blocking hook, modeled after the macOS `claude-island` project's Unix socket approach for `PermissionRequest`.

## Architecture

```
Claude Code Session                     Island (Electron)
  |                                         |
  |-- PreToolUse: AskUserQuestion           |
  |   island-ask.js connects TCP:47523      |
  |   sends {session_id, questions}         |
  |   blocks on socket.read()              |-- TCP server accepts
  |                                         |-- Stores socket by session_id
  |                                         |-- Sends question to renderer
  |                                         |-- UI shows question panel
  |                                         |
  |                                         |<-- User clicks option
  |<-- answer JSON on same socket ----------|
  |   hook exits(2), stderr = answer text   |
  |                                         |
  Claude receives feedback, acts on it      |
```

## Components

### 1. TCP Server (main.js)

- `net.createServer()` on `localhost:47523`
- On connection: read JSON line, parse `session_id` and `questions`
- Store socket in `pendingQuestions` map keyed by `session_id`
- Forward question to renderer via IPC `show-question`
- When renderer sends `answer-question` IPC with `session_id` + `index`:
  - Look up socket in `pendingQuestions`
  - Write answer JSON back on socket
  - Close socket, remove from map
- Cleanup: on socket close/error, remove from `pendingQuestions`

### 2. Hook Script (island-ask.js)

- Reads stdin JSON from Claude Code (PreToolUse event)
- If not `AskUserQuestion` or no questions: exit 0
- Connects to `localhost:47523` via TCP
- Sends single JSON line: `{session_id, questions, timestamp}`
- Sets 120s read timeout
- Blocks on `socket.read()`
- On data: parse answer, build feedback message, write to stderr, exit 2
- On timeout/error/connection refused: exit 0 (fall back to terminal)

### 3. Island UI (index.html)

- `showQuestion()` now receives `session_id` along with question data
- `_pickOption()` sends `{session_id, index}` via IPC `answer-question`
- `_submitMulti()` sends `{session_id, answers}` for multiSelect
- Visual feedback unchanged (highlight, dim others, "Answer sent!" text)

### 4. Preload (preload.js)

- `answerQuestion` already passes arbitrary data — no change needed

### 5. Status Hook (island-status.js)

- Unchanged. Fast 5s timeout, writes status for all tools.
- Still writes `needsInput` and `questions` to `island-status.json`
- The `island-ask.js` hook handles the actual answer flow via TCP

## Multi-Session Support

Each `PreToolUse` hook invocation runs in its own process with its own TCP connection. The `session_id` from the hook's stdin JSON uniquely identifies which session is asking. The Island's `pendingQuestions` map holds one socket per session. If two sessions ask simultaneously, both questions appear in the UI (queued), and each answer goes back to the correct socket.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Island not running | TCP connection refused → hook exits 0 → terminal fallback |
| User doesn't answer in 120s | Socket timeout → hook exits 0 → terminal fallback |
| Island crashes mid-question | Socket EOF → hook exits 0 → terminal fallback |
| Hook process killed | Socket closes → Island removes from pendingQuestions |
| Multiple sessions asking | Each gets own socket, UI queues questions |

## Settings (settings.json)

```json
{
  "PreToolUse": [
    {
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node \"C:\\Users\\cydao\\.claude\\hooks\\island-status.js\"",
        "timeout": 5
      }]
    },
    {
      "matcher": "AskUserQuestion",
      "hooks": [{
        "type": "command",
        "command": "node \"C:\\Users\\cydao\\.claude\\hooks\\island-ask.js\"",
        "timeout": 130
      }]
    }
  ]
}
```

## Files Modified

- `~/.claude/hooks/island-ask.js` — rewrite: TCP client instead of file polling
- `C:\Users\cydao\Desktop\claude-code-island\main.js` — add TCP server, update answer-question handler
- `C:\Users\cydao\Desktop\claude-code-island\index.html` — pass session_id through answer flow
- `~/.claude/settings.json` — update timeout to 130s

## Files Unchanged

- `~/.claude/hooks/island-status.js`
- `preload.js`
- All UI styling, ghost animations, system info, task tracking

## Known Limitation

Exit code 2 shows as "hook error" in the terminal. This is cosmetic — the answer content reaches Claude via stderr and Claude acts on it. There is no way to avoid this without changes to Claude Code's hook system (tracked in GitHub issue #34660).
