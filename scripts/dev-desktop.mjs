import { spawn, spawnSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';
const defaultWebPort = Number(process.env.PRISM_WEB_DEV_PORT ?? 5284);
const webPortSearchLimit = 20;

const children = new Map();
const descendantCache = new Map();
let shuttingDown = false;

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getPathEnvKey(env) {
  if (!isWindows) {
    return 'PATH';
  }

  const keys = Object.keys(env).filter((key) => key.toLowerCase() === 'path');
  return keys.find((key) => (env[key] ?? '').length > 0) ?? keys[0] ?? 'Path';
}

function getPathEnv(env) {
  const key = getPathEnvKey(env);
  return env[key] ?? '';
}

function setPathEnv(env, value) {
  const key = getPathEnvKey(env);
  const next = {
    ...env,
    [key]: value,
  };

  if (isWindows) {
    for (const existingKey of Object.keys(next)) {
      if (existingKey !== key && existingKey.toLowerCase() === 'path') {
        delete next[existingKey];
      }
    }
  }

  return next;
}

function normalizePathEnv(env) {
  return setPathEnv(env, getPathEnv(env));
}

async function findOnPath(names, env) {
  const pathEntries = getPathEnv(env).split(path.delimiter).filter(Boolean);

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

async function resolveBunInvocation(env) {
  const fallback = await findOnPath(isWindows ? ['bun.exe', 'bun.cmd', 'bun'] : ['bun'], env);
  if (fallback) {
    return {
      command: fallback,
      args: [],
      shell: isWindows && /\.(cmd|bat)$/i.test(fallback),
    };
  }

  throw new Error('Bun executable was not found.');
}

async function resolveTauriInvocation(env) {
  const bunInvocation = await resolveBunInvocation(env);
  return {
    ...bunInvocation,
    args: [...bunInvocation.args, 'tauri'],
  };
}

async function resolveWebInvocation(env) {
  const bunInvocation = await resolveBunInvocation(env);
  return {
    ...bunInvocation,
    args: [...bunInvocation.args, 'run', '--filter', 'prism-web', 'dev', '--'],
  };
}

async function ensureCargoPath(env) {
  const cargoBin = path.join(os.homedir(), '.cargo', 'bin');
  const cargoExecutable = path.join(cargoBin, isWindows ? 'cargo.exe' : 'cargo');

  try {
    await access(cargoExecutable);
  } catch {
    return env;
  }

  const currentPath = getPathEnv(env);
  if (currentPath.split(path.delimiter).includes(cargoBin)) {
    return env;
  }

  return setPathEnv(env, `${cargoBin}${path.delimiter}${currentPath}`);
}

function startDescendantTracking(child) {
  if (!isWindows || !child?.pid) return;
  const rootPid = child.pid;
  const refresh = async () => {
    if (child.exitCode !== null || child.killed) return;
    try {
      const pids = await collectProcessTreeWindows(rootPid);
      descendantCache.set(rootPid, new Set(pids));
    } catch {
      // ignore transient wmic failure
    }
  };
  void refresh();
  const timer = setInterval(refresh, 3000);
  child.once('exit', () => {
    clearInterval(timer);
  });
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
  startDescendantTracking(child);
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
    if (isWindows && child.pid) {
      const cached = descendantCache.get(child.pid);
      if (cached && cached.size > 0) {
        void taskkillPids([...cached]);
      }
    }
    if (shuttingDown) {
      return;
    }

    const detail = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.error(`[${name}] exited with ${detail}`);
    void shutdown(code ?? 1);
  });

  return child;
}

async function collectProcessTreeWindows(rootPid) {
  const relations = await new Promise((resolve) => {
    const proc = spawn('wmic', ['process', 'get', 'ParentProcessId,ProcessId', '/FORMAT:VALUE'], {
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
    let output = '';
    proc.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    proc.on('error', () => resolve(new Map()));
    proc.on('exit', () => {
      const map = new Map();
      for (const block of output.split(/\r?\n\r?\n/)) {
        const ppidMatch = block.match(/ParentProcessId=(\d+)/);
        const pidMatch = block.match(/ProcessId=(\d+)/);
        if (!ppidMatch || !pidMatch) continue;
        const ppid = Number(ppidMatch[1]);
        const pid = Number(pidMatch[1]);
        if (!map.has(ppid)) map.set(ppid, []);
        map.get(ppid).push(pid);
      }
      resolve(map);
    });
  });

  const collected = new Set([rootPid]);
  const queue = [rootPid];
  while (queue.length > 0) {
    const pid = queue.shift();
    const kids = relations.get(pid) ?? [];
    for (const kid of kids) {
      if (!collected.has(kid)) {
        collected.add(kid);
        queue.push(kid);
      }
    }
  }
  return [...collected];
}

async function taskkillPids(pids) {
  if (pids.length === 0) return;
  const args = ['/F'];
  for (const pid of pids) {
    args.push('/PID', String(pid));
  }
  await new Promise((resolve) => {
    const killer = spawn('taskkill', args, {
      stdio: 'ignore',
      windowsHide: true,
    });
    killer.on('exit', resolve);
    killer.on('error', resolve);
  });
}

async function stopProcess(child) {
  if (!child) return;

  if (isWindows) {
    if (!child.pid) return;
    const live = await collectProcessTreeWindows(child.pid);
    const cached = descendantCache.get(child.pid) ?? new Set();
    const all = new Set([...live, ...cached, child.pid]);
    await taskkillPids([...all]);
    return;
  }

  if (child.exitCode !== null || child.killed) {
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

function webUrlForPort(port) {
  return `http://127.0.0.1:${port}/?platform=desktop`;
}

function appendAllowedOrigin(env, origin) {
  const existing = String(env.PRISM_ALLOWED_ORIGINS || '').trim();
  return {
    ...env,
    PRISM_ALLOWED_ORIGINS: existing ? `${existing},${origin}` : origin,
  };
}

async function fetchText(url, timeoutMs = 1500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function isPrismFrontendHtml(html) {
  return html.includes('<div id="root"></div>') && html.includes('/src/main.tsx');
}

async function isFrontendReady(url) {
  const html = await fetchText(url);
  return html !== null && isPrismFrontendHtml(html);
}

async function isPortAvailable(port) {
  return await new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function resolveWebEndpoint() {
  for (let offset = 0; offset < webPortSearchLimit; offset += 1) {
    const port = defaultWebPort + offset;
    const url = webUrlForPort(port);

    if (await isFrontendReady(url)) {
      return { port, url, reuse: true };
    }

    if (await isPortAvailable(port)) {
      return { port, url, reuse: false };
    }

    if (offset === 0) {
      console.warn(
        `[dev] port ${port} is occupied by another service; trying the next available port`,
      );
    }
  }

  throw new Error(
    `Could not find an available web frontend port from ${defaultWebPort} to ${
      defaultWebPort + webPortSearchLimit - 1
    }.`,
  );
}

async function waitForFrontend(url, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isFrontendReady(url)) {
      return;
    }
    await delay(500);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function killByImageName(imageName) {
  if (!isWindows) return;
  await new Promise((resolve) => {
    const killer = spawn('taskkill', ['/F', '/IM', imageName], {
      stdio: 'ignore',
      windowsHide: true,
    });
    killer.on('exit', resolve);
    killer.on('error', resolve);
  });
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log('[dev] shutting down...');

  const running = [...children.values()];
  await Promise.all(running.map((child) => stopProcess(child)));

  if (isWindows) {
    await killByImageName('prism_agent_desktop.exe');
  }

  process.exit(exitCode);
}

function emergencyKillSync() {
  if (!isWindows) return;
  try {
    spawnSync('taskkill', ['/F', '/IM', 'prism_agent_desktop.exe'], {
      stdio: 'ignore',
      windowsHide: true,
    });
  } catch {
    // best-effort
  }
}

process.on('SIGINT', () => {
  emergencyKillSync();
  void shutdown(0);
});

process.on('SIGTERM', () => {
  emergencyKillSync();
  void shutdown(0);
});

process.on('exit', () => {
  emergencyKillSync();
});

async function main() {
  const env = await ensureCargoPath(normalizePathEnv({ ...process.env }));
  const nodeCommand = await resolveNodeCommand(env);
  const runtimeEnv = {
    ...env,
    PRISM_NODE_PATH: nodeCommand,
  };
  const webInvocation = await resolveWebInvocation(runtimeEnv);
  const tauriInvocation = await resolveTauriInvocation(runtimeEnv);
  const webEndpoint = await resolveWebEndpoint();
  const webEndpointOrigin = new URL(webEndpoint.url).origin;

  if (webEndpoint.reuse) {
    console.log(`[dev] reusing existing web frontend on ${webEndpoint.url}`);
  } else {
    console.log(`[dev] starting web frontend on ${webEndpoint.url}`);
    startProcess(
      'web',
      {
        ...webInvocation,
        args: [
          ...webInvocation.args,
          '--host',
          '127.0.0.1',
          '--port',
          String(webEndpoint.port),
          '--strictPort',
        ],
      },
      {
        env: runtimeEnv,
      },
    );

    await waitForFrontend(webEndpoint.url);
  }

  console.log('[dev] starting tauri desktop');
  startProcess(
    'tauri',
    {
      ...tauriInvocation,
      args: [
        ...tauriInvocation.args,
        'dev',
        '--config',
        JSON.stringify({ build: { devUrl: webEndpoint.url } }),
      ],
    },
    {
      env: {
        ...appendAllowedOrigin(runtimeEnv, webEndpointOrigin),
        PRISM_DEV_PARENT_PID: String(process.pid),
      },
    },
  );
}

main().catch(async (error) => {
  console.error(`[dev] ${error instanceof Error ? error.message : String(error)}`);
  await shutdown(1);
});
