# Core Function Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade all four core functions of Claude Code Island — faster session detection, richer tool activity, multi-question + free-text answering, and priority-based compact status.

**Architecture:** Enhanced hook protocol (richer data in `island-status.js`), synchronous PID checks replacing `tasklist`, multi-question sequencing and free-text input in the renderer, priority-based compact pill text. No new files, no new dependencies.

**Tech Stack:** Node.js (Electron main + renderer), vanilla JS, `fs.watch`, `net` (TCP), `process.kill` for PID checks

**Spec:** `docs/superpowers/specs/2026-04-09-core-function-overhaul-design.md`

---

### Task 1: Enrich island-status.js hook with tool detail

**Files:**
- Modify: `hooks/island-status.js`

- [ ] **Step 1: Replace the hook with enriched version**

Replace the entire contents of `hooks/island-status.js` with:

```js
const fs = require('fs');
const path = require('path');

const STATUS_FILE = path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'island-status.json');

function shortPath(p) {
  if (!p) return '';
  return p.replace(/\\/g, '/').split('/').slice(-2).join('/');
}

function extractDetail(tool, input) {
  if (!input) return '';
  switch (tool) {
    case 'Read': return shortPath(input.file_path);
    case 'Write': return shortPath(input.file_path);
    case 'Edit': return shortPath(input.file_path);
    case 'Bash': return (input.command || '').substring(0, 40);
    case 'Grep': return input.pattern || '';
    case 'Glob': return input.pattern || '';
    case 'Agent': return input.prompt ? 'Subagent: ' + input.prompt.substring(0, 30) : '';
    case 'WebSearch': return (input.query || '').substring(0, 40);
    case 'WebFetch': {
      try { return new URL(input.url).hostname; } catch (e) { return ''; }
    }
    case 'AskUserQuestion': {
      var qs = input.questions;
      if (qs && qs[0] && qs[0].question) return qs[0].question.substring(0, 40);
      return '';
    }
    case 'TaskCreate': return input.subject || '';
    case 'TaskUpdate': return input.subject || ('Task #' + (input.taskId || '?'));
    default: return '';
  }
}

const verbs = {
  'Read': 'Reading', 'Write': 'Writing', 'Edit': 'Editing',
  'Bash': 'Running', 'Glob': 'Searching', 'Grep': 'Searching',
  'WebFetch': 'Fetching', 'WebSearch': 'Searching', 'Agent': 'Thinking',
  'AskUserQuestion': 'Waiting for input', 'TaskCreate': 'New task',
  'TaskUpdate': 'Task updated',
};

let input = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const tool = data.tool_name || data.tool || 'unknown';
    const toolInput = data.tool_input || {};
    const detail = extractDetail(tool, toolInput);
    const verb = verbs[tool] || 'Working';
    const label = detail ? verb + ' ' + detail : verb + '...';

    const status = {
      tool: tool,
      label: label,
      detail: detail,
      timestamp: Date.now(),
      needsInput: (tool === 'AskUserQuestion'),
    };

    fs.writeFileSync(STATUS_FILE, JSON.stringify(status));
  } catch (e) {}
});
```

- [ ] **Step 2: Commit**

```bash
git add hooks/island-status.js
git commit -m "feat(core): enrich status hook with tool detail extraction"
```

---

### Task 2: Replace tasklist polling with per-PID checks and enhance session watching

**Files:**
- Modify: `main.js:42-46` (DEFAULT_SETTINGS), `main.js:287-375` (sendClaudeStatus), `main.js:400-415` (checkAliveSessions), `main.js:478-485` (watchSessions)

- [ ] **Step 1: Update default poll interval**

In `main.js`, change `DEFAULT_SETTINGS`:

```js
const DEFAULT_SETTINGS = {
  opacity: 0.88,
  position: null,
  pollingInterval: 1000,  // was 1500
  notifications: 'both',
  theme: 'dark'
};
```

- [ ] **Step 2: Replace checkAliveSessions with synchronous PID check**

Replace the `checkAliveSessions` function entirely:

```js
function checkAliveSessions(sessions, callback) {
  if (sessions.length === 0) return callback([]);
  const alive = sessions.filter(s => {
    try {
      process.kill(s.pid, 0);
      return true;
    } catch (e) {
      // PID not found — clean up stale session file
      try {
        const sessionFile = path.join(SESSIONS_DIR, s.sessionId + '.json');
        if (fs.existsSync(sessionFile)) {
          const raw = fs.readFileSync(sessionFile, 'utf-8');
          const data = JSON.parse(raw);
          if (data.pid === s.pid) {
            fs.unlinkSync(sessionFile);
          }
        }
      } catch (cleanupErr) {}
      return false;
    }
  });
  callback(alive);
}
```

- [ ] **Step 3: Enhance watchSessions with debouncing**

Replace the `watchSessions` function:

```js
function watchSessions() {
  let debounceTimer = null;
  try {
    fs.watch(SESSIONS_DIR, (eventType, filename) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        sendClaudeStatus();
      }, 200);
    });
  } catch (e) {}
}
```

- [ ] **Step 4: Commit**

```bash
git add main.js
git commit -m "feat(core): per-PID session checks, stale cleanup, debounced watching, faster polling"
```

---

### Task 3: Compact pill priority system and session uptime

**Files:**
- Modify: `index.html` — JS section (pill priority logic, compact meta uptime)

- [ ] **Step 1: Add pill priority system**

After the `var currentTab = 'dashboard';` line (around line 524), add the priority system:

```js
// Pill priority: 1=question, 2=tool, 3=task, 4=sessions, 5=idle
var pillPriority = 5;
var questionPending = false;

function setPillText(text, priority) {
  if (priority <= pillPriority || priority === pillPriority) {
    pillPriority = priority;
    compactText.textContent = text;
    compactText.classList.toggle('pill-pulse', priority === 1);
  }
}

function clearPillPriority(priority) {
  if (pillPriority === priority) {
    pillPriority = 5;
    compactText.classList.remove('pill-pulse');
    resetCompactLabel();
  }
}
```

- [ ] **Step 2: Update onToolStatus handler to use priority system**

Replace the `window.island.onToolStatus` handler:

```js
window.island.onToolStatus(function(s) {
  if (s.label) {
    if (!questionPending) {
      setPillText(s.label, 2);
    }
    if (s.needsInput) {
      questionPending = true;
      var qText = s.detail ? '? ' + s.detail : '? Needs input';
      setPillText(qText, 1);
    }
  }
  if (!s.needsInput && !answerPending) {
    hideQuestion();
  }
});
```

- [ ] **Step 3: Update onClaudeStatus handler for session-count idle text**

In the `window.island.onClaudeStatus` handler, update the idle text logic. Find the section that sets `expStatus.textContent` and after the session/task rendering, add:

```js
// Update compact pill idle text based on session count
if (running && pillPriority >= 4) {
  var n = d.sessions ? d.sessions.length : 0;
  setPillText(n + ' session' + (n > 1 ? 's' : '') + ' active', 4);
}
if (!running && pillPriority >= 5) {
  setPillText('Idling...', 5);
}
```

- [ ] **Step 4: Update onTaskStarted handler to use priority**

Replace the `window.island.onTaskStarted` handler:

```js
window.island.onTaskStarted(function(msg) {
  notify('Working: ' + msg);
  if (!questionPending) {
    setPillText('Working: ' + msg, 3);
  }
  clearTimeout(compactResetTimer);
  compactResetTimer = setTimeout(function() { clearPillPriority(3); }, 3000);
});
```

- [ ] **Step 5: Update resetCompactLabel to respect priority**

Replace `resetCompactLabel`:

```js
function resetCompactLabel() {
  if (pillPriority >= 4) {
    if (running) {
      // Will be set by next onClaudeStatus poll
      pillPriority = 5;
    } else {
      pillPriority = 5;
      compactText.textContent = 'Idling...';
      compactText.classList.remove('pill-pulse');
    }
  }
}
```

- [ ] **Step 6: Add session uptime to compact meta**

Replace the `window.island.onSystemInfo` handler:

```js
window.island.onSystemInfo(function(d) {
  cpuCompact.textContent = d.cpu + '%';
  if (running && sessionStats.startTime) {
    var elapsed = Math.floor((Date.now() - sessionStats.startTime) / 1000);
    var uptimeStr;
    if (elapsed < 60) uptimeStr = '0m';
    else if (elapsed < 3600) uptimeStr = Math.floor(elapsed / 60) + 'm';
    else if (elapsed < 86400) uptimeStr = Math.floor(elapsed / 3600) + 'h ' + Math.floor((elapsed % 3600) / 60) + 'm';
    else uptimeStr = Math.floor(elapsed / 86400) + 'd';
    memCompact.textContent = uptimeStr;
  } else {
    memCompact.textContent = d.memUsed + 'G';
  }
  cpuBar.style.width = d.cpu + '%';
  memBar.style.width = d.memPercent + '%';
  cpuVal.textContent = d.cpu + '%';
  memVal.textContent = d.memUsed + '/' + d.memTotal + 'G';
});
```

- [ ] **Step 7: Add pill-pulse CSS animation**

In the `<style>` section, add after the existing keyframes:

```css
.pill-pulse { animation: pillPulse 1.5s ease-in-out infinite; }
@keyframes pillPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
```

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat(core): compact pill priority system, session uptime, question pulse"
```

---

### Task 4: Multi-question sequencing and free-text input

**Files:**
- Modify: `index.html` — question panel JS and HTML/CSS

- [ ] **Step 1: Add question progress indicator HTML**

In the question panel markup, add a progress line and timeout bar. Find the `<div class="question-panel" id="questionPanel">` block and replace it:

```html
<div class="question-panel" id="questionPanel">
  <div class="question-progress" id="questionProgress" style="display:none;"></div>
  <div class="question-text" id="questionText"></div>
  <div id="questionOpts"></div>
  <div class="question-timeout-bar" id="questionTimeoutBar"><div class="question-timeout-fill" id="questionTimeoutFill"></div></div>
</div>
```

- [ ] **Step 2: Add CSS for progress indicator, free-text input, and timeout bar**

Add after the existing `.question-opt-desc` rule:

```css
.question-progress {
  font-size:9px; color:#888; font-weight:600; text-transform:uppercase;
  letter-spacing:0.5px; margin-bottom:4px;
}
.question-free-wrap {
  display:flex; gap:6px; margin-top:4px;
}
.question-free-input {
  flex:1; padding:6px 10px; border-radius:10px; font-size:11.5px;
  background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1);
  color:#fff; outline:none; font-family:inherit;
}
.question-free-input:focus { border-color:var(--body); }
.question-free-input::placeholder { color:#666; }
.question-free-send {
  padding:6px 12px; border-radius:10px; font-size:11px; font-weight:600;
  background:var(--body); color:#000; border:none; cursor:pointer;
  transition:opacity 0.2s;
}
.question-free-send:hover { opacity:0.85; }
.question-timeout-bar {
  height:2px; background:rgba(255,255,255,0.06); border-radius:1px;
  margin-top:6px; overflow:hidden;
}
.question-timeout-fill {
  height:100%; width:0%; border-radius:1px; background:var(--body);
  transition:width 1s linear, background 0.3s ease;
}
.theme-light .question-free-input {
  background:rgba(0,0,0,0.04); border-color:rgba(0,0,0,0.08); color:#111;
}
.theme-light .question-free-input::placeholder { color:#999; }
```

- [ ] **Step 3: Rewrite showQuestion for multi-question support**

Replace the entire `showQuestion` function and related variables:

```js
var allQuestions = [];
var currentQuestionIndex = 0;
var collectedAnswers = {};
var collectedCustomText = {};
var questionStartTime = null;
var timeoutInterval = null;

function showQuestion(q) {
  allQuestions = q.allQuestions || [q];
  currentQuestionIndex = 0;
  collectedAnswers = {};
  collectedCustomText = {};
  currentSessionId = q.session_id || null;
  answerPending = false;
  questionPending = true;
  pillPriority = 1;
  questionStartTime = Date.now();
  renderCurrentQuestion();
  startTimeoutBar();
  qPanel.classList.add('active');
  if (uiState === 'compact') setUI('expanded');
}

function renderCurrentQuestion() {
  var q = allQuestions[currentQuestionIndex];
  var progress = $('questionProgress');
  if (allQuestions.length > 1) {
    progress.textContent = 'Question ' + (currentQuestionIndex + 1) + ' of ' + allQuestions.length;
    progress.style.display = 'block';
  } else {
    progress.style.display = 'none';
  }
  multiSelected = [];
  qText.textContent = q.question;

  if (q.multiSelect) {
    qOpts.innerHTML = q.options.map(function(o, i) {
      return '<div class="question-opt" data-idx="'+i+'" onclick="window._toggleOption('+i+')">' +
        '<div class="question-opt-label"><span class="q-check" id="qc'+i+'">[ ]</span> '+esc(o.label)+'</div>' +
        (o.description ? '<div class="question-opt-desc">'+esc(o.description)+'</div>' : '') +
        '</div>';
    }).join('') + '<div class="question-opt" onclick="window._submitMulti()" style="text-align:center;margin-top:6px;background:var(--body);border-color:var(--body);">' +
      '<div class="question-opt-label" style="color:#000;">Confirm</div></div>';
  } else {
    qOpts.innerHTML = q.options.map(function(o, i) {
      return '<div class="question-opt" data-idx="'+i+'" onclick="window._pickOption('+i+')">' +
        '<div class="question-opt-label">'+(i+1)+'. '+esc(o.label)+'</div>' +
        (o.description ? '<div class="question-opt-desc">'+esc(o.description)+'</div>' : '') +
        '</div>';
    }).join('') +
    '<div class="question-opt" onclick="window._showFreeText()">' +
      '<div class="question-opt-label" style="color:#888;">Other...</div></div>';
  }
}
```

- [ ] **Step 4: Add free-text input handler**

Add after the `renderCurrentQuestion` function:

```js
window._showFreeText = function() {
  if (answerPending) return;
  qOpts.innerHTML = '<div class="question-free-wrap">' +
    '<input class="question-free-input" id="freeTextInput" placeholder="Type your answer..." autofocus />' +
    '<button class="question-free-send" onclick="window._submitFreeText()">Send</button>' +
    '</div>';
  var inp = $('freeTextInput');
  if (inp) {
    inp.focus();
    inp.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') window._submitFreeText();
    });
  }
};

window._submitFreeText = function() {
  if (answerPending) return;
  var inp = $('freeTextInput');
  var text = inp ? inp.value.trim() : '';
  if (!text) return;
  collectedCustomText[currentQuestionIndex] = text;
  collectedAnswers[currentQuestionIndex] = 0; // index 0 as placeholder
  advanceOrSubmit();
};
```

- [ ] **Step 5: Add advanceOrSubmit function and update pickOption/submitMulti**

Add the advance function and update the existing handlers:

```js
function advanceOrSubmit() {
  currentQuestionIndex++;
  if (currentQuestionIndex < allQuestions.length) {
    renderCurrentQuestion();
    return;
  }
  // All questions answered — send response
  answerPending = true;
  qText.textContent = 'Sending answer...';
  qOpts.innerHTML = '';
  stopTimeoutBar();

  var response = { session_id: currentSessionId, answers: collectedAnswers };
  if (Object.keys(collectedCustomText).length > 0) {
    response.customText = collectedCustomText;
  }
  window.island.answerQuestion(response);

  var labels = [];
  for (var k in collectedAnswers) {
    if (collectedCustomText[k]) {
      labels.push('"' + collectedCustomText[k].substring(0, 20) + '"');
    } else {
      var qi = parseInt(k);
      var ai = collectedAnswers[k];
      var q = allQuestions[qi];
      if (q && q.options[ai]) labels.push(q.options[ai].label);
    }
  }
  notify('Answered: ' + labels.join(', '));

  setTimeout(function() { qText.textContent = 'Answer sent \u2713'; }, 800);
  setTimeout(function() {
    hideQuestion();
    answerPending = false;
    questionPending = false;
    clearPillPriority(1);
  }, 2000);
}
```

Replace `window._pickOption`:

```js
window._pickOption = function(idx) {
  if (answerPending) return;
  var opts = qPanel.querySelectorAll('.question-opt');
  for (var i = 0; i < opts.length; i++) {
    if (i === idx) {
      opts[i].style.background = 'var(--body)';
      opts[i].style.borderColor = 'var(--body)';
      opts[i].querySelector('.question-opt-label').style.color = '#000';
      if (opts[i].querySelector('.question-opt-desc'))
        opts[i].querySelector('.question-opt-desc').style.color = '#333';
    } else {
      opts[i].style.opacity = '0.3';
      opts[i].style.pointerEvents = 'none';
    }
  }
  collectedAnswers[currentQuestionIndex] = idx;
  setTimeout(function() { advanceOrSubmit(); }, 400);
};
```

Replace `window._submitMulti`:

```js
window._submitMulti = function() {
  if (answerPending || multiSelected.length === 0) return;
  collectedAnswers[currentQuestionIndex] = multiSelected.slice();
  setTimeout(function() { advanceOrSubmit(); }, 400);
};
```

- [ ] **Step 6: Add timeout bar logic**

Add after the advance function:

```js
function startTimeoutBar() {
  var fill = $('questionTimeoutFill');
  if (!fill) return;
  fill.style.width = '0%';
  fill.style.background = 'var(--body)';
  clearInterval(timeoutInterval);
  questionStartTime = Date.now();
  timeoutInterval = setInterval(function() {
    var elapsed = (Date.now() - questionStartTime) / 1000;
    var pct = Math.min((elapsed / 120) * 100, 100);
    fill.style.width = pct + '%';
    if (elapsed >= 110) fill.style.background = '#d08080';
    else if (elapsed >= 100) fill.style.background = '#e0a878';
    if (elapsed >= 120) {
      stopTimeoutBar();
      qText.textContent = 'Timed out';
      setTimeout(function() {
        hideQuestion();
        questionPending = false;
        clearPillPriority(1);
      }, 1500);
    }
  }, 1000);
}

function stopTimeoutBar() {
  clearInterval(timeoutInterval);
  timeoutInterval = null;
}
```

- [ ] **Step 7: Update hideQuestion to clean up timeout**

Replace `hideQuestion`:

```js
function hideQuestion() {
  qPanel.classList.remove('active');
  qOpts.innerHTML = '';
  allQuestions = [];
  currentQuestionIndex = 0;
  currentSessionId = null;
  multiSelected = [];
  collectedAnswers = {};
  collectedCustomText = {};
  stopTimeoutBar();
  var fill = $('questionTimeoutFill');
  if (fill) fill.style.width = '0%';
}
```

- [ ] **Step 8: Remove old showQuestion variables that are now replaced**

Delete these lines that are now handled by the new code (they were declared near the old `showQuestion`):

```js
// DELETE these — replaced by allQuestions, currentQuestionIndex, etc.
var currentQuestion = null;
var currentSessionId = null;  // keep this one — it's still used
var multiSelected = [];       // keep this one — still used
```

Actually, `currentQuestion` is the only one to remove. `currentSessionId` and `multiSelected` are still used. Just delete the `var currentQuestion = null;` line.

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "feat(core): multi-question sequencing, free-text input, timeout bar"
```

---

### Task 5: Activity feed enrichment and richer session display

**Files:**
- Modify: `index.html` — activity feed rendering, session row rendering

- [ ] **Step 1: Update activity feed rendering to show detail**

Replace the `renderActivityFeed` function:

```js
function renderActivityFeed() {
  if (activityEntries.length === 0) {
    activityFeed.innerHTML = '<div class="activity-empty">No activity yet</div>';
    return;
  }
  activityFeed.innerHTML = activityEntries.map(function(e) {
    var display = e.detail || e.label || e.tool || '...';
    return '<div class="activity-entry">' +
      '<span class="activity-dot ' + toolDotClass(e.tool) + '"></span>' +
      '<span class="activity-label">' + esc(display) + '</span>' +
      '<span class="activity-time">' + since(e.timestamp) + '</span>' +
      '</div>';
  }).join('');
}
```

- [ ] **Step 2: Update onActivityLog to capture detail field**

In the `window.island.onActivityLog` handler, the `entry` object already comes from `watchStatus()` in main.js which reads the status file. Update `watchStatus()` in main.js to include the `detail` field.

In `main.js`, find the `watchStatus` function (around line 487), and in the section that builds the `entry` object, add `detail`:

```js
const entry = {
  tool: status.tool,
  label: status.label,
  detail: status.detail || '',
  timestamp: Date.now(),
  needsInput: status.needsInput || false
};
```

- [ ] **Step 3: Update session row rendering to show active task**

In the `window.island.onClaudeStatus` handler, find the session rendering block. Replace the session row rendering:

```js
if (d.sessions && d.sessions.length > 0) {
  sessionList.innerHTML = d.sessions.map(function(s) {
    var dir = s.cwd ? s.cwd.split(/[\\/]/).slice(-2).join('/') : '?';
    var label = dir;
    var sameCwd = d.sessions.filter(function(o) { return o.cwd === s.cwd; });
    if (sameCwd.length > 1 && s.sessionId) {
      label = dir + ' #' + s.sessionId.substring(0, 6);
    }
    // Find active task for this session
    var activeTask = '';
    if (d.tasks) {
      var running = d.tasks.find(function(t) { return t.status === 'in_progress'; });
      if (running) activeTask = running.subject || running.name || '';
    }
    var ago = s.startedAt ? since(s.startedAt) : '';
    var taskHtml = activeTask ? '<span class="sess-task">' + esc(activeTask) + '</span>' : '';
    return '<div class="sess-row" onclick="window.island.jumpToTerminal(' + s.pid + ')">' +
      '<span class="sess-dot"></span>' +
      '<span class="sess-path">' + esc(label) + '</span>' +
      taskHtml +
      '<span class="sess-time">' + ago + '</span></div>';
  }).join('');
} else { sessionList.innerHTML = ''; }
```

- [ ] **Step 4: Add CSS for session task indicator**

Add after the `.sess-time` rule:

```css
.sess-task {
  font-size:9px; color:var(--body); font-weight:500;
  max-width:80px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  flex-shrink:1;
}
.theme-light .sess-task { color:var(--body); }
```

- [ ] **Step 5: Commit**

```bash
git add index.html main.js
git commit -m "feat(core): enriched activity feed, session task display, detail propagation"
```

---

### Task 6: Verification and final adjustments

**Files:**
- Possibly: `index.html`, `main.js`, `hooks/island-status.js` — minor tweaks only

- [ ] **Step 1: Run setup to install updated hook**

The enriched `island-status.js` needs to be copied to `~/.claude/hooks/`:

```bash
npm run setup
```

This runs `setup.js` which copies hooks and updates settings.json.

- [ ] **Step 2: Launch the app**

```bash
npm start
```

Verify in compact mode:
- Pill shows "Idling..." when no sessions
- When a Claude Code session starts, pill shows "1 session active"
- When tools fire, pill shows enriched labels ("Reading src/main.js", "Running git status...")
- CPU% and session uptime show in compact meta when session is active

- [ ] **Step 3: Verify tool activity detail**

Start a Claude Code session and watch the activity feed. Verify:
- Read/Write/Edit tools show file paths
- Bash shows command snippets
- Grep/Glob shows search patterns
- Activity feed entries show detail instead of generic labels

- [ ] **Step 4: Verify question answering**

Trigger an AskUserQuestion (or use the Island to answer this very question). Verify:
- Question panel shows with timeout bar filling
- "Other..." option appears at bottom of single-select questions
- Clicking "Other..." shows text input + Send button
- Typing and pressing Enter sends the free-text answer
- After answering, "Answer sent ✓" shows briefly
- If multiple questions, progress indicator shows "Question 1 of N"
- Compact pill shows "? " + question text with pulse animation

- [ ] **Step 5: Verify session monitoring**

- Start and stop Claude Code sessions
- Verify sessions appear/disappear faster than before
- Verify no phantom sessions persist after a session ends
- Check that stale session files are cleaned up from `~/.claude/sessions/`

- [ ] **Step 6: Verify session rows show active tasks**

When a Claude Code session has active tasks, verify:
- Session row shows the task subject in small text
- Task text is truncated if too long

- [ ] **Step 7: Fix any issues found**

Common things to watch for:
- Free-text input not focusing on click (may need setTimeout for focus)
- Timeout bar not resetting between questions
- Pill priority not clearing after question is answered
- Activity feed detail being too long (may need truncation in the hook)
- Session uptime not updating (check that `sessionStats.startTime` is set)

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat(core): core function overhaul complete — verification fixes"
```
