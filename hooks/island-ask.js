const net = require('net');
const fs = require('fs');
const path = require('path');

const QUESTION_PORT = 47523;
const TIMEOUT = 120000;
const SETTINGS_FILE = path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'island-settings.json');

function getAnswerMode() {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    const settings = JSON.parse(raw);
    return settings.answerMode || 'island';
  } catch (e) {
    return 'island';
  }
}

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
    const mode = getAnswerMode();

    if (mode === 'terminal') {
      // Terminal mode: send question to Island as notification, exit 0 so terminal shows it
      const socket = net.createConnection({ port: QUESTION_PORT, host: '127.0.0.1' }, () => {
        socket.write(JSON.stringify({
          session_id: sessionId,
          questions: questions,
          timestamp: Date.now(),
          mode: 'notify'
        }) + '\n');
        socket.end();
        process.exit(0);
      });
      socket.on('error', () => { process.exit(0); });
      socket.setTimeout(2000);
      socket.on('timeout', () => { socket.destroy(); process.exit(0); });
      return;
    }

    // Island mode: block and wait for answer via TCP
    const socket = net.createConnection({ port: QUESTION_PORT, host: '127.0.0.1' }, () => {
      socket.write(JSON.stringify({
        session_id: sessionId,
        questions: questions,
        timestamp: Date.now(),
        mode: 'answer'
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
