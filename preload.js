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
  onGhostState: (cb) => ipcRenderer.on('ghost-state', (_, state) => cb(state)),
  onToolStatus: (cb) => ipcRenderer.on('tool-status', (_, data) => cb(data)),
  onShowQuestion: (cb) => ipcRenderer.on('show-question', (_, data) => cb(data)),
  jumpToTerminal: (pid) => ipcRenderer.send('jump-to-terminal', pid),
  answerQuestion: (answer) => ipcRenderer.send('answer-question', answer)
});
