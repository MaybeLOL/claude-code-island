# Dynamic Island Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Claude Code Dynamic Island with a pixel ghost mascot and iOS dark glassmorphism UI.

**Architecture:** Three-file change — preload.js gets one new IPC channel, main.js gets ghost-state detection logic and updated window sizes, index.html gets a complete rewrite with SVG pixel ghosts and glassmorphism CSS.

**Tech Stack:** Electron 33, vanilla HTML/CSS/JS, SVG pixel art

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `preload.js` | Modify | Add `onGhostState` IPC channel |
| `main.js` | Modify | Update sizes, remove full state, add ghost-state logic |
| `index.html` | Rewrite | Pixel ghost SVGs, glassmorphism UI, two-state layout |

---

### Task 1: Update preload.js — Add ghost-state IPC channel

**Files:**
- Modify: `preload.js:1-15`

- [ ] **Step 1: Add onGhostState to the IPC bridge**

Open `preload.js` and add one line to the `contextBridge.exposeInMainWorld` call:

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('island', {
  resize: (state) => ipcRenderer.send('resize-island', state),
  close: () => ipcRenderer.send('close-app'),
  toggleClickThrough: (enabled) => ipcRenderer.send('toggle-click-through', enabled),
  dragStart: (pos) => ipcRenderer.send('drag-start', pos),
  dragMove: (pos) => ipcRenderer.send('drag-move', pos),
  dragEnd: () => ipcRenderer.send('drag-end'),
  onSystemInfo: (cb) => ipcRenderer.on('system-info', (_, data) => cb(data)),
  onClaudeStatus: (cb) => ipcRenderer.on('claude-status', (_, data) => cb(data)),
  onNewPrompt: (cb) => ipcRenderer.on('new-prompt', (_, data) => cb(data)),
  onToast: (cb) => ipcRenderer.on('toast', (_, msg) => cb(msg)),
  onTaskStarted: (cb) => ipcRenderer.on('task-started', (_, msg) => cb(msg)),
  onGhostState: (cb) => ipcRenderer.on('ghost-state', (_, state) => cb(state))
});
```

- [ ] **Step 2: Commit**

```bash
git add preload.js
git commit -m "feat: add onGhostState IPC channel to preload"
```

---

### Task 2: Update main.js — Window sizes, ghost-state logic, remove full state

**Files:**
- Modify: `main.js`

- [ ] **Step 1: Update window size constants (lines 21-26)**

Replace the six size constants with four:

```javascript
const COMPACT_WIDTH = 280;
const COMPACT_HEIGHT = 48;
const EXPANDED_WIDTH = 360;
const EXPANDED_HEIGHT = 420;
```

- [ ] **Step 2: Update resize IPC handler (lines 53-66)**

Replace the resize handler to only handle two states:

```javascript
  ipcMain.on('resize-island', (event, state) => {
    const { width: sw } = screen.getPrimaryDisplay().workAreaSize;
    let w, h;
    if (state === 'compact') {
      w = COMPACT_WIDTH; h = COMPACT_HEIGHT;
    } else {
      w = EXPANDED_WIDTH; h = EXPANDED_HEIGHT;
    }
    const bounds = mainWindow.getBounds();
    const x = Math.min(Math.max(bounds.x, 0), sw - w);
    mainWindow.setBounds({ x, y: bounds.y, width: w, height: h }, true);
  });
```

- [ ] **Step 3: Add ghost-state detection to sendClaudeStatus()**

Add a `ghostState` variable and a success timer at the top of the file (after `let firstPoll = true;`):

```javascript
let currentGhostState = 'idle';
let successTimer = null;
```

Then, inside `sendClaudeStatus()`, after the existing `mainWindow.webContents.send('claude-status', ...)` call and after the task-change detection loop, add ghost-state computation:

```javascript
    // Compute ghost state
    let newGhost = 'idle';
    if (aliveSessions.length > 0) {
      newGhost = 'working';
    }
    // Check for newly completed tasks -> success state
    for (const t of tasks) {
      const prev = prevTasks.find(p => (p.id || p.subject) === (t.id || t.subject));
      if (t.status === 'completed' && prev && prev.status !== 'completed') {
        newGhost = 'success';
        clearTimeout(successTimer);
        successTimer = setTimeout(() => {
          currentGhostState = aliveSessions.length > 0 ? 'working' : 'idle';
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('ghost-state', currentGhostState);
          }
        }, 4000);
      }
    }
    // Check for error tasks
    for (const t of tasks) {
      if (t.status === 'error') {
        newGhost = 'error';
        break;
      }
    }

    if (newGhost !== currentGhostState || firstPoll) {
      currentGhostState = newGhost;
      mainWindow.webContents.send('ghost-state', currentGhostState);
    }
```

- [ ] **Step 4: Verify main.js has no syntax errors**

Run: `cd C:\Users\cydao\Desktop\claude-code-island && node -c main.js`
Expected: No output (clean parse)

- [ ] **Step 5: Commit**

```bash
git add main.js
git commit -m "feat: update window sizes, add ghost-state detection, remove full state"
```

---

### Task 3: Rewrite index.html — CSS foundation and ghost SVGs

**Files:**
- Rewrite: `index.html` (first half — CSS + SVG definitions)

- [ ] **Step 1: Write the HTML head, CSS custom properties, and base styles**

Rewrite `index.html` starting with the document head. The CSS defines:
- State color palettes as CSS custom properties
- Glassmorphism base (dark frosted glass)
- Compact pill layout (280×48)
- Expanded panel layout (360×auto)
- Animation keyframes (bob, shake, pulse, spring, blink)
- Scrollbar and typography

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Claude Code Island</title>
<style>
  :root {
    --hi: #d0c8f0; --body: #b8aedd; --shadow: #6858a0; --face: #6858a0;
    --bg-tint: rgba(22,20,35,0.88);
    --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
    --ios: cubic-bezier(0.25, 0.1, 0.25, 1);
  }
  .state-idle    { --hi:#d0c8f0;--body:#b8aedd;--shadow:#6858a0;--face:#6858a0;--bg-tint:rgba(22,20,35,0.88); }
  .state-working { --hi:#f4c0b0;--body:#e8a090;--shadow:#d89080;--face:#5a2020;--bg-tint:rgba(35,22,22,0.88); }
  .state-success { --hi:#a0f0b8;--body:#70e090;--shadow:#50c070;--face:#1a6040;--bg-tint:rgba(20,35,25,0.88); }
  .state-error   { --hi:#f0a8a8;--body:#e08080;--shadow:#c06060;--face:#6a2020;--bg-tint:rgba(35,20,20,0.88); }

  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    background:transparent; overflow:hidden; user-select:none;
    font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',system-ui,sans-serif;
    color:#fff; -webkit-font-smoothing:antialiased;
  }

  #island {
    position:absolute; top:0; left:50%; transform:translateX(-50%);
    transition:all 0.55s var(--spring); cursor:pointer;
  }
  .pill {
    background:var(--bg-tint);
    backdrop-filter:blur(40px); -webkit-backdrop-filter:blur(40px);
    border:1px solid rgba(255,255,255,0.06);
    overflow:hidden;
    transition:all 0.55s var(--spring);
    box-shadow:0 8px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04);
  }

  /* Compact */
  #island.compact { width:280px; height:48px; }
  #island.compact .pill { height:48px; border-radius:24px; }
  .compact-view {
    display:flex; align-items:center; gap:10px;
    padding:0 14px 0 8px; height:48px;
  }
  .ghost-mini { width:34px; height:34px; flex-shrink:0; image-rendering:pixelated; }
  .status-dot {
    width:6px; height:6px; border-radius:50%; flex-shrink:0;
    background:var(--body); box-shadow:0 0 6px color-mix(in srgb, var(--body) 50%, transparent);
    animation:pulse 2s ease-in-out infinite;
    transition:background 0.6s ease, box-shadow 0.6s ease;
  }
  .status-dot.off { background:#555; box-shadow:none; animation:none; }
  .compact-label {
    font-size:13px; font-weight:600; white-space:nowrap;
    overflow:hidden; text-overflow:ellipsis; flex:1;
    letter-spacing:-0.2px; transition:color 0.6s ease;
  }
  .compact-meta {
    display:flex; gap:8px; font-size:11px; color:#666;
    flex-shrink:0; font-weight:500; font-variant-numeric:tabular-nums;
  }

  /* Expanded */
  #island.expanded { width:360px; height:420px; }
  #island.expanded .pill { height:420px; border-radius:28px; }
  .expanded-view { display:none; flex-direction:column; padding:20px; height:100%; overflow:hidden; }
  #island.expanded .expanded-view { display:flex; }
  #island.expanded .compact-view { display:none; }

  .exp-top { display:flex; align-items:center; gap:14px; margin-bottom:18px; }
  .ghost-big { width:48px; height:48px; flex-shrink:0; image-rendering:pixelated; }
  .exp-info { flex:1; }
  .exp-title { font-size:16px; font-weight:700; letter-spacing:-0.4px; }
  .exp-sub { font-size:12px; color:var(--body); font-weight:500; margin-top:2px; transition:color 0.6s ease; }
  .exp-x {
    width:28px; height:28px; border-radius:50%;
    background:rgba(255,255,255,0.06); display:flex;
    align-items:center; justify-content:center; cursor:pointer;
    transition:background 0.2s;
  }
  .exp-x:hover { background:rgba(255,255,255,0.12); }

  .label {
    font-size:10px; color:#555; font-weight:600;
    text-transform:uppercase; letter-spacing:0.8px; margin-bottom:6px;
  }
  .term-box {
    background:rgba(0,0,0,0.3); border-radius:14px;
    padding:10px 14px; font-size:11px; line-height:1.7;
    font-family:'SF Mono','Cascadia Code','Fira Code',monospace;
    color:var(--body); height:60px; overflow:hidden; margin-bottom:16px;
    transition:color 0.6s ease;
  }
  .term-box .cur {
    display:inline-block; width:7px; height:12px;
    background:var(--body); border-radius:1px;
    animation:blink 1s ease-in-out infinite;
    vertical-align:middle; margin-left:1px;
    transition:background 0.6s ease;
  }

  .meters { display:flex; gap:14px; margin-bottom:16px; }
  .m { flex:1; }
  .m-head { display:flex; justify-content:space-between; margin-bottom:4px; }
  .m-label { font-size:10px; color:#555; font-weight:600; }
  .m-val { font-size:10px; color:#fff; font-weight:700; font-variant-numeric:tabular-nums; }
  .m-track { height:3px; background:rgba(255,255,255,0.06); border-radius:2px; overflow:hidden; }
  .m-fill {
    height:100%; border-radius:2px; background:var(--body);
    transition:width 0.8s var(--ios), background 0.6s ease; width:0%;
  }

  .sess-list { margin-bottom:12px; }
  .sess-row {
    display:flex; align-items:center; gap:8px;
    padding:6px 12px; background:rgba(255,255,255,0.03);
    border-radius:12px; margin-bottom:4px; font-size:11px;
  }
  .sess-dot {
    width:6px; height:6px; border-radius:50%;
    background:var(--body); box-shadow:0 0 6px color-mix(in srgb, var(--body) 40%, transparent);
    transition:background 0.6s ease;
  }
  .sess-path { flex:1; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#ddd; }
  .sess-time { font-size:10px; color:#555; }

  .tasks-box {
    background:rgba(255,255,255,0.03); border-radius:12px;
    padding:8px 12px; font-size:12px; color:#888;
    flex:1; overflow-y:auto; min-height:40px;
  }
  .t-row { display:flex; align-items:center; gap:8px; padding:4px 0; }
  .t-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
  .t-dot.pending { background:#555; }
  .t-dot.running { background:var(--body); box-shadow:0 0 6px color-mix(in srgb, var(--body) 40%, transparent); }
  .t-dot.done { background:#70e090; }
  .t-name { font-weight:500; color:#ddd; font-size:11px; }

  /* Notification toast */
  .notif {
    position:fixed; top:-50px; left:50%; transform:translateX(-50%);
    background:rgba(22,22,30,0.92); backdrop-filter:blur(24px);
    border:1px solid rgba(255,255,255,0.06);
    border-radius:20px; box-shadow:0 4px 24px rgba(0,0,0,0.5);
    padding:10px 18px; display:flex; align-items:center; gap:10px;
    font-size:13px; font-weight:600; color:#fff;
    z-index:200; white-space:nowrap;
    transition:top 0.5s var(--spring);
  }
  .notif.show { top:54px; }
  .ghost-notif { width:24px; height:24px; image-rendering:pixelated; }

  ::-webkit-scrollbar { width:4px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:#333; border-radius:2px; }

  @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
  @keyframes blink { 0%,100%{opacity:1;} 50%{opacity:0;} }
  @keyframes bob { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-2px);} }
  @keyframes bobFast { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-2px);} }
  @keyframes shake { 0%,100%{transform:translateX(0);} 25%{transform:translateX(-1px);} 75%{transform:translateX(1px);} }
  @keyframes bounce { 0%{transform:translateY(0);} 30%{transform:translateY(-4px);} 60%{transform:translateY(0);} }

  .ghost-idle { animation:bob 3s ease-in-out infinite; }
  .ghost-working { animation:bobFast 1.5s ease-in-out infinite; }
  .ghost-success { animation:bounce 0.6s ease-out; }
  .ghost-error { animation:shake 0.3s ease-in-out infinite; }
</style>
</head>
```

- [ ] **Step 2: Write the HTML body — ghost SVGs and compact/expanded layout**

Write the `<body>` with four ghost SVG definitions (one per state) and the two-state layout:

```html
<body>
<div id="island" class="compact state-idle">
  <div class="pill">
    <!-- COMPACT VIEW -->
    <div class="compact-view">
      <div class="ghost-wrap ghost-idle">
        <svg class="ghost-mini" id="ghostCompact" viewBox="0 0 32 32"></svg>
      </div>
      <div class="status-dot" id="statusDot"></div>
      <div class="compact-label" id="compactText">Claude Code Ready</div>
      <div class="compact-meta">
        <span id="cpuCompact">--</span>
        <span id="memCompact">--</span>
      </div>
    </div>

    <!-- EXPANDED VIEW -->
    <div class="expanded-view">
      <div class="exp-top">
        <div class="ghost-wrap ghost-idle">
          <svg class="ghost-big" id="ghostExp" viewBox="0 0 32 32"></svg>
        </div>
        <div class="exp-info">
          <div class="exp-title">Claude Code</div>
          <div class="exp-sub" id="expStatus">Ready</div>
        </div>
        <div class="exp-x" id="collapseBtn">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
               stroke="#666" stroke-width="3" stroke-linecap="round">
            <line x1="6" y1="6" x2="18" y2="18"/>
            <line x1="18" y1="6" x2="6" y2="18"/>
          </svg>
        </div>
      </div>

      <div class="label">Activity</div>
      <div class="term-box" id="terminal"></div>

      <div class="meters">
        <div class="m">
          <div class="m-head">
            <span class="m-label">CPU</span>
            <span class="m-val" id="cpuVal">--%</span>
          </div>
          <div class="m-track"><div class="m-fill" id="cpuBar"></div></div>
        </div>
        <div class="m">
          <div class="m-head">
            <span class="m-label">Memory</span>
            <span class="m-val" id="memVal">--%</span>
          </div>
          <div class="m-track"><div class="m-fill" id="memBar"></div></div>
        </div>
      </div>

      <div class="label">Sessions</div>
      <div class="sess-list" id="sessionList"></div>

      <div class="label">Tasks</div>
      <div class="tasks-box" id="taskItems">No active tasks</div>
    </div>
  </div>
</div>

<!-- Notification toast -->
<div class="notif" id="notif">
  <svg class="ghost-notif" id="ghostNotif" viewBox="0 0 32 32"></svg>
  <span id="notifText"></span>
</div>
```

- [ ] **Step 3: Write the JavaScript — ghost renderer, state machine, IPC handlers**

Add the `<script>` block before `</body>`. This contains:
- Ghost pixel data as arrays (one per state)
- Ghost rendering function that draws SVG rects from pixel data
- State machine (compact ↔ expanded)
- Ghost state manager (swaps colors, animation class, face)
- All IPC listeners (system-info, claude-status, ghost-state, new-prompt, toast, task-started)
- Drag handler
- Terminal typewriter

```javascript
<script>
(function() {
  var $ = function(id) { return document.getElementById(id); };
  var island = $('island'), statusDot = $('statusDot'), compactText = $('compactText');
  var cpuCompact = $('cpuCompact'), memCompact = $('memCompact');
  var expStatus = $('expStatus'), terminal = $('terminal');
  var cpuBar = $('cpuBar'), memBar = $('memBar'), cpuVal = $('cpuVal'), memVal = $('memVal');
  var collapseBtn = $('collapseBtn'), taskItems = $('taskItems');
  var sessionList = $('sessionList'), notifEl = $('notif'), notifText = $('notifText');

  var state = 'compact', ghostState = 'idle', running = false;
  var dragging = false, dragT = 0;
  var lines = [], MAX = 3;

  // --- GHOST PIXEL DATA (32x32 grids) ---
  // Each ghost is an array of {x,y,w,h,color} rects
  // Colors use CSS variable references resolved at render time

  function ghostBase(hi, body, shadow) {
    return [
      // head highlight
      {x:14,y:3,w:4,h:2,c:hi},
      {x:12,y:5,w:8,h:2,c:hi},
      // head body
      {x:10,y:7,w:12,h:2,c:body},
      {x:10,y:9,w:12,h:2,c:hi},
      // body
      {x:10,y:11,w:12,h:2,c:body},
      {x:10,y:13,w:12,h:2,c:shadow},
      {x:10,y:15,w:12,h:2,c:shadow},
      // tail tendrils
      {x:10,y:17,w:4,h:2,c:shadow,o:0.6},
      {x:14,y:17,w:4,h:2,c:shadow,o:0.5},
      {x:18,y:17,w:4,h:2,c:shadow,o:0.6},
      {x:11,y:19,w:3,h:2,c:shadow,o:0.3},
      {x:15,y:19,w:2,h:1,c:shadow,o:0.2},
      {x:18,y:19,w:3,h:2,c:shadow,o:0.3},
    ];
  }

  var faces = {
    idle: [ // closed eyes (sleeping lines)
      {x:12,y:10,w:3,h:1,c:'face'},
      {x:17,y:10,w:3,h:1,c:'face'},
      {x:14,y:13,w:4,h:1,c:'face',o:0.5},
    ],
    working: [ // open eyes with highlight + determined mouth
      {x:12,y:9,w:3,h:3,c:'face'},
      {x:17,y:9,w:3,h:3,c:'face'},
      {x:13,y:9,w:1,h:1,c:'#fff'},
      {x:18,y:9,w:1,h:1,c:'#fff'},
      {x:14,y:13,w:1,h:1,c:'face'},
      {x:15,y:14,w:2,h:1,c:'face'},
      {x:17,y:13,w:1,h:1,c:'face'},
    ],
    success: [ // happy squint ^ ^ + wide smile
      {x:12,y:10,w:1,h:1,c:'face'},{x:13,y:9,w:1,h:1,c:'face'},{x:14,y:10,w:1,h:1,c:'face'},
      {x:17,y:10,w:1,h:1,c:'face'},{x:18,y:9,w:1,h:1,c:'face'},{x:19,y:10,w:1,h:1,c:'face'},
      {x:13,y:13,w:1,h:1,c:'face'},{x:14,y:14,w:4,h:1,c:'face'},{x:18,y:13,w:1,h:1,c:'face'},
    ],
    error: [ // O_O eyes + zigzag mouth + sweat
      {x:11,y:8,w:4,h:4,c:'face'},{x:12,y:9,w:2,h:2,c:'hi'},{x:12,y:10,w:1,h:1,c:'face'},
      {x:17,y:8,w:4,h:4,c:'face'},{x:18,y:9,w:2,h:2,c:'hi'},{x:18,y:10,w:1,h:1,c:'face'},
      {x:13,y:14,w:1,h:1,c:'face'},{x:14,y:15,w:2,h:1,c:'face'},
      {x:16,y:14,w:1,h:1,c:'face'},{x:17,y:15,w:1,h:1,c:'face'},
      // sweat drop
      {x:23,y:7,w:2,h:1,c:'#88ccff'},{x:23,y:8,w:2,h:2,c:'#66aaee'},
      {x:24,y:10,w:1,h:1,c:'#66aaee',o:0.5},
    ],
  };

  var colors = {
    idle:    {hi:'#d0c8f0',body:'#b8aedd',shadow:'#6858a0',face:'#6858a0'},
    working: {hi:'#f4c0b0',body:'#e8a090',shadow:'#d89080',face:'#5a2020'},
    success: {hi:'#a0f0b8',body:'#70e090',shadow:'#50c070',face:'#1a6040'},
    error:   {hi:'#f0a8a8',body:'#e08080',shadow:'#c06060',face:'#6a2020'},
  };

  function renderGhost(svgEl, gState) {
    var c = colors[gState];
    var rects = ghostBase(c.hi, c.body, c.shadow);
    var face = faces[gState];
    var svg = '';
    rects.forEach(function(r) {
      svg += '<rect x="'+r.x+'" y="'+r.y+'" width="'+r.w+'" height="'+r.h+'" fill="'+r.c+'"';
      if (r.o) svg += ' opacity="'+r.o+'"';
      svg += '/>';
    });
    face.forEach(function(r) {
      var fill = r.c === 'face' ? c.face : r.c === 'hi' ? c.hi : r.c;
      svg += '<rect x="'+r.x+'" y="'+r.y+'" width="'+r.w+'" height="'+r.h+'" fill="'+fill+'"';
      if (r.o) svg += ' opacity="'+r.o+'"';
      svg += '/>';
    });
    svgEl.innerHTML = svg;
  }

  function setGhostState(gs) {
    ghostState = gs;
    island.className = island.className.replace(/state-\w+/, 'state-' + gs);
    // Update ghost animation class
    var wraps = document.querySelectorAll('.ghost-wrap');
    wraps.forEach(function(w) {
      w.className = 'ghost-wrap ghost-' + gs;
    });
    renderGhost($('ghostCompact'), gs);
    renderGhost($('ghostExp'), gs);
    renderGhost($('ghostNotif'), gs);
  }

  // Initial render
  setGhostState('idle');

  // --- DRAG ---
  island.addEventListener('mousedown', function(e) {
    if (e.button !== 0) return;
    dragging = false; dragT = Date.now();
    window.island.dragStart({ x: e.screenX, y: e.screenY });
    function mv(ev) { dragging = true; window.island.dragMove({ x: ev.screenX, y: ev.screenY }); }
    function up() { window.island.dragEnd(); document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); }
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  });

  // --- STATE MACHINE ---
  function set(s) {
    state = s;
    island.className = s + ' state-' + ghostState;
    window.island.resize(s);
  }
  island.addEventListener('click', function(e) {
    if (dragging && Date.now() - dragT > 150) return;
    if (e.target.closest('.exp-x')) return;
    if (state === 'compact') set('expanded');
  });
  collapseBtn.addEventListener('click', function(e) { e.stopPropagation(); set('compact'); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && state !== 'compact') set('compact'); });

  // --- TERMINAL ---
  function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function push(t, c) { lines.push({t:t,c:c||''}); if(lines.length>MAX) lines.shift(); render(); }
  function render() {
    terminal.innerHTML = lines.map(function(l) {
      return '<div'+(l.c?' style="color:'+l.c+'"':'')+'>'+esc(l.t)+'</div>';
    }).join('') + '<span class="cur"></span>';
  }
  var tt = null;
  function type(t, c, cb) {
    if(tt) clearTimeout(tt); var i=0;
    lines.push({t:'',c:c||''}); if(lines.length>MAX) lines.shift(); var idx=lines.length-1;
    function go(){if(i<=t.length){lines[idx].t=t.substring(0,i);render();i++;tt=setTimeout(go,18+Math.random()*25);}else{if(cb)cb();}}
    go();
  }

  // --- NOTIFICATION ---
  var nt = null;
  function notify(msg) {
    notifText.textContent = msg;
    notifEl.classList.add('show');
    clearTimeout(nt);
    nt = setTimeout(function() { notifEl.classList.remove('show'); }, 4000);
  }

  // --- IPC: SYSTEM INFO ---
  window.island.onSystemInfo(function(d) {
    cpuCompact.textContent = d.cpu + '%';
    memCompact.textContent = d.memUsed + 'G';
    cpuBar.style.width = d.cpu + '%';
    memBar.style.width = d.memPercent + '%';
    cpuVal.textContent = d.cpu + '%';
    memVal.textContent = d.memUsed + '/' + d.memTotal + 'G';
  });

  // --- IPC: CLAUDE STATUS ---
  window.island.onClaudeStatus(function(d) {
    var was = running; running = d.running;
    statusDot.className = 'status-dot' + (running ? '' : ' off');

    if (running) {
      var n = d.sessions ? d.sessions.length : 0;
      var cwd = d.sessions && d.sessions[0] ? d.sessions[0].cwd : '';
      var dir = cwd ? cwd.split(/[\\/]/).pop() : '';
      compactText.textContent = n > 1 ? n + ' sessions active' : dir ? dir : 'Active';
      expStatus.textContent = n + ' session' + (n>1?'s':'') + ' running';
    } else {
      compactText.textContent = 'Claude Code Ready';
      expStatus.textContent = 'No active sessions';
    }

    // Sessions list
    if (d.sessions && d.sessions.length > 0) {
      sessionList.innerHTML = d.sessions.map(function(s) {
        var dir = s.cwd ? s.cwd.split(/[\\/]/).slice(-2).join('/') : '?';
        var ago = s.startedAt ? since(s.startedAt) : '';
        return '<div class="sess-row"><span class="sess-dot"></span><span class="sess-path">'+esc(dir)+'</span><span class="sess-time">'+ago+'</span></div>';
      }).join('');
    } else { sessionList.innerHTML = ''; }

    // Tasks list
    if (d.tasks && d.tasks.length > 0) {
      taskItems.innerHTML = d.tasks.map(function(t) {
        var c = t.status==='completed'?'done':t.status==='in_progress'?'running':'pending';
        return '<div class="t-row"><span class="t-dot '+c+'"></span><span class="t-name">'+esc(t.subject||t.name||'Task')+'</span></div>';
      }).join('');
    } else { taskItems.innerHTML = 'No active tasks'; }

    // Recent prompts in terminal
    if (d.recentPrompts && d.recentPrompts.length > 0) {
      lines = d.recentPrompts.slice(-MAX).map(function(p) {
        var t = new Date(p.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
        return {t:'['+t+'] '+(p.display?p.display.substring(0,55):'...'), c:'#666'};
      });
      render();
    }

    if (!was && running) { notify('Session started'); push('> Session started'); }
    else if (was && !running) { notify('Session ended'); push('> Session ended', '#666'); }
  });

  // --- IPC: GHOST STATE ---
  window.island.onGhostState(function(gs) {
    setGhostState(gs);
  });

  // --- IPC: NEW PROMPT ---
  window.island.onNewPrompt(function(e) {
    var t = new Date(e.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    type('['+t+'] '+(e.display?e.display.substring(0,50):'...'));
  });

  // --- IPC: TOAST ---
  window.island.onToast(function(msg) { notify(msg); });
  window.island.onTaskStarted(function(msg) { notify('Working: ' + msg); });

  // --- HELPERS ---
  function since(ts) {
    var s=Math.floor((Date.now()-ts)/1000); if(s<60) return s+'s';
    var m=Math.floor(s/60); if(m<60) return m+'m';
    var h=Math.floor(m/60); if(h<24) return h+'h';
    return Math.floor(h/24)+'d';
  }

  push('Claude Code Island');
  push('> Watching ~/.claude ...', '#666');
})();
</script>
</body>
</html>
```

- [ ] **Step 4: Verify the HTML is valid**

Run: `cd C:\Users\cydao\Desktop\claude-code-island && node -e "require('fs').readFileSync('index.html','utf-8')"`
Expected: No error (file reads cleanly)

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: rewrite index.html with pixel ghost and iOS glassmorphism UI"
```

---

### Task 4: Smoke test — Launch and verify

**Files:**
- None (testing only)

- [ ] **Step 1: Launch the app**

Run: `cd C:\Users\cydao\Desktop\claude-code-island && npx electron .`

Expected:
- A dark frosted-glass pill appears at top center of screen
- Lavender pixel ghost on the left with sleeping eyes
- "Claude Code Ready" text
- CPU% and memory stats on the right

- [ ] **Step 2: Test expand/collapse**

- Click the pill → should expand to 360×420 panel with Activity, Meters, Sessions, Tasks
- Press Escape → should collapse back to pill
- Click pill again → expand. Click X button → collapse.

- [ ] **Step 3: Test ghost state transitions**

- Open a Claude Code session in another terminal → ghost should turn peach rose, eyes open
- Complete a task → ghost should flash mint green for 4 seconds
- Close all Claude sessions → ghost should return to lavender idle

- [ ] **Step 4: Test drag**

- Click and drag the pill → should move freely on screen

- [ ] **Step 5: Commit all remaining changes**

```bash
cd C:\Users\cydao\Desktop\claude-code-island
git add -A
git commit -m "chore: complete dynamic island redesign"
```
