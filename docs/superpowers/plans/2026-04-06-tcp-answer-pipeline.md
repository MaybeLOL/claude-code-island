# TCP Socket Answer Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace file-polling answer mechanism with a TCP socket server so clicking an option in the Island delivers the answer to Claude without terminal interaction.

**Architecture:** Hook connects to TCP server in Island, sends question, blocks on socket read. User clicks option in Island UI, answer sent back on same socket. Hook exits with code 2 + stderr feedback.

**Tech Stack:** Node.js `net` module (TCP), Electron IPC, vanilla JS

---

### Task 1: Add TCP Server to main.js

**Files:**
- Modify: `C:\Users\cydao\Desktop\claude-code-island\main.js:1-5` (add `net` require)
- Modify: `C:\Users\cydao\Desktop\claude-code-island\main.js:404-407` (start server with app)
- Modify: `C:\Users\cydao\Desktop\claude-code-island\main.js:426-436` (replace answer-question handler)

- [ ] **Step 1: Add net require and pendingQuestions map**

At the top of `main.js`, add `net` to the requires and create the pending questions map:

```js
// Line 1: add net
const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const os = require('os');
const net = require('net');

// After line 14 (let successTimer = null;)
const pendingQuestions = new Map(); // session_id -> socket
let questionServer = null;
const QUESTION_PORT = 47523;
```

- [ ] **Step 2: Add TCP server creation function**

Add this function before `createWindow()` (before line 28):

```js
function startQuestionServer() {
  questionServer = net.createServer((socket) => {
    let buf = '';
    socket.on('data', (chunk) => {
      buf += chunk.toString();
      const newlineIdx = buf.indexOf('\n');
      if (newlineIdx === -1) return;
      const line = buf.substring(0, newlineIdx);
      buf = buf.substring(newlineIdx + 1);
      try {
        const msg = JSON.parse(line);
        if (msg.session_id && msg.questions) {
          pendingQuestions.set(msg.session_id, socket);
          socket.on('close', () => pendingQuestions.delete(msg.session_id));
          socket.on('error', () => pendingQuestions.delete(msg.session_id));
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('show-question', {
              session_id: msg.session_id,
              question: msg.questions[0].question,
              options: msg.questions[0].options,
              multiSelect: msg.questions[0].multiSelect || false,
              allQuestions: msg.questions
            });
            const { width: sw } = screen.getPrimaryDisplay().workAreaSize;
            const bounds = mainWindow.getBounds();
            const x = Math.min(Math.max(bounds.x, 0), sw - EXPANDED_WIDTH);
            mainWindow.setBounds({ x, y: bounds.y, width: EXPANDED_WIDTH, height: EXPANDED_HEIGHT }, true);
          }
        }
      } catch (e) {}
    });
  });
  questionServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      setTimeout(startQuestionServer, 2000);
    }
  });
  questionServer.listen(QUESTION_PORT, '127.0.0.1');
}
```

- [ ] **Step 3: Start server on app ready**

Replace the `app.whenReady` block:

```js
app.whenReady().then(() => {
  startQuestionServer();
  createWindow();
  createTray();
});
```

- [ ] **Step 4: Replace answer-question IPC handler**

Replace the existing `answer-question` handler (lines 426-436) with:

```js
// Answer question — send answer back via TCP socket to the hook
ipcMain.on('answer-question', (event, answer) => {
  const sessionId = answer.session_id;
  const socket = sessionId ? pendingQuestions.get(sessionId) : null;
  if (socket && !socket.destroyed) {
    try {
      socket.write(JSON.stringify(answer) + '\n');
      socket.end();
    } catch (e) {}
    pendingQuestions.delete(sessionId);
  }
});
```

- [ ] **Step 5: Clean up server on quit**

Add before `app.on('window-all-closed')`:

```js
app.on('before-quit', () => {
  if (questionServer) questionServer.close();
  for (const [id, sock] of pendingQuestions) {
    try { sock.end(); } catch (e) {}
  }
  pendingQuestions.clear();
});
```

- [ ] **Step 6: Verify main.js loads without errors**

Run: `cd C:\Users\cydao\Desktop\claude-code-island && node -e "require('./main.js')" 2>&1 || echo "syntax check only"`

This will fail because Electron APIs aren't available in plain node, but it should NOT show syntax errors.

- [ ] **Step 7: Commit**

```bash
cd C:\Users\cydao\Desktop\claude-code-island
git add main.js
git commit -m "feat: add TCP socket server for question answering"
```

---

### Task 2: Rewrite island-ask.js as TCP Client

**Files:**
- Modify: `C:\Users\cydao\.claude\hooks\island-ask.js` (full rewrite)

- [ ] **Step 1: Rewrite island-ask.js**

Replace the entire file with:

```js
const net = require('net');

const QUESTION_PORT = 47523;
const TIMEOUT = 120000;

let input = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const tool = data.tool_name || data.tool || 'unknown';

    if (tool !== 'AskUserQuestion' || !data.tool_input || !data.tool_input.questions) {
      process.exit(0);
    }

    const questions = data.tool_input.questions;
    const sessionId = data.session_id || 'unknown';

    const socket = net.createConnection({ port: QUESTION_PORT, host: '127.0.0.1' }, () => {
      socket.write(JSON.stringify({
        session_id: sessionId,
        questions: questions,
        timestamp: Date.now()
      }) + '\n');
    });

    socket.setTimeout(TIMEOUT);

    let buf = '';
    socket.on('data', (chunk) => {
      buf += chunk.toString();
    });

    socket.on('end', () => {
      if (!buf.trim()) {
        process.exit(0);
      }
      try {
        const answer = JSON.parse(buf.trim());
        const parts = [];
        for (let qi = 0; qi < questions.length; qi++) {
          const q = questions[qi];
          let selected;
          if (answer.answers && answer.answers[qi] !== undefined) {
            selected = answer.answers[qi];
          } else if (qi === 0 && answer.index !== undefined) {
            selected = answer.index;
          } else {
            continue;
          }

          if (q.multiSelect && Array.isArray(selected)) {
            const labels = selected.map(i => {
              const opt = q.options[i];
              return opt ? opt.label : ('Option ' + (i + 1));
            });
            parts.push('For "' + q.question + '": selected [' + labels.join(', ') + ']');
          } else {
            const idx = Array.isArray(selected) ? selected[0] : selected;
            const opt = q.options[idx];
            const label = opt ? opt.label : ('Option ' + (idx + 1));
            if (answer.customText && answer.customText[qi]) {
              parts.push('For "' + q.question + '": user typed "' + answer.customText[qi] + '"');
            } else {
              parts.push('For "' + q.question + '": selected "' + label + '"');
            }
          }
        }
        const msg = 'User answered via Island UI: ' + parts.join('; ');
        process.stderr.write(msg);
        process.exit(2);
      } catch (e) {
        process.exit(0);
      }
    });

    socket.on('timeout', () => {
      socket.destroy();
      process.exit(0);
    });

    socket.on('error', () => {
      process.exit(0);
    });
  } catch (e) {
    process.exit(0);
  }
});
```

- [ ] **Step 2: Verify syntax**

Run: `node -c C:\Users\cydao\.claude\hooks\island-ask.js`

Expected: no output (syntax OK)

- [ ] **Step 3: Commit**

```bash
cd C:\Users\cydao\.claude\hooks
git add island-ask.js
git commit -m "feat: rewrite island-ask.js as TCP client"
```

---

### Task 3: Update Island UI to Pass session_id

**Files:**
- Modify: `C:\Users\cydao\Desktop\claude-code-island\index.html:508-593`

- [ ] **Step 1: Update showQuestion to store session_id**

Replace the `showQuestion` function and answer handlers. Change `var currentQuestion = null;` block to:

```js
  var qPanel = $('questionPanel'), qText = $('questionText'), qOpts = $('questionOpts');
  var currentQuestion = null;
  var currentSessionId = null;
  var multiSelected = [];
```

Update `showQuestion`:

```js
  function showQuestion(q) {
    currentQuestion = q;
    currentSessionId = q.session_id || null;
    multiSelected = [];
    answerPending = false;
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
      }).join('');
    }
    qPanel.classList.add('active');
    if (uiState === 'compact') setUI('expanded');
  }
```

- [ ] **Step 2: Update hideQuestion to clear session_id**

```js
  function hideQuestion() {
    qPanel.classList.remove('active');
    qOpts.innerHTML = '';
    currentQuestion = null;
    currentSessionId = null;
    multiSelected = [];
  }
```

- [ ] **Step 3: Update _pickOption to include session_id**

```js
  window._pickOption = function(idx) {
    if (answerPending) return;
    answerPending = true;
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
    var label = opts[idx] ? opts[idx].querySelector('.question-opt-label').textContent : '';
    qText.textContent = 'Sending answer...';
    notify('Answered: ' + label);
    window.island.answerQuestion({session_id: currentSessionId, index: idx});
    setTimeout(function() { qText.textContent = 'Answer sent!'; }, 800);
    setTimeout(function() { hideQuestion(); answerPending = false; }, 2000);
  };
```

- [ ] **Step 4: Update _submitMulti to include session_id**

```js
  window._submitMulti = function() {
    if (answerPending || multiSelected.length === 0) return;
    answerPending = true;
    var labels = multiSelected.map(function(i) {
      return currentQuestion.options[i] ? currentQuestion.options[i].label : '';
    });
    qText.textContent = 'Sending answer...';
    notify('Answered: ' + labels.join(', '));
    window.island.answerQuestion({session_id: currentSessionId, answers: {0: multiSelected}});
    setTimeout(function() { qText.textContent = 'Answer sent!'; }, 800);
    setTimeout(function() { hideQuestion(); answerPending = false; }, 2000);
  };
```

- [ ] **Step 5: Commit**

```bash
cd C:\Users\cydao\Desktop\claude-code-island
git add index.html
git commit -m "feat: pass session_id through answer flow"
```

---

### Task 4: Update settings.json Timeout

**Files:**
- Modify: `C:\Users\cydao\.claude\settings.json:30`

- [ ] **Step 1: Update timeout from 120 to 130**

Change the AskUserQuestion hook timeout:

```json
{
  "matcher": "AskUserQuestion",
  "hooks": [
    {
      "type": "command",
      "command": "node \"C:\\Users\\cydao\\.claude\\hooks\\island-ask.js\"",
      "timeout": 130
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
cd C:\Users\cydao\.claude
git add settings.json
git commit -m "chore: increase AskUserQuestion hook timeout to 130s"
```

---

### Task 5: End-to-End Test

- [ ] **Step 1: Kill any running Island instances**

```bash
powershell.exe -NoProfile -Command "Get-Process -Name 'electron' -ErrorAction SilentlyContinue | Stop-Process -Force"
```

- [ ] **Step 2: Start the Island**

User runs: `cd C:\Users\cydao\Desktop\claude-code-island && npm start`

- [ ] **Step 3: Verify TCP server is listening**

```bash
node -e "const net=require('net');const s=net.createConnection({port:47523,host:'127.0.0.1'},()=>{console.log('CONNECTED');s.end()});s.on('error',(e)=>console.log('ERROR:',e.code))"
```

Expected: `CONNECTED`

- [ ] **Step 4: Fire AskUserQuestion and test Island answer**

Use `AskUserQuestion` tool with a test question. User clicks option in Island. Verify:
- Island shows question and auto-expands
- Clicking option shows "Sending answer..." then "Answer sent!"
- Claude receives the answer via hook stderr
- No need to answer in terminal

- [ ] **Step 5: Test fallback — Island not running**

Kill Island, fire another `AskUserQuestion`. Verify:
- Hook exits 0 (connection refused)
- Question appears in terminal normally
- User can answer in terminal as usual

---

### Task 6: Clean Up Stale Files

**Files:**
- Delete: `C:\Users\cydao\.claude\island-answer.json` (no longer used)

- [ ] **Step 1: Remove stale answer file**

```bash
rm -f C:\Users\cydao\.claude\island-answer.json
```

- [ ] **Step 2: Commit all changes**

```bash
cd C:\Users\cydao\Desktop\claude-code-island
git add -A
git commit -m "chore: clean up stale files from file-polling approach"
```
