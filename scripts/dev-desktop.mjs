import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';

const children = new Map();
let shuttingDown = false;

function resolveNpmCommand() {
  return isWindows ? 'npm.cmd' : 'npm';
}

function resolveTauriCommand() {
  return isWindows ? 'tauri.cmd' : 'tauri';
}

function shouldUseShell(command) {
  return isWindows && /\.(cmd|bat)$/i.test(command);
}

async function ensureCargoPath(env) {
  const cargoBin = path.join(os.homedir(), '.cargo', 'bin');
  const cargoExecutable = path.join(cargoBin, isWindows ? 'cargo.exe' : 'cargo');

  try {
    await access(cargoExecutable);
  } catch {
    return env;
  }

  const currentPath = env.PATH ?? '';
  if (currentPath.split(path.delimiter).includes(cargoBin)) {
    return env;
  }

  return {
    ...env,
    PATH: `${cargoBin}${path.delimiter}${currentPath}`,
  };
}

function startProcess(name, command, args, extra = {}) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: shouldUseShell(command),
    detached: !isWindows,
    ...extra,
  });

  children.set(name, child);
  child.on('error', (error) => {
    children.delete(name);
    if (shuttingDown) {
      return;
    }

    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[${name}] failed to start: ${detail}`);
    void shutdown(1);
  });

  child.on('exit', (code, signal) => {
    children.delete(name);
    if (shuttingDown) {
      return;
    }

    const detail = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.error(`[${name}] exited with ${detail}`);
    void shutdown(code ?? 1);
  });

  return child;
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.killed) {
    return;
  }

  if (isWindows) {
    const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    await new Promise((resolve) => killer.on('exit', resolve));
    return;
  }

  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    try {
      child.kill('SIGTERM');
    } catch {
      return;
    }
  }
}

async function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok || response.status < 500) {
        return;
      }
    } catch {
      // keep waiting
    }
    await delay(500);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function isServerReady(url) {
  try {
    const response = await fetch(url, { method: 'GET' });
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  const running = [...children.values()];
  await Promise.all(running.map((child) => stopProcess(child)));
  process.exit(exitCode);
}

process.on('SIGINT', () => {
  void shutdown(0);
});

process.on('SIGTERM', () => {
  void shutdown(0);
});

async function main() {
  const npmCommand = resolveNpmCommand();
  const tauriCommand = resolveTauriCommand();
  const env = await ensureCargoPath({ ...process.env });
  const webUrl = 'http://127.0.0.1:5183/?platform=desktop';

  if (await isServerReady(webUrl)) {
    console.log('[dev] reusing existing web frontend on http://127.0.0.1:5183');
  } else {
    console.log('[dev] starting web frontend on http://127.0.0.1:5183');
    startProcess(
      'web',
      npmCommand,
      ['--prefix', 'web', 'run', 'dev', '--', '--host', '127.0.0.1', '--strictPort'],
      {
        env,
      },
    );

    await waitForServer(webUrl);
  }

  console.log('[dev] starting tauri desktop');
  startProcess('tauri', tauriCommand, ['dev'], {
    env,
  });
}

main().catch(async (error) => {
  console.error(`[dev] ${error instanceof Error ? error.message : String(error)}`);
  await shutdown(1);
});
