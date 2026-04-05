const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const os = require('os');

let mainWindow;
let tray;
let historyWatcher = null;
let lastHistorySize = 0;
let prevTasks = [];
let firstPoll = true;
let currentGhostState = 'idle';
let successTimer = null;

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const SESSIONS_DIR = path.join(CLAUDE_DIR, 'sessions');
const TASKS_DIR = path.join(CLAUDE_DIR, 'tasks');
const HISTORY_FILE = path.join(CLAUDE_DIR, 'history.jsonl');
const STATUS_FILE = path.join(CLAUDE_DIR, 'island-status.json');
const STARTUP_LINK = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'ClaudeCodeIsland.lnk');

const COMPACT_WIDTH = 280;
const COMPACT_HEIGHT = 48;
const EXPANDED_WIDTH = 360;
const EXPANDED_HEIGHT = 420;

function createWindow() {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: COMPACT_WIDTH,
    height: COMPACT_HEIGHT,
    x: Math.round((screenWidth - COMPACT_WIDTH) / 2),
    y: 8,
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
  ipcMain.on('drag-end', () => { dragOffset = null; });

  // Polling intervals
  setInterval(() => sendSystemInfo(), 2000);
  setInterval(() => sendClaudeStatus(), 1500);
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

    // 4. Read recent history
    const recentPrompts = readRecentHistory(5);

    mainWindow.webContents.send('claude-status', {
      running: aliveSessions.length > 0,
      sessions: aliveSessions,
      tasks,
      recentPrompts
    });

    // Check for newly completed tasks -> toast notification
    if (firstPoll) {
      firstPoll = false;
      prevTasks = tasks.slice();
    } else {
      for (const t of tasks) {
        const prev = prevTasks.find(p => (p.id || p.subject) === (t.id || t.subject));
        if (t.status === 'completed' && prev && prev.status !== 'completed') {
          showToast('Done: ' + (t.subject || t.name || 'Task'));
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
  const pids = sessions.map(s => s.pid);
  // Use tasklist to check which PIDs are alive
  exec(`tasklist /FO CSV /NH`, (err, stdout) => {
    const alivePids = new Set();
    if (stdout) {
      for (const line of stdout.split('\n')) {
        const match = line.match(/"[^"]*","(\d+)"/);
        if (match) alivePids.add(parseInt(match[1]));
      }
    }
    const alive = sessions.filter(s => alivePids.has(s.pid));
    callback(alive);
  });
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
            } catch (e) {}
          }
          lastHistorySize = stat.size;
        }
      } catch (e) {}
    });
  } catch (e) {}
}

function watchSessions() {
  try {
    fs.watch(SESSIONS_DIR, () => {
      // Session file added or removed — immediately re-poll
      sendClaudeStatus();
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

        // If AskUserQuestion, auto-expand island and show options
        if (status.needsInput && status.questions && status.questions.length > 0) {
          mainWindow.webContents.send('show-question', status.questions[0]);
          // Expand the window to show the question
          const { width: sw } = screen.getPrimaryDisplay().workAreaSize;
          const bounds = mainWindow.getBounds();
          const x = Math.min(Math.max(bounds.x, 0), sw - EXPANDED_WIDTH);
          mainWindow.setBounds({ x, y: bounds.y, width: EXPANDED_WIDTH, height: EXPANDED_HEIGHT }, true);
        }

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

function showToast(message) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  // Send to renderer for in-app toast
  mainWindow.webContents.send('toast', message);
  // Also show native Windows notification
  if (Notification.isSupported()) {
    new Notification({ title: 'Claude Code Island', body: message, silent: true }).show();
  }
}

app.whenReady().then(() => {
  createWindow();
  createTray();
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
  // Use PowerShell to find the parent terminal window of the Claude process and bring it to front
  const ps = `
    Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    public class WinAPI {
      [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
      [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    }
"@
    try {
      $proc = Get-Process -Id ${pid} -ErrorAction Stop
      $hwnd = $proc.MainWindowHandle
      if ($hwnd -eq [IntPtr]::Zero) {
        $parent = (Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").ParentProcessId
        if ($parent) {
          $pproc = Get-Process -Id $parent -ErrorAction Stop
          $hwnd = $pproc.MainWindowHandle
        }
      }
      if ($hwnd -ne [IntPtr]::Zero) {
        [WinAPI]::ShowWindow($hwnd, 9)
        [WinAPI]::SetForegroundWindow($hwnd)
      }
    } catch {}
  `;
  exec(`powershell.exe -NoProfile -Command "${ps.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, () => {});
});

// Answer question — write selection to file, then focus terminal and send keystroke
let lastQuestionSession = null;
ipcMain.on('answer-question', (event, idx) => {
  // Read the current status to get session info
  try {
    const statusRaw = fs.readFileSync(STATUS_FILE, 'utf-8');
    const status = JSON.parse(statusRaw);
    // Write answer file for potential future API use
    const answerFile = path.join(CLAUDE_DIR, 'island-answer.json');
    fs.writeFileSync(answerFile, JSON.stringify({ index: idx, timestamp: Date.now() }));
  } catch (e) {}

  // Find the active Claude session and focus its terminal, then send the number key
  const sessions = readSessions();
  checkAliveSessions(sessions, (alive) => {
    if (alive.length > 0) {
      const pid = alive[0].pid;
      // Focus terminal then send keystroke (idx+1 for 1-based option number, then Enter)
      const keyNum = idx + 1;
      const ps = `
        Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        public class WinAPI {
          [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
          [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
        }
"@
        Add-Type -AssemblyName System.Windows.Forms
        try {
          $proc = Get-Process -Id ${pid} -ErrorAction Stop
          $hwnd = $proc.MainWindowHandle
          if ($hwnd -eq [IntPtr]::Zero) {
            $parent = (Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").ParentProcessId
            if ($parent) {
              $pproc = Get-Process -Id $parent -ErrorAction Stop
              $hwnd = $pproc.MainWindowHandle
            }
          }
          if ($hwnd -ne [IntPtr]::Zero) {
            [WinAPI]::ShowWindow($hwnd, 9)
            [WinAPI]::SetForegroundWindow($hwnd)
            Start-Sleep -Milliseconds 200
            [System.Windows.Forms.SendKeys]::SendWait('${keyNum}')
            Start-Sleep -Milliseconds 100
            [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
          }
        } catch {}
      `;
      exec(`powershell.exe -NoProfile -Command "${ps.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, () => {});
    }
  });
});
