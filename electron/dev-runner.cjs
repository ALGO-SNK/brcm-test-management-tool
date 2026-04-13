const { spawn } = require('node:child_process');
const http = require('node:http');

const HOST = '127.0.0.1';
const PORT = 5173;
const DEV_URL = `http://${HOST}:${PORT}`;
const isWin = process.platform === 'win32';

function run(command, args, extra = {}) {
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 30000) {
  const end = Date.now() + timeoutMs;

  while (Date.now() < end) {
    const ready = await new Promise((resolve) => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve((res.statusCode || 0) < 500);
      });

      req.on('error', () => resolve(false));
      req.setTimeout(1500, () => {
        req.destroy();
        resolve(false);
      });
    });

    if (ready) return;
    await sleep(400);
  }

  throw new Error(`Timed out waiting for Vite dev server at ${url}`);
}

const vite = run('npx', ['vite', '--host', HOST, '--port', String(PORT)]);
let electron = null;
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (electron && !electron.killed) electron.kill();
  if (!vite.killed) vite.kill();
  process.exit(code);
}

vite.on('exit', (code) => {
  if (!shuttingDown) shutdown(code || 0);
});

(async () => {
  try {
    await waitForServer(DEV_URL);

    electron = run('npx', ['electron', '.'], {
      env: {
        ...process.env,
        ELECTRON_RENDERER_URL: DEV_URL,
      },
    });

    electron.on('exit', (code) => shutdown(code || 0));
  } catch (error) {
    console.error(error.message || error);
    shutdown(1);
  }
})();

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
