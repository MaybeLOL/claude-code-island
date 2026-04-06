const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME || process.env.USERPROFILE;
const CLAUDE_DIR = path.join(HOME, '.claude');
const HOOKS_DIR = path.join(CLAUDE_DIR, 'hooks');
const SETTINGS_FILE = path.join(CLAUDE_DIR, 'settings.json');

// Ensure hooks directory exists
if (!fs.existsSync(HOOKS_DIR)) {
  fs.mkdirSync(HOOKS_DIR, { recursive: true });
}

// Copy hook files
const hooksSource = path.join(__dirname, 'hooks');
for (const file of ['island-status.js', 'island-ask.js']) {
  const src = path.join(hooksSource, file);
  const dst = path.join(HOOKS_DIR, file);
  fs.copyFileSync(src, dst);
  console.log('Installed: ' + dst);
}

// Update settings.json
let settings = {};
if (fs.existsSync(SETTINGS_FILE)) {
  try { settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')); } catch (e) {}
}

if (!settings.hooks) settings.hooks = {};
if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];

const statusHookPath = path.join(HOOKS_DIR, 'island-status.js').replace(/\\/g, '\\\\');
const askHookPath = path.join(HOOKS_DIR, 'island-ask.js').replace(/\\/g, '\\\\');

// Check if hooks already exist
const hasStatus = settings.hooks.PreToolUse.some(h =>
  h.hooks && h.hooks.some(hk => hk.command && hk.command.includes('island-status'))
);
const hasAsk = settings.hooks.PreToolUse.some(h =>
  h.matcher === 'AskUserQuestion' && h.hooks && h.hooks.some(hk => hk.command && hk.command.includes('island-ask'))
);

if (!hasStatus) {
  settings.hooks.PreToolUse.push({
    matcher: '*',
    hooks: [{
      type: 'command',
      command: 'node "' + statusHookPath + '"',
      timeout: 5
    }]
  });
  console.log('Added island-status hook to settings.json');
}

if (!hasAsk) {
  settings.hooks.PreToolUse.push({
    matcher: 'AskUserQuestion',
    hooks: [{
      type: 'command',
      command: 'node "' + askHookPath + '"',
      timeout: 130
    }]
  });
  console.log('Added island-ask hook to settings.json');
}

fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
console.log('\nSetup complete! Start the Island with: npm start');
