const net = require('net');

const QUESTION_PORT = 47523;

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

    // Fire-and-forget: send question to Island, then exit 0 so terminal shows it too
    const socket = net.createConnection({ port: QUESTION_PORT, host: '127.0.0.1' }, () => {
      socket.write(JSON.stringify({
        session_id: sessionId,
        questions: questions,
        timestamp: Date.now()
      }) + '\n');
      // Don't wait for response — exit immediately so terminal shows the question
      socket.end();
      process.exit(0);
    });

    // If Island isn't running, just let terminal handle it
    socket.on('error', () => {
      process.exit(0);
    });

    // Safety timeout — don't hang if connection is slow
    socket.setTimeout(2000);
    socket.on('timeout', () => {
      socket.destroy();
      process.exit(0);
    });
  } catch (e) {
    process.exit(0);
  }
});
