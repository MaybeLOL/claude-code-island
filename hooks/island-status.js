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
