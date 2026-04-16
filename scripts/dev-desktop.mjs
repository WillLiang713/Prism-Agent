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

async function resolveTauriInvocation(env) {
  const nodeCommand = await resolveNodeCommand(env);
  const localCli = path.join(projectRoot, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');

  if (await pathExists(localCli)) {
    return {
      command: nodeCommand,
      args: [localCli],
    };
  }

  const fallback = await findOnPath(isWindows ? ['tauri.cmd', 'tauri.exe', 'tauri'] : ['tauri'], env);
  if (fallback) {
    return {
      command: fallback,
      args: [],
      shell: isWindows && /\.(cmd|bat)$/i.test(fallback),
    };
  }

  throw new Error('Tauri CLI was not found.');
}

async function resolveWebInvocation(env) {
  const nodeCommand = await resolveNodeCommand(env);
  const localCliCandidates = [
    path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
    path.join(projectRoot, 'web', 'node_modules', 'vite', 'bin', 'vite.js'),
  ];

  for (const candidate of localCliCandidates) {
    if (await pathExists(candidate)) {
      return {
        command: nodeCommand,
        args: [candidate],
      };
    }
  }

  return resolveNpmInvocation(env);
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
        cwd: path.join(projectRoot, 'web'),
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
