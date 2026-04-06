# Claude Code Island — UI Refinement & Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the existing glassmorphism UI, add a 3-tab expanded view (Dashboard/Activity/Settings), improve notifications, and add session stats — all within the current single-file architecture.

**Architecture:** Incremental enhancement of `index.html` (renderer), `main.js` (Electron main process), and `preload.js` (IPC bridge). No new dependencies, no framework migration. Hooks and setup unchanged.

**Tech Stack:** Electron 33, vanilla JS, CSS custom properties, Node.js IPC

---

## File Map

| File | Role | Changes |
|------|------|---------|
| `preload.js` | IPC bridge | Add 7 new methods for activity log, settings, opacity, notifications |
| `main.js` | Main process | Add activity log accumulation, stats tracking, settings persistence, opacity/position/polling control |
| `index.html` | Renderer | Tab system, activity feed, settings panel, notification system, visual polish |

---

### Task 1: Preload — Add New IPC Bridge Methods

**Files:**
- Modify: `preload.js`

This task adds all new IPC channels the renderer and main process will use. Do this first so both sides can reference the API.

- [ ] **Step 1: Add new IPC methods to preload.js**

Open `preload.js` and replace the entire contents with:

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('island', {
  // Existing
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
  onGhostState: (cb) => ipcRenderer.on('ghost-state', (_, state) => cb(state)),
  onToolStatus: (cb) => ipcRenderer.on('tool-status', (_, data) => cb(data)),
  onShowQuestion: (cb) => ipcRenderer.on('show-question', (_, data) => cb(data)),
  jumpToTerminal: (pid) => ipcRenderer.send('jump-to-terminal', pid),
  answerQuestion: (answer) => ipcRenderer.send('answer-question', answer),

  // New — Activity Log
  onActivityLog: (cb) => ipcRenderer.on('activity-log', (_, data) => cb(data)),
  requestActivityLog: () => ipcRenderer.send('request-activity-log'),

  // New — Settings
  saveSettings: (data) => ipcRenderer.send('save-settings', data),
  onSettingsLoaded: (cb) => ipcRenderer.on('settings-loaded', (_, data) => cb(data)),
  requestSettings: () => ipcRenderer.send('request-settings'),

  // New — Opacity
  setOpacity: (value) => ipcRenderer.send('set-opacity', value),

  // New — Position reset
  resetPosition: () => ipcRenderer.send('reset-position'),

  // New — Notification history
  onNotificationHistory: (cb) => ipcRenderer.on('notification-history', (_, data) => cb(data)),
  requestNotificationHistory: () => ipcRenderer.send('request-notification-history'),
});
```

- [ ] **Step 2: Verify app still launches**

Run: `cd C:\Users\cydao\Desktop\claude-code-island && npm start`
Expected: App launches, compact pill appears, existing functionality works (click to expand, ghost renders, sessions show).
Close the app after verifying.

- [ ] **Step 3: Commit**

```bash
git add preload.js
git commit -m "feat: add IPC bridge methods for activity log, settings, opacity, notifications"
```

---

### Task 2: Main Process — Settings Persistence & Opacity

**Files:**
- Modify: `main.js`

Add settings load/save, opacity control, position persistence, and polling interval configuration.

- [ ] **Step 1: Add settings constants and load/save functions after the existing constants block**

In `main.js`, after line 26 (`const STARTUP_LINK = ...`), add:

```js
const SETTINGS_FILE = path.join(CLAUDE_DIR, 'island-settings.json');

const DEFAULT_SETTINGS = {
  opacity: 0.88,
  position: null,
  pollingInterval: 1500,
  notifications: 'both',
  theme: 'dark'
};

let appSettings = { ...DEFAULT_SETTINGS };

function loadSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    const saved = JSON.parse(raw);
    appSettings = { ...DEFAULT_SETTINGS, ...saved };
  } catch (e) {
    appSettings = { ...DEFAULT_SETTINGS };
  }
  return appSettings;
}

function saveSettings(data) {
  appSettings = { ...appSettings, ...data };
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(appSettings, null, 2));
  } catch (e) {}
}
```

- [ ] **Step 2: Add IPC handlers for settings, opacity, position reset**

In `main.js`, after the existing `ipcMain.on('drag-end', ...)` block (around line 128), add:

```js
  // Save position on drag end
  ipcMain.on('drag-end', () => {
    // existing: dragOffset = null;
    // Add position save:
    if (mainWindow && !mainWindow.isDestroyed()) {
      const bounds = mainWindow.getBounds();
      saveSettings({ position: { x: bounds.x, y: bounds.y } });
    }
  });
```

Wait — the existing `drag-end` handler is already there. Instead, modify the existing handler at line 128. Replace:
```js
  ipcMain.on('drag-end', () => { dragOffset = null; });
```
with:
```js
  ipcMain.on('drag-end', () => {
    dragOffset = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      const bounds = mainWindow.getBounds();
      saveSettings({ position: { x: bounds.x, y: bounds.y } });
    }
  });
```

Then add these new handlers after it:

```js
  // Settings
  ipcMain.on('save-settings', (event, data) => {
    saveSettings(data);
    if (data.pollingInterval !== undefined) {
      restartPolling(data.pollingInterval);
    }
  });
  ipcMain.on('request-settings', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('settings-loaded', appSettings);
    }
  });

  // Opacity
  ipcMain.on('set-opacity', (event, value) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setOpacity(Math.max(0.3, Math.min(1.0, value)));
    }
  });

  // Position reset
  ipcMain.on('reset-position', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const { width: sw } = screen.getPrimaryDisplay().workAreaSize;
      const bounds = mainWindow.getBounds();
      mainWindow.setBounds({ x: Math.round((sw - bounds.width) / 2), y: 8, width: bounds.width, height: bounds.height }, true);
      saveSettings({ position: null });
    }
  });
```

- [ ] **Step 3: Make polling interval configurable**

Replace the two `setInterval` lines in `createWindow()` (around line 131-132):
```js
  setInterval(() => sendSystemInfo(), 2000);
  setInterval(() => sendClaudeStatus(), 1500);
```
with:
```js
  let sysInfoInterval = setInterval(() => sendSystemInfo(), 2000);
  let claudeStatusInterval = setInterval(() => sendClaudeStatus(), appSettings.pollingInterval);

  function restartPolling(interval) {
    clearInterval(claudeStatusInterval);
    claudeStatusInterval = setInterval(() => sendClaudeStatus(), interval);
  }
```

Note: `restartPolling` must be accessible from the IPC handler. Move it to module scope or use a closure. Simplest: declare `let claudeStatusInterval` at module scope (near the top with other `let` declarations), and define `restartPolling` at module scope too.

Actually, cleaner approach — declare at module scope (after line 16):
```js
let claudeStatusInterval = null;

function restartPolling(interval) {
  if (claudeStatusInterval) clearInterval(claudeStatusInterval);
  claudeStatusInterval = setInterval(() => sendClaudeStatus(), interval);
}
```

Then in `createWindow()`, replace the two setInterval lines with:
```js
  setInterval(() => sendSystemInfo(), 2000);
  restartPolling(appSettings.pollingInterval);
```

- [ ] **Step 4: Restore saved position on startup**

In `createWindow()`, replace the window position calculation (lines 74-79):
```js
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: COMPACT_WIDTH,
    height: COMPACT_HEIGHT,
    x: Math.round((screenWidth - COMPACT_WIDTH) / 2),
    y: 8,
```
with:
```js
  loadSettings();
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
  const startX = appSettings.position ? appSettings.position.x : Math.round((screenWidth - COMPACT_WIDTH) / 2);
  const startY = appSettings.position ? appSettings.position.y : 8;

  mainWindow = new BrowserWindow({
    width: COMPACT_WIDTH,
    height: COMPACT_HEIGHT,
    x: startX,
    y: startY,
```

- [ ] **Step 5: Apply saved opacity on startup**

After `mainWindow.loadFile('index.html');` (line 97), add:
```js
  if (appSettings.opacity !== undefined && appSettings.opacity < 1.0) {
    mainWindow.setOpacity(appSettings.opacity);
  }
```

- [ ] **Step 6: Send settings to renderer after window loads**

After `mainWindow.loadFile('index.html');` and the opacity line, add:
```js
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('settings-loaded', appSettings);
  });
```

- [ ] **Step 7: Respect notification preference in showToast()**

Replace the existing `showToast` function:
```js
function showToast(message) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (appSettings.notifications !== 'native') {
    mainWindow.webContents.send('toast', message);
  }
  if (appSettings.notifications !== 'inapp' && Notification.isSupported()) {
    new Notification({ title: 'Claude Code Island', body: message, silent: true }).show();
  }
}
```

- [ ] **Step 8: Verify app launches with settings**

Run: `npm start`
Expected: App launches. Drag the pill somewhere, close, relaunch — pill should appear at saved position.
Close the app.

- [ ] **Step 9: Commit**

```bash
git add main.js
git commit -m "feat: add settings persistence, opacity control, position save/restore, configurable polling"
```

---

### Task 3: Main Process — Activity Log & Session Stats

**Files:**
- Modify: `main.js`

Add activity log accumulation from tool events and session stats tracking.

- [ ] **Step 1: Add activity log and stats state at module scope**

After the `let claudeStatusInterval` declaration, add:

```js
const activityLog = [];
const MAX_ACTIVITY = 100;
const sessionStats = { startTime: null, promptCount: 0, toolCounts: {} };
let notificationHistory = [];
const MAX_NOTIFICATIONS = 20;
```

- [ ] **Step 2: Add activity log accumulation in watchStatus()**

In the `watchStatus()` function, inside the `fs.watch` callback, after `const status = JSON.parse(raw);` and `mainWindow.webContents.send('tool-status', status);`, add:

```js
        // Accumulate activity log
        const entry = {
          tool: status.tool,
          label: status.label,
          timestamp: Date.now(),
          needsInput: status.needsInput || false
        };
        activityLog.push(entry);
        if (activityLog.length > MAX_ACTIVITY) activityLog.shift();
        mainWindow.webContents.send('activity-log', { type: 'append', entry });

        // Track tool counts for stats
        sessionStats.toolCounts[status.tool] = (sessionStats.toolCounts[status.tool] || 0) + 1;
```

- [ ] **Step 3: Track session stats in sendClaudeStatus()**

In `sendClaudeStatus()`, inside the `checkAliveSessions` callback, after `const tasks = readTasks(aliveSessions);`, add:

```js
    // Track session start time
    if (aliveSessions.length > 0 && !sessionStats.startTime) {
      sessionStats.startTime = Date.now();
    } else if (aliveSessions.length === 0 && sessionStats.startTime) {
      // Reset stats when all sessions end
      sessionStats.startTime = null;
      sessionStats.promptCount = 0;
      sessionStats.toolCounts = {};
    }
```

Then modify the `claude-status` send to include stats. Replace:
```js
    mainWindow.webContents.send('claude-status', {
      running: aliveSessions.length > 0,
      sessions: aliveSessions,
      tasks,
      recentPrompts
    });
```
with:
```js
    const stats = {
      duration: sessionStats.startTime ? Math.floor((Date.now() - sessionStats.startTime) / 1000) : 0,
      promptCount: sessionStats.promptCount,
      toolCounts: { ...sessionStats.toolCounts }
    };
    mainWindow.webContents.send('claude-status', {
      running: aliveSessions.length > 0,
      sessions: aliveSessions,
      tasks,
      recentPrompts,
      stats
    });
```

- [ ] **Step 4: Increment prompt count in watchHistory()**

In `watchHistory()`, inside the loop `for (const line of newLines)`, after `mainWindow.webContents.send('new-prompt', entry);`, add:

```js
              sessionStats.promptCount++;
```

- [ ] **Step 5: Add IPC handlers for activity log and notification history**

After the `reset-position` IPC handler (added in Task 2), add:

```js
  // Activity log
  ipcMain.on('request-activity-log', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('activity-log', { type: 'full', entries: activityLog });
    }
  });

  // Notification history
  ipcMain.on('request-notification-history', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('notification-history', notificationHistory);
    }
  });
```

- [ ] **Step 6: Track notification history in showToast()**

Replace the `showToast` function (updated in Task 2) with:

```js
function showToast(message, type) {
  type = type || 'info';
  // Store in history
  notificationHistory.unshift({ message, type, timestamp: Date.now() });
  if (notificationHistory.length > MAX_NOTIFICATIONS) notificationHistory.pop();

  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (appSettings.notifications !== 'native') {
    mainWindow.webContents.send('toast', { message, type });
  }
  if (appSettings.notifications !== 'inapp' && Notification.isSupported()) {
    new Notification({ title: 'Claude Code Island', body: message, silent: true }).show();
  }
}
```

- [ ] **Step 7: Update all showToast() call sites to pass type**

Find and update existing calls:

Replace `showToast('Done: ' + (t.subject || t.name || 'Task'));` with:
```js
showToast('Done: ' + (t.subject || t.name || 'Task'), 'success');
```

The `mainWindow.webContents.send('toast', message)` calls in `sendClaudeStatus()` for session start/end — these go through the renderer's `onToast` handler, not `showToast()`. Leave them as-is for now; they'll be updated in the renderer task.

- [ ] **Step 8: Verify activity log accumulates**

Run: `npm start`
Expected: App launches. When a Claude Code session is active and using tools, the status file watcher should accumulate entries. (Full verification happens after the renderer is updated.)
Close the app.

- [ ] **Step 9: Commit**

```bash
git add main.js
git commit -m "feat: add activity log accumulation, session stats tracking, notification history"
```

---

### Task 4: Renderer — Visual Polish (CSS)

**Files:**
- Modify: `index.html`

Apply all CSS refinements before adding new features. This keeps the diff focused.

- [ ] **Step 1: Update CSS custom properties and add light theme**

In `index.html`, after the `.state-error` rule (line 16), add:

```css
  /* Light theme overrides */
  .theme-light { --bg-tint:rgba(240,238,250,0.92); }
  .theme-light .compact-label, .theme-light .exp-title { color:#111; }
  .theme-light .exp-sub, .theme-light .label, .theme-light .m-label { color:#555; }
  .theme-light .m-val, .theme-light .t-name, .theme-light .sess-path { color:#222; }
  .theme-light .m-track { background:rgba(0,0,0,0.08); }
  .theme-light .term-box, .theme-light .tasks-box { background:rgba(0,0,0,0.04); }
  .theme-light .sess-row { background:rgba(0,0,0,0.03); }
  .theme-light .sess-row:hover { background:rgba(0,0,0,0.06); }
  .theme-light .compact-meta { color:#888; }
  .theme-light .notif { background:rgba(240,238,250,0.95); color:#111; }
  .theme-light .question-panel { background:rgba(0,0,0,0.04); }
  .theme-light .question-opt { background:rgba(0,0,0,0.04); border-color:rgba(0,0,0,0.1); }
  .theme-light .question-opt:hover { background:rgba(0,0,0,0.08); }
  .theme-light .question-opt-label { color:#111; }
  .theme-light .question-opt-desc { color:#666; }
```

- [ ] **Step 2: Update .pill for glow, blur, hover, border**

Replace the existing `.pill` rule:
```css
  .pill {
    background:var(--bg-tint);
    backdrop-filter:blur(40px); -webkit-backdrop-filter:blur(40px);
    border:1px solid rgba(255,255,255,0.06);
    overflow:hidden;
    transition:all 0.55s var(--spring);
    box-shadow:none;
  }
```
with:
```css
  .pill {
    background:var(--bg-tint);
    backdrop-filter:blur(50px); -webkit-backdrop-filter:blur(50px);
    border:1px solid rgba(255,255,255,0.08);
    overflow:hidden;
    transition:all 0.4s var(--spring);
    box-shadow:0 0 20px rgba(184,174,221,0.15);
  }
  .state-working .pill { box-shadow:0 0 20px rgba(232,160,144,0.15); }
  .state-success .pill { box-shadow:0 0 20px rgba(112,224,144,0.15); }
  .state-error .pill { box-shadow:0 0 20px rgba(224,128,128,0.15); }
  #island.compact .pill:hover { transform:scale(1.02); }
```

- [ ] **Step 3: Unify transition timing**

Find all `transition:` properties that use `0.55s` or `0.6s` for color/state transitions and replace with `0.4s`. Specifically update these selectors:

Replace `transition:all 0.55s var(--spring);` in `#island` with:
```css
    transition:all 0.4s var(--spring);
```

Replace `transition:color 0.6s ease;` in `.compact-label` with:
```css
    transition:color 0.4s ease;
```

Replace `transition:background 0.6s ease, box-shadow 0.6s ease;` in `.status-dot` with:
```css
    transition:background 0.4s ease, box-shadow 0.4s ease;
```

Replace `transition:color 0.6s ease;` in `.term-box` with:
```css
    transition:color 0.4s ease;
```

Replace `transition:width 0.8s var(--ios), background 0.6s ease;` in `.m-fill` with:
```css
    transition:width 0.8s var(--ios), background 0.4s ease;
```

Replace `transition:color 0.6s ease;` in `.exp-sub` with:
```css
    transition:color 0.4s ease;
```

Replace `transition:background 0.6s ease;` in `.sess-dot` with:
```css
    transition:background 0.4s ease;
```

- [ ] **Step 4: Update typography**

Replace `.compact-label` font-size `13px` with `13.5px`.

Replace `.label` letter-spacing `0.8px` with `0.6px`.

- [ ] **Step 5: Add ghost drop shadow**

Replace `.ghost-wrap` rule:
```css
  .ghost-wrap { width:34px; height:34px; flex-shrink:0; display:block; line-height:0; transition:opacity 0.15s ease; }
```
with:
```css
  .ghost-wrap { width:34px; height:34px; flex-shrink:0; display:block; line-height:0; transition:opacity 0.15s ease; filter:drop-shadow(0 2px 4px rgba(104,88,160,0.3)); }
  .state-working .ghost-wrap { filter:drop-shadow(0 2px 4px rgba(216,144,128,0.3)); }
  .state-success .ghost-wrap { filter:drop-shadow(0 2px 4px rgba(80,192,112,0.3)); }
  .state-error .ghost-wrap { filter:drop-shadow(0 2px 4px rgba(192,96,96,0.3)); }
```

- [ ] **Step 6: Update question panel styling**

Replace `.question-opt` border-radius `10px` with `14px`.

Add the qpulse animation after the existing `@keyframes` block:
```css
  @keyframes qpulse { 0%,100%{border-color:rgba(255,255,255,0.08);} 50%{border-color:var(--body);} }
```

Update `.question-panel.active` to:
```css
  .question-panel.active { display:flex; animation:qpulse 2s ease-in-out infinite; }
```

- [ ] **Step 7: Update notification toast for slide+fade and click-dismiss**

Replace the `.notif` rule:
```css
  .notif {
    position:fixed; top:-50px; left:50%; transform:translateX(-50%);
    background:rgba(22,22,30,0.92); backdrop-filter:blur(24px);
    border:1px solid rgba(255,255,255,0.06);
    border-radius:20px; box-shadow:none;
    padding:10px 18px; display:flex; align-items:center; gap:10px;
    font-size:13px; font-weight:600; color:#fff;
    z-index:200; white-space:nowrap;
    transition:top 0.5s var(--spring);
  }
  .notif.show { top:54px; }
```
with:
```css
  .notif {
    position:fixed; left:50%; transform:translateX(-50%);
    background:rgba(22,22,30,0.92); backdrop-filter:blur(24px);
    border:1px solid rgba(255,255,255,0.06);
    border-radius:20px;
    box-shadow:0 0 15px rgba(184,174,221,0.12);
    padding:10px 18px; display:flex; align-items:center; gap:10px;
    font-size:13px; font-weight:600; color:#fff;
    z-index:200; white-space:nowrap; cursor:pointer;
    transition:top 0.5s var(--spring), opacity 0.3s ease;
    opacity:0; top:-50px; pointer-events:none;
  }
  .notif.show { opacity:1; pointer-events:auto; }
  .state-working .notif { box-shadow:0 0 15px rgba(232,160,144,0.12); }
  .state-success .notif { box-shadow:0 0 15px rgba(112,224,144,0.12); }
  .state-error .notif { box-shadow:0 0 15px rgba(224,128,128,0.12); }
```

- [ ] **Step 8: Verify visual polish**

Run: `npm start`
Expected: Pill has subtle glow, hover scales slightly, transitions feel snappier, ghost has drop shadow. Question panel pulses if a question is active.
Close the app.

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "feat: visual polish — glow, blur, transitions, typography, ghost shadow, toast fade"
```

---

### Task 5: Renderer — Tab System HTML & CSS

**Files:**
- Modify: `index.html`

Add the tab bar and tab content containers to the expanded view. Wire up tab switching logic.

- [ ] **Step 1: Add tab bar CSS**

In the `<style>` block, before the `/* Question panel */` comment, add:

```css
  /* Tab bar */
  .tab-bar {
    display:flex; gap:0; margin-bottom:14px; position:relative;
    border-bottom:1px solid rgba(255,255,255,0.06);
  }
  .tab-btn {
    flex:1; padding:8px 0; text-align:center;
    font-size:11px; font-weight:600; text-transform:uppercase;
    letter-spacing:0.5px; color:#666; cursor:pointer;
    background:none; border:none; outline:none;
    transition:color 0.2s ease;
  }
  .tab-btn.active { color:#fff; }
  .tab-btn:hover:not(.active) { color:#999; }
  .tab-indicator {
    position:absolute; bottom:-1px; height:2px;
    background:var(--body); border-radius:1px;
    transition:left 0.2s ease, width 0.2s ease, background 0.4s ease;
  }
  .tab-content { display:none; flex:1; overflow:hidden; flex-direction:column; }
  .tab-content.active { display:flex; }
  .tab-content.fade-in { animation:tabFade 0.2s ease; }
  @keyframes tabFade { from{opacity:0;} to{opacity:1;} }
  .theme-light .tab-bar { border-bottom-color:rgba(0,0,0,0.08); }
  .theme-light .tab-btn { color:#999; }
  .theme-light .tab-btn.active { color:#111; }
```

- [ ] **Step 2: Add tab content CSS for Activity and Settings tabs**

After the tab CSS, add:

```css
  /* Activity tab */
  .activity-feed {
    flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:2px;
    padding:2px 0;
  }
  .activity-entry {
    display:flex; align-items:center; gap:8px;
    padding:4px 8px; font-size:11px; border-radius:8px;
  }
  .activity-entry:hover { background:rgba(255,255,255,0.03); }
  .activity-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
  .activity-dot.t-read { background:#6ea8fe; }
  .activity-dot.t-write { background:#70e090; }
  .activity-dot.t-bash { background:#f0a050; }
  .activity-dot.t-agent { background:#b8a0f0; }
  .activity-dot.t-other { background:#666; }
  .activity-label { flex:1; color:#ddd; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .activity-time { font-size:10px; color:#555; flex-shrink:0; }
  .activity-empty { text-align:center; color:#555; padding:40px 0; font-size:12px; }
  .theme-light .activity-entry:hover { background:rgba(0,0,0,0.03); }
  .theme-light .activity-label { color:#333; }
  .theme-light .activity-time { color:#888; }

  /* Settings tab */
  .settings-list { display:flex; flex-direction:column; gap:12px; overflow-y:auto; flex:1; padding:2px 0; }
  .setting-row {
    display:flex; align-items:center; justify-content:space-between;
    font-size:12px; color:#ddd;
  }
  .setting-label { font-weight:500; }
  .setting-control { display:flex; align-items:center; gap:6px; }
  .setting-slider {
    -webkit-appearance:none; width:100px; height:3px;
    background:rgba(255,255,255,0.1); border-radius:2px; outline:none;
  }
  .setting-slider::-webkit-slider-thumb {
    -webkit-appearance:none; width:14px; height:14px;
    border-radius:50%; background:var(--body); cursor:pointer;
  }
  .setting-val { font-size:10px; color:#888; min-width:30px; text-align:right; }
  .setting-toggle {
    width:36px; height:20px; border-radius:10px;
    background:rgba(255,255,255,0.1); cursor:pointer;
    position:relative; transition:background 0.2s ease;
    border:none; outline:none; padding:0;
  }
  .setting-toggle.on { background:var(--body); }
  .setting-toggle::after {
    content:''; position:absolute; top:2px; left:2px;
    width:16px; height:16px; border-radius:50%;
    background:#fff; transition:left 0.2s ease;
  }
  .setting-toggle.on::after { left:18px; }
  .setting-btn {
    padding:6px 14px; border-radius:10px; font-size:11px;
    font-weight:600; cursor:pointer; border:none;
    background:rgba(255,255,255,0.08); color:#ddd;
    transition:background 0.2s ease;
  }
  .setting-btn:hover { background:rgba(255,255,255,0.14); }
  .setting-radio { display:flex; gap:4px; }
  .setting-radio-opt {
    padding:4px 10px; border-radius:8px; font-size:10px;
    font-weight:600; cursor:pointer; border:1px solid rgba(255,255,255,0.08);
    background:none; color:#888; transition:all 0.2s ease;
  }
  .setting-radio-opt.active { background:var(--body); color:#000; border-color:var(--body); }
  .theme-light .setting-row { color:#333; }
  .theme-light .setting-slider { background:rgba(0,0,0,0.1); }
  .theme-light .setting-btn { background:rgba(0,0,0,0.06); color:#333; }
  .theme-light .setting-btn:hover { background:rgba(0,0,0,0.1); }
  .theme-light .setting-toggle { background:rgba(0,0,0,0.1); }
  .theme-light .setting-radio-opt { border-color:rgba(0,0,0,0.1); color:#666; }
  .theme-light .setting-radio-opt.active { color:#000; }

  /* Stats row */
  .stats-row { display:flex; gap:14px; margin-bottom:14px; }
  .stat-item { flex:1; }
  .stat-label { font-size:10px; color:#555; font-weight:600; }
  .stat-val { font-size:13px; color:#fff; font-weight:700; font-variant-numeric:tabular-nums; }
  .theme-light .stat-val { color:#111; }
```

- [ ] **Step 3: Restructure expanded view HTML**

Replace the entire `<!-- EXPANDED VIEW -->` section (from `<div class="expanded-view">` through its closing `</div>`) with:

```html
    <!-- EXPANDED VIEW -->
    <div class="expanded-view">
      <div class="exp-top">
        <div class="ghost-wrap">
          <svg class="ghost-big" id="ghostExp" viewBox="0 0 32 32" style="image-rendering:pixelated;"></svg>
        </div>
        <div class="exp-info">
          <div class="exp-title">Claude Code</div>
          <div class="exp-sub" id="expStatus">Ready</div>
        </div>
        <div class="exp-bell" id="bellBtn" title="Notifications">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span class="bell-badge" id="bellBadge" style="display:none;"></span>
        </div>
        <div class="exp-x" id="collapseBtn">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
               stroke="#666" stroke-width="3" stroke-linecap="round">
            <line x1="6" y1="6" x2="18" y2="18"/>
            <line x1="18" y1="6" x2="6" y2="18"/>
          </svg>
        </div>
      </div>

      <!-- Notification history dropdown -->
      <div class="notif-history" id="notifHistory">
        <div class="notif-history-list" id="notifHistoryList"></div>
        <div class="notif-history-clear" id="notifClearAll">Clear all</div>
      </div>

      <div class="question-panel" id="questionPanel">
        <div class="question-text" id="questionText"></div>
        <div id="questionOpts"></div>
      </div>

      <!-- Tab bar -->
      <div class="tab-bar" id="tabBar">
        <button class="tab-btn active" data-tab="dashboard">Dashboard</button>
        <button class="tab-btn" data-tab="activity">Activity</button>
        <button class="tab-btn" data-tab="settings">Settings</button>
        <div class="tab-indicator" id="tabIndicator"></div>
      </div>

      <!-- Dashboard tab -->
      <div class="tab-content active" id="tabDashboard" data-tab="dashboard">
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

        <div class="stats-row" id="statsRow">
          <div class="stat-item"><div class="stat-label">Duration</div><div class="stat-val" id="statDuration">--</div></div>
          <div class="stat-item"><div class="stat-label">Prompts</div><div class="stat-val" id="statPrompts">0</div></div>
          <div class="stat-item"><div class="stat-label">Tools</div><div class="stat-val" id="statTools">0</div></div>
        </div>

        <div class="label">Sessions</div>
        <div class="sess-list" id="sessionList"></div>

        <div class="label">Tasks</div>
        <div class="tasks-box" id="taskItems">No active tasks</div>
      </div>

      <!-- Activity tab -->
      <div class="tab-content" id="tabActivity" data-tab="activity">
        <div class="activity-feed" id="activityFeed">
          <div class="activity-empty">No activity yet</div>
        </div>
      </div>

      <!-- Settings tab -->
      <div class="tab-content" id="tabSettings" data-tab="settings">
        <div class="settings-list">
          <div class="setting-row">
            <span class="setting-label">Opacity</span>
            <div class="setting-control">
              <input type="range" class="setting-slider" id="opacitySlider" min="30" max="100" value="88">
              <span class="setting-val" id="opacityVal">88%</span>
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Polling</span>
            <div class="setting-control">
              <div class="setting-radio" id="pollingRadio">
                <button class="setting-radio-opt active" data-val="1500">Fast</button>
                <button class="setting-radio-opt" data-val="3000">Normal</button>
              </div>
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Notifications</span>
            <div class="setting-control">
              <div class="setting-radio" id="notifRadio">
                <button class="setting-radio-opt" data-val="inapp">In-app</button>
                <button class="setting-radio-opt" data-val="native">Native</button>
                <button class="setting-radio-opt active" data-val="both">Both</button>
              </div>
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Theme</span>
            <div class="setting-control">
              <button class="setting-toggle" id="themeToggle" title="Toggle light/dark"></button>
              <span class="setting-val" id="themeLabel">Dark</span>
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Position</span>
            <div class="setting-control">
              <button class="setting-btn" id="resetPosBtn">Reset to center</button>
            </div>
          </div>
        </div>
      </div>
    </div>
```

- [ ] **Step 4: Add bell icon and notification history CSS**

In the `<style>` block, after the `.exp-x:hover` rule, add:

```css
  .exp-bell {
    width:28px; height:28px; border-radius:50%;
    background:rgba(255,255,255,0.06); display:flex;
    align-items:center; justify-content:center; cursor:pointer;
    transition:background 0.2s; position:relative;
  }
  .exp-bell:hover { background:rgba(255,255,255,0.12); }
  .bell-badge {
    position:absolute; top:0; right:0; width:8px; height:8px;
    border-radius:50%; background:#e08080;
  }
  .notif-history {
    display:none; position:absolute; top:60px; right:20px;
    width:280px; max-height:300px; z-index:100;
    background:rgba(22,22,30,0.95); backdrop-filter:blur(30px);
    border:1px solid rgba(255,255,255,0.08); border-radius:16px;
    overflow:hidden; flex-direction:column;
  }
  .notif-history.open { display:flex; }
  .notif-history-list { flex:1; overflow-y:auto; padding:8px; }
  .notif-history-entry {
    display:flex; align-items:flex-start; gap:8px;
    padding:6px 8px; font-size:11px; border-radius:8px;
    border-left:3px solid #555;
  }
  .notif-history-entry.type-success { border-left-color:#70e090; }
  .notif-history-entry.type-info { border-left-color:#6ea8fe; }
  .notif-history-entry.type-question { border-left-color:#f0c060; }
  .notif-history-icon { flex-shrink:0; font-size:10px; margin-top:1px; }
  .notif-history-msg { flex:1; color:#ddd; font-weight:500; }
  .notif-history-time { font-size:10px; color:#555; flex-shrink:0; }
  .notif-history-clear {
    text-align:center; padding:8px; font-size:11px;
    color:#888; cursor:pointer; border-top:1px solid rgba(255,255,255,0.06);
    transition:color 0.2s;
  }
  .notif-history-clear:hover { color:#fff; }
  .theme-light .notif-history { background:rgba(240,238,250,0.95); border-color:rgba(0,0,0,0.08); }
  .theme-light .notif-history-msg { color:#333; }
  .theme-light .notif-history-clear { color:#666; border-top-color:rgba(0,0,0,0.06); }
  .theme-light .notif-history-clear:hover { color:#111; }
```

- [ ] **Step 5: Verify HTML structure renders**

Run: `npm start`
Expected: Expanded view shows tab bar with Dashboard/Activity/Settings. Dashboard tab shows meters, stats row, sessions, tasks. Clicking tabs doesn't work yet (JS not wired). Visual polish is visible.
Close the app.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add tab system HTML structure, activity/settings tab markup, notification history dropdown"
```

---

### Task 6: Renderer — Tab Switching, Activity Feed, Settings, Notifications JS

**Files:**
- Modify: `index.html`

Wire up all the new interactive logic in the `<script>` block.

- [ ] **Step 1: Add tab switching logic**

In the `<script>` block, after the `var uiState = 'compact'` declarations (around line 286), add:

```js
  var currentTab = 'dashboard';

  // Tab switching
  var tabBtns = document.querySelectorAll('.tab-btn');
  var tabContents = document.querySelectorAll('.tab-content');
  var tabIndicator = $('tabIndicator');

  function updateTabIndicator() {
    var activeBtn = document.querySelector('.tab-btn.active');
    if (activeBtn && tabIndicator) {
      tabIndicator.style.left = activeBtn.offsetLeft + 'px';
      tabIndicator.style.width = activeBtn.offsetWidth + 'px';
    }
  }

  function switchTab(tab) {
    currentTab = tab;
    tabBtns.forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });
    tabContents.forEach(function(tc) {
      var isActive = tc.getAttribute('data-tab') === tab;
      tc.classList.toggle('active', isActive);
      if (isActive) {
        tc.classList.remove('fade-in');
        void tc.offsetWidth; // force reflow
        tc.classList.add('fade-in');
      }
    });
    updateTabIndicator();
    if (tab === 'activity') {
      window.island.requestActivityLog();
      scrollActivityToBottom();
    }
  }

  tabBtns.forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      switchTab(btn.getAttribute('data-tab'));
    });
  });

  // Position indicator after layout
  setTimeout(updateTabIndicator, 100);
```

- [ ] **Step 2: Add activity feed logic**

After the tab switching code, add:

```js
  // Activity feed
  var activityFeed = $('activityFeed');
  var activityEntries = [];

  function toolDotClass(tool) {
    if (!tool) return 't-other';
    if (['Read','Glob','Grep'].indexOf(tool) !== -1) return 't-read';
    if (['Write','Edit'].indexOf(tool) !== -1) return 't-write';
    if (tool === 'Bash') return 't-bash';
    if (tool === 'Agent') return 't-agent';
    return 't-other';
  }

  function renderActivityFeed() {
    if (activityEntries.length === 0) {
      activityFeed.innerHTML = '<div class="activity-empty">No activity yet</div>';
      return;
    }
    activityFeed.innerHTML = activityEntries.map(function(e) {
      return '<div class="activity-entry">' +
        '<span class="activity-dot ' + toolDotClass(e.tool) + '"></span>' +
        '<span class="activity-label">' + esc(e.label || e.tool || '...') + '</span>' +
        '<span class="activity-time">' + since(e.timestamp) + '</span>' +
        '</div>';
    }).join('');
  }

  function scrollActivityToBottom() {
    if (activityFeed) activityFeed.scrollTop = activityFeed.scrollHeight;
  }

  window.island.onActivityLog(function(data) {
    if (data.type === 'full') {
      activityEntries = data.entries || [];
    } else if (data.type === 'append' && data.entry) {
      activityEntries.push(data.entry);
      if (activityEntries.length > 100) activityEntries.shift();
    }
    if (currentTab === 'activity') {
      renderActivityFeed();
      scrollActivityToBottom();
    }
  });
```

- [ ] **Step 3: Add settings panel logic**

After the activity feed code, add:

```js
  // Settings
  var currentSettings = { opacity: 0.88, pollingInterval: 1500, notifications: 'both', theme: 'dark' };

  var opacitySlider = $('opacitySlider');
  var opacityVal = $('opacityVal');
  var pollingRadio = $('pollingRadio');
  var notifRadio = $('notifRadio');
  var themeToggle = $('themeToggle');
  var themeLabel = $('themeLabel');
  var resetPosBtn = $('resetPosBtn');

  function applySettings(s) {
    currentSettings = s;
    // Opacity
    if (opacitySlider) opacitySlider.value = Math.round(s.opacity * 100);
    if (opacityVal) opacityVal.textContent = Math.round(s.opacity * 100) + '%';
    // Polling
    if (pollingRadio) {
      pollingRadio.querySelectorAll('.setting-radio-opt').forEach(function(btn) {
        btn.classList.toggle('active', parseInt(btn.getAttribute('data-val')) === s.pollingInterval);
      });
    }
    // Notifications
    if (notifRadio) {
      notifRadio.querySelectorAll('.setting-radio-opt').forEach(function(btn) {
        btn.classList.toggle('active', btn.getAttribute('data-val') === s.notifications);
      });
    }
    // Theme
    if (themeToggle) themeToggle.classList.toggle('on', s.theme === 'light');
    if (themeLabel) themeLabel.textContent = s.theme === 'light' ? 'Light' : 'Dark';
    document.body.classList.toggle('theme-light', s.theme === 'light');
    island.classList.toggle('theme-light', s.theme === 'light');
  }

  function saveSetting(key, value) {
    currentSettings[key] = value;
    window.island.saveSettings(currentSettings);
  }

  if (opacitySlider) {
    opacitySlider.addEventListener('input', function() {
      var val = parseInt(opacitySlider.value) / 100;
      if (opacityVal) opacityVal.textContent = opacitySlider.value + '%';
      window.island.setOpacity(val);
    });
    opacitySlider.addEventListener('change', function() {
      saveSetting('opacity', parseInt(opacitySlider.value) / 100);
    });
  }

  if (pollingRadio) {
    pollingRadio.querySelectorAll('.setting-radio-opt').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var val = parseInt(btn.getAttribute('data-val'));
        pollingRadio.querySelectorAll('.setting-radio-opt').forEach(function(b) {
          b.classList.toggle('active', b === btn);
        });
        saveSetting('pollingInterval', val);
      });
    });
  }

  if (notifRadio) {
    notifRadio.querySelectorAll('.setting-radio-opt').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var val = btn.getAttribute('data-val');
        notifRadio.querySelectorAll('.setting-radio-opt').forEach(function(b) {
          b.classList.toggle('active', b === btn);
        });
        saveSetting('notifications', val);
      });
    });
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      var newTheme = currentSettings.theme === 'dark' ? 'light' : 'dark';
      themeToggle.classList.toggle('on', newTheme === 'light');
      if (themeLabel) themeLabel.textContent = newTheme === 'light' ? 'Light' : 'Dark';
      document.body.classList.toggle('theme-light', newTheme === 'light');
      island.classList.toggle('theme-light', newTheme === 'light');
      saveSetting('theme', newTheme);
    });
  }

  if (resetPosBtn) {
    resetPosBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      window.island.resetPosition();
    });
  }

  window.island.onSettingsLoaded(function(s) {
    applySettings(s);
  });
  // Request settings on load
  window.island.requestSettings();
```

- [ ] **Step 4: Add notification history logic**

After the settings code, add:

```js
  // Notification history
  var bellBtn = $('bellBtn');
  var bellBadge = $('bellBadge');
  var notifHistoryEl = $('notifHistory');
  var notifHistoryList = $('notifHistoryList');
  var notifClearAll = $('notifClearAll');
  var notifHistoryData = [];
  var notifHistoryOpen = false;
  var unseenNotifs = 0;

  function renderNotifHistory() {
    if (notifHistoryData.length === 0) {
      notifHistoryList.innerHTML = '<div style="text-align:center;padding:20px;color:#555;font-size:11px;">No notifications</div>';
      return;
    }
    notifHistoryList.innerHTML = notifHistoryData.map(function(n) {
      var typeClass = 'type-' + (n.type || 'info');
      var icon = n.type === 'success' ? '&#10003;' : n.type === 'question' ? '?' : '&#8226;';
      return '<div class="notif-history-entry ' + typeClass + '">' +
        '<span class="notif-history-icon">' + icon + '</span>' +
        '<span class="notif-history-msg">' + esc(n.message) + '</span>' +
        '<span class="notif-history-time">' + since(n.timestamp) + '</span>' +
        '</div>';
    }).join('');
  }

  if (bellBtn) {
    bellBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      notifHistoryOpen = !notifHistoryOpen;
      notifHistoryEl.classList.toggle('open', notifHistoryOpen);
      if (notifHistoryOpen) {
        window.island.requestNotificationHistory();
        unseenNotifs = 0;
        if (bellBadge) bellBadge.style.display = 'none';
      }
    });
  }

  if (notifClearAll) {
    notifClearAll.addEventListener('click', function(e) {
      e.stopPropagation();
      notifHistoryData = [];
      renderNotifHistory();
    });
  }

  // Close notification history when clicking outside
  document.addEventListener('click', function(e) {
    if (notifHistoryOpen && !e.target.closest('.notif-history') && !e.target.closest('.exp-bell')) {
      notifHistoryOpen = false;
      notifHistoryEl.classList.remove('open');
    }
  });

  window.island.onNotificationHistory(function(data) {
    notifHistoryData = data || [];
    renderNotifHistory();
  });
```

- [ ] **Step 5: Add stats row update logic**

After the notification history code, add:

```js
  // Stats row
  var statDuration = $('statDuration');
  var statPrompts = $('statPrompts');
  var statTools = $('statTools');

  function updateStats(stats) {
    if (!stats) return;
    if (statDuration) {
      var d = stats.duration || 0;
      if (d < 60) statDuration.textContent = d + 's';
      else if (d < 3600) statDuration.textContent = Math.floor(d / 60) + 'm';
      else statDuration.textContent = Math.floor(d / 3600) + 'h ' + Math.floor((d % 3600) / 60) + 'm';
    }
    if (statPrompts) statPrompts.textContent = stats.promptCount || 0;
    if (statTools) {
      var total = 0;
      if (stats.toolCounts) {
        for (var k in stats.toolCounts) total += stats.toolCounts[k];
      }
      statTools.textContent = total;
    }
  }
```

- [ ] **Step 6: Update the onClaudeStatus handler to include stats**

Find the existing `window.island.onClaudeStatus(function(d) {` handler. Inside it, after the tasks rendering block (after `} else { taskItems.innerHTML='No active tasks'; }`), add:

```js
    // Update stats
    if (d.stats) updateStats(d.stats);
```

- [ ] **Step 7: Update toast handler for new toast format and stacking**

Replace the existing notification toast logic. Find the `var nt=null;` and `function notify(msg){` block and replace with:

```js
  // Toast stacking
  var toastStack = [];
  var MAX_TOASTS = 3;

  function notify(msg, type) {
    // Handle both string and object format from main process
    var message = typeof msg === 'object' ? msg.message : msg;
    type = (typeof msg === 'object' ? msg.type : type) || 'info';

    // Track unseen for bell badge
    unseenNotifs++;
    if (bellBadge && !notifHistoryOpen) bellBadge.style.display = 'block';

    // Create toast element
    var toast = document.createElement('div');
    toast.className = 'notif show';
    toast.innerHTML = '<svg class="ghost-notif" viewBox="0 0 32 32" style="image-rendering:pixelated;"></svg><span>' + esc(message) + '</span>';
    renderGhost(toast.querySelector('svg'), ghostState);
    document.body.appendChild(toast);

    // Position in stack
    toastStack.push(toast);
    if (toastStack.length > MAX_TOASTS) {
      var old = toastStack.shift();
      old.remove();
    }
    repositionToasts();

    // Click to dismiss
    toast.addEventListener('click', function() {
      dismissToast(toast);
    });

    // Auto-hide after 4s
    setTimeout(function() {
      dismissToast(toast);
    }, 4000);
  }

  function dismissToast(toast) {
    toast.classList.remove('show');
    setTimeout(function() {
      var idx = toastStack.indexOf(toast);
      if (idx !== -1) toastStack.splice(idx, 1);
      toast.remove();
      repositionToasts();
    }, 300);
  }

  function repositionToasts() {
    for (var i = 0; i < toastStack.length; i++) {
      toastStack[i].style.top = (54 + i * 48) + 'px';
    }
  }
```

- [ ] **Step 8: Remove the old static notif element reference**

The old code references `var notifEl = $('notif'), notifText = $('notifText');` at the top of the script. Remove those two variable declarations from the `var $ = function(id)` block. Also remove the static `<div class="notif" id="notif">` element from the HTML body (the one before `<!-- PLACEHOLDER_SCRIPT -->`), since toasts are now created dynamically.

Remove from HTML:
```html
<!-- Notification toast -->
<div class="notif" id="notif">
  <svg class="ghost-notif" id="ghostNotif" viewBox="0 0 32 32" style="image-rendering:pixelated;"></svg>
  <span id="notifText"></span>
</div>
```

And remove `ghostNotif` from the initial render block:
```js
  renderGhost($('ghostNotif'), 'idle');
```

Update the `onToast` handler:
```js
  window.island.onToast(function(msg) { notify(msg); });
```
This already works since `notify` now handles both string and object formats.

- [ ] **Step 9: Verify everything works end-to-end**

Run: `npm start`
Expected:
- Compact pill shows with glow, hover scales
- Click to expand: tab bar visible with Dashboard/Activity/Settings
- Dashboard: meters, stats row (shows -- until session active), sessions, tasks
- Activity tab: "No activity yet" or entries if Claude Code is running
- Settings tab: opacity slider works (pill becomes transparent), polling toggle, notification radio, theme toggle (switches to light), reset position button
- Bell icon in header, click opens notification history dropdown
- Toasts stack vertically, click to dismiss
- Close and reopen: position and settings persist

- [ ] **Step 10: Commit**

```bash
git add index.html
git commit -m "feat: wire up tab switching, activity feed, settings panel, notification history, toast stacking"
```

---

### Task 7: Final Integration & Cleanup

**Files:**
- Modify: `index.html`
- Modify: `main.js`

Final pass to make sure all pieces connect properly and clean up any dead code.

- [ ] **Step 1: Remove dead terminal box references from JS**

In `index.html`, remove the `var terminal = $('terminal');` declaration and the `lines`, `MAX`, `push()`, `render()`, `type()` functions that powered the old terminal box. Also remove the two `push()` calls at the bottom:
```js
  push('Claude Code Island');
  push('> Watching ~/.claude ...','#666');
```

Remove the `onNewPrompt` handler's `type()` call — replace the entire handler with:
```js
  window.island.onNewPrompt(function(e) {
    var display = e.display ? e.display.substring(0, 40) : '...';
    if (running) {
      compactText.textContent = display;
      clearTimeout(compactResetTimer);
      compactResetTimer = setTimeout(resetCompactLabel, 5000);
    }
  });
```

- [ ] **Step 2: Remove the terminal box HTML and CSS**

Remove the `<div class="label">Activity</div>` and `<div class="term-box" id="terminal"></div>` from the Dashboard tab (they were already removed in Task 5's HTML restructure — verify they're gone).

Remove the `.term-box` and `.term-box .cur` CSS rules since they're no longer used.

- [ ] **Step 3: Update the compact label on tool status to also feed activity**

The `onToolStatus` handler already updates the compact label. No changes needed — activity log comes from main process via IPC.

- [ ] **Step 4: Verify complete integration**

Run: `npm start`
Full test:
1. Pill appears at saved position with glow
2. Expand — Dashboard shows meters, stats, sessions, tasks
3. Switch to Activity — shows tool events if Claude is running
4. Switch to Settings — all controls work
5. Toggle theme to Light — colors invert properly
6. Adjust opacity — pill becomes transparent
7. Reset position — pill jumps to center
8. Bell icon — shows notification history
9. Toasts stack and dismiss on click
10. Close and reopen — all settings persist
11. Ghost animates through states correctly

- [ ] **Step 5: Commit**

```bash
git add index.html main.js
git commit -m "feat: cleanup dead terminal code, finalize integration"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Preload IPC bridge | `preload.js` |
| 2 | Settings persistence, opacity, position | `main.js` |
| 3 | Activity log, session stats, notification history | `main.js` |
| 4 | Visual polish CSS | `index.html` |
| 5 | Tab system HTML & CSS | `index.html` |
| 6 | Tab switching, activity feed, settings, notifications JS | `index.html` |
| 7 | Final integration & cleanup | `index.html`, `main.js` |
