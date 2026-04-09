const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const os = require('os');
const net = require('net');

let mainWindow;
let tray;
let historyWatcher = null;
let lastHistorySize = 0;
let prevTasks = [];
let firstPoll = true;
let currentGhostState = 'idle';
let successTimer = null;
let claudeStatusInterval = null;

function restartPolling(interval) {
  if (claudeStatusInterval) clearInterval(claudeStatusInterval);
  claudeStatusInterval = setInterval(() => sendClaudeStatus(), interval);
}

const activityLog = [];
const MAX_ACTIVITY = 100;
const sessionStats = { startTime: null, promptCount: 0, toolCounts: {} };
let notificationHistory = [];
const MAX_NOTIFICATIONS = 20;

const pendingQuestions = new Map();
let questionServer = null;
const QUESTION_PORT = 47523;

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const SESSIONS_DIR = path.join(CLAUDE_DIR, 'sessions');
const TASKS_DIR = path.join(CLAUDE_DIR, 'tasks');
const HISTORY_FILE = path.join(CLAUDE_DIR, 'history.jsonl');
const STATUS_FILE = path.join(CLAUDE_DIR, 'island-status.json');
const STARTUP_LINK = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'ClaudeCodeIsland.lnk');

const SETTINGS_FILE = path.join(CLAUDE_DIR, 'island-settings.json');

const DEFAULT_SETTINGS = {
  opacity: 0.88,
  position: null,
  pollingInterval: 1000,
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
  } catch (e) { console.error('Failed to save settings:', e.message); }
}

const COMPACT_WIDTH = 240;
const COMPACT_HEIGHT = 42;
const EXPANDED_WIDTH = 320;
const EXPANDED_HEIGHT = 380;

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

function createWindow() {
  loadSettings();
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const startX = appSettings.position
    ? Math.min(Math.max(appSettings.position.x, 0), screenWidth - COMPACT_WIDTH)
    : Math.round((screenWidth - COMPACT_WIDTH) / 2);
  const startY = appSettings.position
    ? Math.min(Math.max(appSettings.position.y, 0), screenHeight - COMPACT_HEIGHT)
    : 8;

  mainWindow = new BrowserWindow({
    width: COMPACT_WIDTH,
    height: COMPACT_HEIGHT,
    x: startX,
    y: startY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true);
  mainWindow.loadFile('index.html');
  if (appSettings.opacity !== undefined && appSettings.opacity < 1.0) {
    mainWindow.setOpacity(appSettings.opacity);
  }
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('settings-loaded', appSettings);
  });
  mainWindow.setIgnoreMouseEvents(false);

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

  // Dragging support
  let dragOffset = null;
  ipcMain.on('drag-start', (event, mousePos) => {
    const bounds = mainWindow.getBounds();
    dragOffset = { x: mousePos.x - bounds.x, y: mousePos.y - bounds.y };
  });
  ipcMain.on('drag-move', (event, mousePos) => {
    if (!dragOffset) return;
    mainWindow.setBounds({
      x: mousePos.x - dragOffset.x,
      y: mousePos.y - dragOffset.y,
      width: mainWindow.getBounds().width,
      height: mainWindow.getBounds().height
    });
  });
  ipcMain.on('drag-end', () => {
    dragOffset = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      const bounds = mainWindow.getBounds();
      saveSettings({ position: { x: bounds.x, y: bounds.y } });
    }
  });

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
    const v = parseFloat(value);
    if (isNaN(v)) return;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setOpacity(Math.max(0.3, Math.min(1.0, v)));
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

  ipcMain.on('clear-notification-history', () => {
    notificationHistory = [];
  });

  // Polling intervals
  setInterval(() => sendSystemInfo(), 2000);
  restartPolling(appSettings.pollingInterval);
  sendSystemInfo();
  sendClaudeStatus();

  // Watch history.jsonl for new prompts
  watchHistory();
  watchStatus();
  watchSessions();
}

// --- SYSTEM INFO ---
let prevCpuTimes = null;

function sendSystemInfo() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const cpus = os.cpus();

  // Calculate delta-based CPU usage for accuracy
  const currentTimes = cpus.map(c => ({ idle: c.times.idle, total: Object.values(c.times).reduce((a, b) => a + b, 0) }));
  let cpuPercent = 0;
  if (prevCpuTimes) {
    let totalDelta = 0, idleDelta = 0;
    for (let i = 0; i < currentTimes.length; i++) {
      totalDelta += currentTimes[i].total - prevCpuTimes[i].total;
      idleDelta += currentTimes[i].idle - prevCpuTimes[i].idle;
    }
    cpuPercent = totalDelta > 0 ? Math.round(((totalDelta - idleDelta) / totalDelta) * 100) : 0;
  }
  prevCpuTimes = currentTimes;

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  mainWindow.webContents.send('system-info', {
    cpu: cpuPercent,
    memUsed: (usedMem / 1073741824).toFixed(1),
    memTotal: (totalMem / 1073741824).toFixed(1),
    memPercent: Math.round((usedMem / totalMem) * 100),
    uptime: os.uptime()
  });
}

// --- CLAUDE CODE STATUS (real data) ---
function sendClaudeStatus() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  // 1. Read all session files to find active sessions
  const sessions = readSessions();

  // 2. Check which session PIDs are still alive
  checkAliveSessions(sessions, (aliveSessions) => {
    // 3. Read tasks for alive sessions
    const tasks = readTasks(aliveSessions);

    // Track session start time
    if (aliveSessions.length > 0 && !sessionStats.startTime) {
      sessionStats.startTime = Date.now();
    } else if (aliveSessions.length === 0 && sessionStats.startTime) {
      sessionStats.startTime = null;
      sessionStats.promptCount = 0;
      sessionStats.toolCounts = {};
    }

    // 4. Read recent history
    const recentPrompts = readRecentHistory(5);

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

    // Check for newly completed tasks -> toast notification
    if (firstPoll) {
      firstPoll = false;
      prevTasks = tasks.slice();
    } else {
      for (const t of tasks) {
        const prev = prevTasks.find(p => (p.id || p.subject) === (t.id || t.subject));
        if (t.status === 'completed' && prev && prev.status !== 'completed') {
          showToast('Done: ' + (t.subject || t.name || 'Task'), 'success');
        }
        if (t.status === 'in_progress' && (!prev || prev.status !== 'in_progress')) {
          mainWindow.webContents.send('task-started', t.subject || t.name || 'Task');
        }
      }
      prevTasks = tasks.slice();
    }

    // Compute ghost state based on recent tool activity
    let newGhost = 'idle';
    try {
      const statusRaw = fs.readFileSync(STATUS_FILE, 'utf-8');
      const statusData = JSON.parse(statusRaw);
      if (Date.now() - statusData.timestamp < 5000) {
        newGhost = 'working';
      }
    } catch (e) {}

    for (const t of tasks) {
      const prev = prevTasks.find(p => (p.id || p.subject) === (t.id || t.subject));
      if (t.status === 'completed' && prev && prev.status !== 'completed') {
        newGhost = 'success';
        clearTimeout(successTimer);
        successTimer = setTimeout(() => {
          currentGhostState = 'idle';
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('ghost-state', currentGhostState);
          }
        }, 4000);
      }
    }
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
  });
}

function readSessions() {
  const sessions = [];
  try {
    const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf-8');
        // File may contain multiple JSON objects concatenated
        const parts = raw.split('}{').map((p, i, arr) => {
          if (arr.length === 1) return p;
          if (i === 0) return p + '}';
          if (i === arr.length - 1) return '{' + p;
          return '{' + p + '}';
        });
        for (const part of parts) {
          try { sessions.push(JSON.parse(part)); } catch (e) {}
        }
      } catch (e) {}
    }
  } catch (e) {}
  return sessions;
}

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

function readTasks(sessions) {
  const allTasks = [];
  for (const session of sessions) {
    const taskDir = path.join(TASKS_DIR, session.sessionId);
    try {
      const files = fs.readdirSync(taskDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(taskDir, file), 'utf-8'));
          if (data.tasks) allTasks.push(...data.tasks);
          else if (data.subject) allTasks.push(data);
        } catch (e) {}
      }
    } catch (e) {}
  }
  return allTasks;
}

function readRecentHistory(count) {
  try {
    const content = fs.readFileSync(HISTORY_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    return lines.slice(-count).map(line => {
      try { return JSON.parse(line); } catch (e) { return null; }
    }).filter(Boolean);
  } catch (e) { return []; }
}

// --- WATCH HISTORY FILE for live updates ---
function watchHistory() {
  try {
    const stat = fs.statSync(HISTORY_FILE);
    lastHistorySize = stat.size;
  } catch (e) {}

  try {
    historyWatcher = fs.watch(HISTORY_FILE, () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      try {
        const stat = fs.statSync(HISTORY_FILE);
        if (stat.size > lastHistorySize) {
          // Read only the new bytes
          const fd = fs.openSync(HISTORY_FILE, 'r');
          const buf = Buffer.alloc(stat.size - lastHistorySize);
          fs.readSync(fd, buf, 0, buf.length, lastHistorySize);
          fs.closeSync(fd);
          const newLines = buf.toString('utf-8').trim().split('\n').filter(Boolean);
          for (const line of newLines) {
            try {
              const entry = JSON.parse(line);
              mainWindow.webContents.send('new-prompt', entry);
              sessionStats.promptCount++;
            } catch (e) {}
          }
          lastHistorySize = stat.size;
        }
      } catch (e) {}
    });
  } catch (e) {}
}

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

function watchStatus() {
  let idleTimer = null;
  try {
    fs.watch(STATUS_FILE, () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      try {
        const raw = fs.readFileSync(STATUS_FILE, 'utf-8');
        const status = JSON.parse(raw);
        mainWindow.webContents.send('tool-status', status);

        // Accumulate activity log
        const entry = {
          tool: status.tool,
          label: status.label,
          detail: status.detail || '',
          timestamp: Date.now(),
          needsInput: status.needsInput || false
        };
        activityLog.push(entry);
        if (activityLog.length > MAX_ACTIVITY) activityLog.shift();
        mainWindow.webContents.send('activity-log', { type: 'append', entry });

        // Track tool counts for stats
        sessionStats.toolCounts[status.tool] = (sessionStats.toolCounts[status.tool] || 0) + 1;

        // Question display is handled by TCP server, not status file

        // Immediately switch to working
        if (currentGhostState !== 'success' && currentGhostState !== 'error') {
          currentGhostState = 'working';
          mainWindow.webContents.send('ghost-state', 'working');
        }
        // Reset idle timer
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          if (currentGhostState === 'working') {
            currentGhostState = 'idle';
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('ghost-state', 'idle');
            }
          }
        }, 5000);
      } catch (e) {}
    });
  } catch (e) {
    setTimeout(watchStatus, 5000);
  }
}

function createTray() {
  const canvas = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="7" fill="#E8A55D"/><text x="8" y="12" text-anchor="middle" font-size="10" font-weight="bold" fill="#111" font-family="sans-serif">C</text></svg>`;
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(canvas).toString('base64')}`;
  const icon = nativeImage.createFromDataURL(dataUrl);
  tray = new Tray(icon);
  tray.setToolTip('Claude Code Island');

  const autoStartEnabled = fs.existsSync(STARTUP_LINK);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Island', click: () => mainWindow.show() },
    { label: 'Hide Island', click: () => mainWindow.hide() },
    { type: 'separator' },
    { label: 'Start with Windows', type: 'checkbox', checked: autoStartEnabled, click: (item) => toggleAutoStart(item.checked) },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]));
}

function toggleAutoStart(enable) {
  if (enable) {
    try {
      const { shell } = require('electron');
      // Create a .vbs script that creates the shortcut
      const exePath = process.execPath;
      const appPath = __dirname;
      const vbs = `Set ws = CreateObject("WScript.Shell")\nSet link = ws.CreateShortcut("${STARTUP_LINK.replace(/\\/g, '\\\\')}")\nlink.TargetPath = "${exePath.replace(/\\/g, '\\\\')}"\nlink.Arguments = """${appPath.replace(/\\/g, '\\\\')}"""\nlink.Save`;
      const vbsPath = path.join(os.tmpdir(), 'create-shortcut.vbs');
      fs.writeFileSync(vbsPath, vbs);
      exec(`cscript //nologo "${vbsPath}"`, () => {
        try { fs.unlinkSync(vbsPath); } catch (e) {}
      });
    } catch (e) {}
  } else {
    try { fs.unlinkSync(STARTUP_LINK); } catch (e) {}
  }
}

function showToast(message, type) {
  type = type || 'info';
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

app.whenReady().then(() => {
  startQuestionServer();
  createWindow();
  createTray();
});

app.on('before-quit', () => {
  if (questionServer) questionServer.close();
  for (const [id, sock] of pendingQuestions) {
    try { sock.end(); } catch (e) {}
  }
  pendingQuestions.clear();
});

app.on('window-all-closed', () => app.quit());

ipcMain.on('close-app', () => app.quit());
ipcMain.on('toggle-click-through', (event, enabled) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setIgnoreMouseEvents(enabled, { forward: true });
  }
});

// Terminal jump — focus the terminal window running a Claude Code session by PID
ipcMain.on('jump-to-terminal', (event, pid) => {
  if (!pid) return;
  const psPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
  const cmd = `$c=${pid};for($d=0;$d -lt 5;$d++){$p=Get-Process -Id $c -EA Stop;if($p.MainWindowHandle -ne [IntPtr]::Zero){Add-Type '[DllImport("user32.dll")]public static extern bool SetForegroundWindow(IntPtr h);[DllImport("user32.dll")]public static extern bool ShowWindow(IntPtr h,int c);' -Name W -Namespace W;[W.W]::ShowWindow($p.MainWindowHandle,9);[W.W]::SetForegroundWindow($p.MainWindowHandle);break}$w=Get-CimInstance Win32_Process -Filter "ProcessId=$c";if(-not $w.ParentProcessId){break}$c=$w.ParentProcessId}`;
  exec(`"${psPath}" -NoProfile -ExecutionPolicy Bypass -Command "${cmd}"`, () => {});
});

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
