import { spawn, spawnSync } from 'node:child_process';
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

  const currentPath = env.PATH ?? '';
  if (currentPath.split(path.delimiter).includes(cargoBin)) {
    return env;
  }

  return {
    ...env,
    PATH: `${cargoBin}${path.delimiter}${currentPath}`,
  };
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
  const env = await ensureCargoPath({ ...process.env });
  const nodeCommand = await resolveNodeCommand(env);
  const runtimeEnv = {
    ...env,
    PRISM_NODE_PATH: nodeCommand,
  };
  const webInvocation = await resolveWebInvocation(runtimeEnv);
  const tauriInvocation = await resolveTauriInvocation(runtimeEnv);
  const webUrl = 'http://127.0.0.1:5283/?platform=desktop';

  if (await isServerReady(webUrl)) {
    console.log('[dev] reusing existing web frontend on http://127.0.0.1:5283');
  } else {
    console.log('[dev] starting web frontend on http://127.0.0.1:5283');
    startProcess(
      'web',
      {
        ...webInvocation,
        args: [
          ...webInvocation.args,
          '--host',
          '127.0.0.1',
          '--strictPort',
        ],
      },
      {
        env: runtimeEnv,
      },
    );

    await waitForServer(webUrl);
  }

  console.log('[dev] starting tauri desktop');
  startProcess(
    'tauri',
    {
      ...tauriInvocation,
      args: [...tauriInvocation.args, 'dev'],
    },
    {
      env: runtimeEnv,
    },
  );
}

main().catch(async (error) => {
  console.error(`[dev] ${error instanceof Error ? error.message : String(error)}`);
  await shutdown(1);
});
