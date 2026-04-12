import readline from 'node:readline';

import type { JsonRpcRequest, JsonRpcResponse } from './types.js';

export function createBridge(
  methods: Record<string, (params?: unknown) => Promise<unknown>>,
  emit: (payload: unknown) => void,
) {
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  rl.on('line', (line) => {
    void handleLine(line);
  });

  async function handleLine(line: string) {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    let message: JsonRpcRequest;
    try {
      message = JSON.parse(trimmed) as JsonRpcRequest;
    } catch (error) {
      write({
        jsonrpc: '2.0',
        id: 0,
        error: {
          code: -32700,
          message: `Invalid JSON: ${String(error)}`,
        },
      });
      return;
    }

    const handler = methods[message.method];
    if (!handler) {
      write({
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32601,
          message: `Method not found: ${message.method}`,
        },
      });
      return;
    }

    try {
      const result = await handler(message.params);
      write({
        jsonrpc: '2.0',
        id: message.id,
        result,
      });
    } catch (error) {
      write({
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  function write(response: JsonRpcResponse | unknown) {
    process.stdout.write(`${JSON.stringify(response)}\n`);
  }

  return {
    emit,
    write,
  };
}
