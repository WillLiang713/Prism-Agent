import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { promisify } from 'node:util';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

import type {
  AppServerNotification,
  AppServerServerRequest,
  JsonRpcResponse,
} from './types.js';

const execFileAsync = promisify(execFile);
const APP_SERVER_INIT_TIMEOUT_MS = 10_000;
const APP_SERVER_REQUEST_TIMEOUT_MS = 15_000;

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

export interface AppServerClientOptions {
  onNotification: (notification: AppServerNotification) => void;
  onServerRequest: (request: AppServerServerRequest) => Promise<unknown>;
}

export class AppServerClient {
  private child: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private initialized: Promise<void>;

  constructor(private options: AppServerClientOptions) {
    this.child = spawn('codex', ['app-server', '--listen', 'stdio://'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    this.child.on('error', (error) => {
      this.rejectAllPending(formatSpawnError(error));
    });

    this.child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
    });

    this.child.on('exit', (code, signal) => {
      const error = new Error(`codex app-server exited (${code ?? 'null'}${signal ? `, ${signal}` : ''})`);
      this.rejectAllPending(error);
    });

    const rl = readline.createInterface({
      input: this.child.stdout,
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      void this.handleLine(line);
    });

    this.initialized = this.bootstrap();
  }

  async waitUntilReady() {
    await this.initialized;
  }

  async call<T>(method: string, params?: unknown): Promise<T> {
    await this.initialized;

    const id = this.nextId++;
    const payload = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    const response = this.createPendingRequest<T>(
      id,
      `等待 codex app-server 方法 ${method} 响应`,
      APP_SERVER_REQUEST_TIMEOUT_MS,
    );

    this.writeJson(payload, id);
    return response;
  }

  async codexVersion() {
    const { stdout } = await execFileAsync('codex', ['--version']);
    return stdout.trim();
  }

  isLoggedIn() {
    return existsSync(path.join(os.homedir(), '.codex', 'auth.json'));
  }

  async shutdown() {
    this.child.kill('SIGTERM');
  }

  private async bootstrap() {
    const initializeId = this.nextId++;
    const initialize = this.createPendingRequest<void>(
      initializeId,
      '等待 codex app-server initialize 完成',
      APP_SERVER_INIT_TIMEOUT_MS,
    );

    this.writeJson(
      {
        jsonrpc: '2.0',
        id: initializeId,
        method: 'initialize',
        params: {
          clientInfo: {
            name: 'prism-codex-sidecar',
            title: 'Prism Codex Sidecar',
            version: '0.1.0',
          },
          capabilities: {
            experimentalApi: true,
          },
        },
      },
      initializeId,
    );
    this.writeJson({ jsonrpc: '2.0', method: 'initialized' }, initializeId);

    await initialize;
  }

  private createPendingRequest<T>(id: number, label: string, timeoutMs: number) {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${label} 超时（${timeoutMs}ms）`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });
    });
  }

  private writeJson(payload: unknown, idForCleanup: number) {
    if (this.child.stdin.destroyed || !this.child.stdin.writable) {
      this.rejectPending(idForCleanup, new Error('codex app-server stdin 不可写'));
      return;
    }

    try {
      this.child.stdin.write(`${JSON.stringify(payload)}\n`);
    } catch (error) {
      this.rejectPending(
        idForCleanup,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  private rejectPending(id: number, error: Error) {
    const pending = this.pending.get(id);
    if (!pending) {
      return;
    }
    clearTimeout(pending.timeout);
    this.pending.delete(id);
    pending.reject(error);
  }

  private rejectAllPending(error: Error) {
    for (const [id, pending] of this.pending.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.pending.delete(id);
    }
  }

  private async handleLine(line: string) {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    const payload = JSON.parse(trimmed) as
      | JsonRpcResponse
      | AppServerNotification
      | AppServerServerRequest;

    if ('id' in payload && ('result' in payload || 'error' in payload) && !('method' in payload)) {
      const pending = this.pending.get(Number(payload.id));
      if (!pending) {
        return;
      }
      clearTimeout(pending.timeout);
      this.pending.delete(Number(payload.id));
      if (payload.error) {
        pending.reject(new Error(payload.error.message));
        return;
      }
      pending.resolve(payload.result);
      return;
    }

    if ('id' in payload && 'method' in payload && 'params' in payload) {
      const request = payload as unknown as AppServerServerRequest;
      try {
        const result = await this.options.onServerRequest(request);
        this.child.stdin.write(
          `${JSON.stringify({
            jsonrpc: '2.0',
            id: request.id,
            result,
          })}\n`,
        );
      } catch (error) {
        this.child.stdin.write(
          `${JSON.stringify({
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32000,
              message: error instanceof Error ? error.message : String(error),
            },
          })}\n`,
        );
      }
      return;
    }

    this.options.onNotification(payload as AppServerNotification);
  }
}

function formatSpawnError(error: NodeJS.ErrnoException) {
  if (error.code === 'ENOENT') {
    return new Error('未找到 codex 命令，Prism 无法启动后端。请确认已安装 Codex CLI，且桌面进程的 PATH 能访问到它。');
  }

  return new Error(`启动 codex app-server 失败: ${error.message}`);
}
