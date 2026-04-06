const fs = require('fs');
const path = require('path');

const STATUS_FILE = path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'island-status.json');

let input = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const tool = data.tool_name || data.tool || 'unknown';
    const status = {
      tool: tool,
      timestamp: Date.now(),
    };

    const labels = {
      'Read': 'Reading...',
      'Write': 'Writing...',
      'Edit': 'Editing...',
      'Bash': 'Running...',
      'Glob': 'Searching...',
      'Grep': 'Searching...',
      'WebFetch': 'Fetching...',
      'WebSearch': 'Searching...',
      'Agent': 'Thinking...',
      'AskUserQuestion': 'Waiting for input...',
      'TaskCreate': 'New task',
      'TaskUpdate': 'Task updated',
    };
    status.label = labels[tool] || 'Working...';
    status.needsInput = (tool === 'AskUserQuestion');

    fs.writeFileSync(STATUS_FILE, JSON.stringify(status));
  } catch (e) {}
});
