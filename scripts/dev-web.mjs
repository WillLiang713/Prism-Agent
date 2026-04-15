import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';
const children = new Map();
let shuttingDown = false;

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findOnPath(names, env) {
  const pathEntries = (env.PATH ?? '').split(path.delimiter).filter(Boolean);
  for (const directory of pathEntries) {
    for (const name of names) {
      const candidate = path.join(directory, name);
      if (await pathExists(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

async function resolveNodeCommand(env) {
  if (process.execPath && (await pathExists(process.execPath))) {
    return process.execPath;
  }

  const fallback = await findOnPath([isWindows ? 'node.exe' : 'node'], env);
  if (fallback) {
    return fallback;
  }

  throw new Error('Node.js executable was not found.');
}

async function resolveNpmInvocation(env) {
  const nodeCommand = await resolveNodeCommand(env);
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(nodeCommand), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return {
        command: nodeCommand,
        args: [candidate],
      };
    }
  }

  const fallback = await findOnPath(isWindows ? ['npm.cmd', 'npm.exe', 'npm'] : ['npm'], env);
  if (fallback) {
    return {
      command: fallback,
      args: [],
      shell: isWindows && /\.(cmd|bat)$/i.test(fallback),
    };
  }

  throw new Error('npm executable was not found.');
}

function startProcess(name, invocation, extra = {}) {
  const child = spawn(invocation.command, invocation.args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: invocation.shell ?? false,
    detached: !isWindows,
    ...extra,
  });

  children.set(name, child);
  child.on('error', (error) => {
    children.delete(name);
    if (shuttingDown) {
      return;
    }
    console.error(`[${name}] failed to start: ${error instanceof Error ? error.message : String(error)}`);
    void shutdown(1);
  });
  child.on('exit', (code, signal) => {
    children.delete(name);
    if (shuttingDown) {
      return;
    }
    console.error(`[${name}] exited with ${signal ? `signal ${signal}` : `code ${code ?? 0}`}`);
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

async function waitForServer(url, timeoutMs = 30000, headers = undefined) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET', headers });
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
  const env = { ...process.env };
  const npmInvocation = await resolveNpmInvocation(env);
  const authToken = randomBytes(24).toString('hex');
  const apiBase = 'http://127.0.0.1:33100';

  console.log('[dev:web] starting agent sidecar on http://127.0.0.1:33100');
  startProcess(
    'agent-sidecar',
    {
      ...npmInvocation,
      args: [
        ...npmInvocation.args,
        '--workspace',
        'agent-sidecar',
        'run',
        'dev',
        '--',
        '--transport=http',
        '--host',
        '127.0.0.1',
        '--port',
        '33100',
        '--token',
        authToken,
      ],
    },
    {
      env,
    },
  );

  await waitForServer(`${apiBase}/api/agent/health`, 30000, {
    Authorization: `Bearer ${authToken}`,
  });

  console.log('[dev:web] starting web frontend on http://127.0.0.1:5183');
  startProcess(
    'web',
    {
      ...npmInvocation,
      args: [...npmInvocation.args, '--prefix', 'web', 'run', 'dev', '--', '--host', '127.0.0.1', '--strictPort'],
    },
    {
      env: {
        ...env,
        VITE_PRISM_PLATFORM: 'web',
        VITE_PRISM_API_BASE: apiBase,
        VITE_PRISM_AUTH_TOKEN: authToken,
      },
    },
  );

  await waitForServer('http://127.0.0.1:5183/?platform=web');
}

main().catch(async (error) => {
  console.error(`[dev:web] ${error instanceof Error ? error.message : String(error)}`);
  await shutdown(1);
});
