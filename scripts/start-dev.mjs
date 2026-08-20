#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, spawnSync } from 'child_process';
import { createServer } from 'net';
import http from 'http';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PORT = Number(process.env.SHAB_DEV_PORT || '5173');
const DEFAULT_HOST = process.env.SHAB_DEV_HOST || '0.0.0.0';
const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
const ENV_FILES = ['.env', '.env.local', '.env.development', '.env.development.local'];
const KEY_FILES = ['package.json', 'tsconfig.json', 'vite.config.ts', 'src/main.tsx'];

const argv = process.argv.slice(2);
let mode = 'start';
let port = DEFAULT_PORT;
let host = DEFAULT_HOST;
const extraViteArgs = [];

for (let index = 0; index < argv.length; index += 1) {
  const arg = argv[index];

  if (arg === '--check') {
    mode = 'check';
    continue;
  }

  if (arg === '--clean') {
    mode = 'clean';
    continue;
  }

  if (arg === '--health') {
    mode = 'health';
    continue;
  }

  if (arg === '--start') {
    mode = 'start';
    continue;
  }

  if (arg === '--help' || arg === '-h') {
    mode = 'help';
    continue;
  }

  if (arg.startsWith('--port=')) {
    port = Number(arg.split('=')[1]);
    continue;
  }

  if (arg === '--port') {
    const next = argv[index + 1];
    if (next) {
      port = Number(next);
      index += 1;
    }
    continue;
  }

  if (arg.startsWith('--host=')) {
    host = arg.split('=')[1];
    continue;
  }

  if (arg === '--host') {
    const next = argv[index + 1];
    if (next) {
      host = next;
      index += 1;
    }
    continue;
  }

  extraViteArgs.push(arg);
}

function log(...values) {
  console.log('[dev]', ...values);
}

function logError(...values) {
  console.error('[dev]', ...values);
}

function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content.split(/\r?\n/).reduce((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return acc;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) {
      return acc;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (value.startsWith("\"") && value.endsWith("\"")) {
      value = value.slice(1, -1);
    }

    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }

    if (key.length > 0) {
      acc[key] = value;
    }

    return acc;
  }, {});
}

function loadEnvFiles() {
  return ENV_FILES.reduce((acc, name) => {
    const candidate = path.join(ROOT, name);
    if (!fs.existsSync(candidate)) {
      return acc;
    }

    return {
      ...acc,
      ...parseEnvFile(candidate),
    };
  }, {});
}

function getEnvValue(key, envFileValues) {
  return process.env[key] ?? envFileValues[key] ?? '';
}

function fail(message) {
  logError(message);
  process.exit(1);
}

function checkNodeModules() {
  const nodeModulesPath = path.join(ROOT, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    fail('node_modules is missing. Run npm install before starting the app.');
  }
}

function checkKeyFiles() {
  const missing = KEY_FILES.filter((fileName) => {
    return !fs.existsSync(path.join(ROOT, fileName));
  });

  if (missing.length > 0) {
    fail(`Missing required project files: ${missing.join(', ')}.`);
  }
}

function checkRequiredEnv(envFileValues) {
  const missing = REQUIRED_ENV.filter((key) => {
    const value = getEnvValue(key, envFileValues);
    return !value;
  });

  if (missing.length > 0) {
    fail(`Missing required environment variables: ${missing.join(', ')}. Add them to a local env file or export them in your shell.`);
  }
}

function isPortInUse(portToCheck) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close(() => resolve(false));
    });
    server.listen(portToCheck, '127.0.0.1');
  });
}

function httpHealthCheck(portToCheck) {
  return new Promise((resolve) => {
    const request = http.get(
      {
        hostname: '127.0.0.1',
        port: portToCheck,
        path: '/',
        timeout: 2000,
      },
      (response) => {
        response.destroy();
        resolve(true);
      },
    );

    request.on('error', () => resolve(false));
    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
  });
}

function identifyPortProcess(portToCheck) {
  if (!['linux', 'darwin'].includes(process.platform)) {
    return null;
  }

  const lsofResult = spawnSync('lsof', ['-nP', `-iTCP:${portToCheck}`, '-sTCP:LISTEN', '-Fp'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  if (lsofResult.status !== 0 || !lsofResult.stdout) {
    return null;
  }

  const pids = lsofResult.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(1));

  if (pids.length === 0) {
    return null;
  }

  const pid = pids[0];
  const psResult = spawnSync('ps', ['-p', pid, '-o', 'pid=', '-o', 'comm=', '-o', 'args='], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  if (psResult.status !== 0 || !psResult.stdout) {
    return null;
  }

  const [pidValue, command, ...argsParts] = psResult.stdout.trim().split(/\s+/);
  const args = argsParts.join(' ');
  let cwd = null;

  if (process.platform === 'linux') {
    const cwdPath = path.join('/proc', pid, 'cwd');
    try {
      cwd = fs.realpathSync(cwdPath);
    } catch {
      cwd = null;
    }
  }

  return {
    pid: Number(pidValue),
    command,
    args,
    cwd,
  };
}

function describeProcess(info) {
  if (!info) {
    return 'unknown process';
  }

  const cwdPart = info.cwd ? ` cwd=${info.cwd}` : '';
  return `PID ${info.pid}: ${info.command} ${info.args}${cwdPart}`;
}

function isViteProcess(info) {
  if (!info) {
    return false;
  }

  const command = `${info.command} ${info.args}`.toLowerCase();
  return command.includes('vite') || command.includes('vite.config') || command.includes('esbuild');
}

function isSameWorkspaceProcess(info) {
  if (!info?.cwd) {
    return false;
  }

  return path.resolve(info.cwd) === ROOT;
}

function runNpmCommand(args) {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const proc = spawn(npmCommand, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  proc.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 0);
    }
  });

  process.on('SIGINT', () => {
    proc.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    proc.kill('SIGTERM');
  });
}

function startViteServer(hostToUse, portToUse, viteArgs) {
  log(`Starting Vite dev server on http://${hostToUse}:${portToUse}`);

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const fullArgs = ['exec', 'vite', '--', '--host', hostToUse, '--port', String(portToUse), '--strictPort', ...viteArgs];

  const child = spawn(npmCommand, fullArgs, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  const signaled = {
    SIGINT: false,
    SIGTERM: false,
  };

  const cleanup = (signal) => {
    if (!child.killed) {
      log(`Stopping Vite server (${signal})...`);
      child.kill(signal);
      signaled[signal] = true;
    }
  };

  process.on('SIGINT', () => cleanup('SIGINT'));
  process.on('SIGTERM', () => cleanup('SIGTERM'));

  child.on('exit', (code, signal) => {
    if (signal && !signaled[signal]) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 0);
    }
  });

  child.on('error', (err) => {
    logError('Unable to start Vite:', err.message);
    process.exit(1);
  });
}

function killProcess(pid) {
  try {
    process.kill(pid, 'SIGTERM');
  } catch (error) {
    logError(`Unable to stop PID ${pid}: ${error.message}`);
    return false;
  }
  return true;
}

async function runCheck() {
  const envFileValues = loadEnvFiles();
  checkNodeModules();
  checkKeyFiles();
  checkRequiredEnv(envFileValues);

  const portInUse = await isPortInUse(port);
  if (!portInUse) {
    log(`Port ${port} is available.`);
    return;
  }

  const processInfo = identifyPortProcess(port);
  if (!processInfo) {
    fail(`Port ${port} is in use by an unknown process. Use npm run dev:clean if you want to remove a stale listener.`);
  }

  if (!isViteProcess(processInfo)) {
    fail(`Port ${port} is in use by a non-Vite process: ${describeProcess(processInfo)}.`);
  }

  log(`Port ${port} is occupied by a Vite process: ${describeProcess(processInfo)}.`);
}

async function runHealth() {
  const envFileValues = loadEnvFiles();
  checkNodeModules();
  checkKeyFiles();
  checkRequiredEnv(envFileValues);

  log('Running TypeScript build...');
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCommand, ['run', 'build'], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    fail('npm run build failed. Resolve build errors before continuing.');
  }

  const portInUse = await isPortInUse(port);
  if (!portInUse) {
    fail(
      `Health check failed: the app is not running on port ${port}. Run npm run dev.`,
    );
  }

  const processInfo = identifyPortProcess(port);
  if (!processInfo) {
    fail(`Health check failed: port ${port} is occupied by an unknown process.`);
  }

  if (!isViteProcess(processInfo)) {
    fail(`Health check failed: port ${port} is occupied by a non-Vite process: ${describeProcess(processInfo)}.`);
  }

  const healthy = await httpHealthCheck(port);
  if (!healthy) {
    fail(`Health check failed: Vite is listening on port ${port}, but the server did not respond.`);
  }

  log(`Health check passed. Vite server is running and responding on port ${port}.`);
}

async function runClean() {
  const portInUse = await isPortInUse(port);
  if (!portInUse) {
    log(`Port ${port} is free. No stale server found.`);
    return;
  }

  const processInfo = identifyPortProcess(port);
  if (!processInfo) {
    fail(`Port ${port} is in use by an unknown process. Manually inspect the listener before cleaning.`);
  }

  if (!isViteProcess(processInfo)) {
    fail(`Port ${port} is in use by a non-Vite process: ${describeProcess(processInfo)}. Do not stop it automatically.`);
  }

  if (!isSameWorkspaceProcess(processInfo)) {
    fail(`Port ${port} is in use by a Vite process that is not from this workspace: ${describeProcess(processInfo)}.`);
  }

  log(`Stopping stale Vite process: ${describeProcess(processInfo)}`);
  if (!killProcess(processInfo.pid)) {
    fail(`Failed to stop PID ${processInfo.pid}.`);
  }

  const start = Date.now();
  while (Date.now() - start < 5000) {
    const stillInUse = await isPortInUse(port);
    if (!stillInUse) {
      log(`Stopped stale Vite process and freed port ${port}.`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  fail(`Unable to free port ${port} after stopping PID ${processInfo.pid}.`);
}

async function runStart() {
  const envFileValues = loadEnvFiles();
  checkNodeModules();
  checkKeyFiles();
  checkRequiredEnv(envFileValues);

  const portInUse = await isPortInUse(port);
  if (!portInUse) {
    startViteServer(host, port, extraViteArgs);
    return;
  }

  const processInfo = identifyPortProcess(port);
  if (processInfo && isViteProcess(processInfo) && isSameWorkspaceProcess(processInfo)) {
    const healthy = await httpHealthCheck(port);
    if (healthy) {
      log(`A Vite dev server is already running on port ${port}. No duplicate server started.`);
      return;
    }

    log(`Found an unhealthy Vite server on port ${port}. Stopping stale process and restarting.`);
    if (!killProcess(processInfo.pid)) {
      fail(`Unable to stop stale Vite process PID ${processInfo.pid}.`);
    }

    const start = Date.now();
    while (Date.now() - start < 5000) {
      const stillInUse = await isPortInUse(port);
      if (!stillInUse) {
        startViteServer(host, port, extraViteArgs);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    fail(`Port ${port} remained busy after stopping PID ${processInfo.pid}.`);
  }

  if (processInfo) {
    fail(`Port ${port} is already in use by another process: ${describeProcess(processInfo)}. Use npm run dev:clean if you want to stop it.`);
  }

  fail(`Port ${port} is already in use and the occupying process could not be identified.`);
}

function printHelp() {
  console.log(`Usage: node scripts/start-dev.mjs [options]

Options:
  --start          Start the Vite dev server (default)
  --check          Verify env, key files, and port availability
  --clean          Stop a stale Vite server on port ${DEFAULT_PORT}
  --health         Run build and verify the project health
  --host <host>    Dev server host (default: ${DEFAULT_HOST})
  --port <port>    Dev server port (default: ${DEFAULT_PORT})
  --help, -h       Show this help message

Examples:
  npm run dev
  npm run dev -- --port 5173
  npm run dev:check
  npm run dev:clean
  npm run healthcheck
`);
}

async function main() {
  if (mode === 'help') {
    printHelp();
    return;
  }

  if (mode === 'check') {
    await runCheck();
    return;
  }

  if (mode === 'health') {
    await runHealth();
    return;
  }

  if (mode === 'clean') {
    await runClean();
    return;
  }

  await runStart();
}

main().catch((error) => {
  logError('Unexpected error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
