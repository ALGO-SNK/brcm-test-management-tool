const { spawn } = require('child_process');
const http = require('http');

const DEV_SERVER_URL = 'http://127.0.0.1:5173';
const isWin = process.platform === 'win32';

function spawnCommand(command, args, extra = {}) {
  if (isWin) {
    return spawn('cmd.exe', ['/c', command, ...args], {
      stdio: 'inherit',
      env: process.env,
      ...extra,
    });
  }

  return spawn(command, args, {
    stdio: 'inherit',
    env: process.env,
    ...extra,
  });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await new Promise(resolve => {
      const req = http.get(url, res => {
        res.resume();
        resolve(res.statusCode && res.statusCode < 500);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(1500, () => {
        req.destroy();
        resolve(false);
      });
    });
    if (ready) return;
    await wait(400);
  }
  throw new Error(`Timed out waiting for dev server at ${url}`);
}

const vite = spawnCommand('npx', ['vite', '--host', '127.0.0.1', '--port', '5173']);

let electron = null;
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (electron && !electron.killed) electron.kill();
  if (!vite.killed) vite.kill();
  process.exit(code);
}

vite.on('exit', code => {
  if (!shuttingDown) shutdown(code || 0);
});

(async () => {
  try {
    await waitForServer(DEV_SERVER_URL);
    electron = spawnCommand('npx', ['electron', '.'], {
      env: {
        ...process.env,
        VITE_DEV_SERVER_URL: DEV_SERVER_URL,
        BCTPB_DEV: '1',
      },
    });
    electron.on('exit', code => shutdown(code || 0));
  } catch (error) {
    console.error(error.message || error);
    shutdown(1);
  }
})();

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
