# 执行计划：把 Prism 后端链路切换为 Codex（Node sidecar + `@openai/codex-sdk`）

> 执行者：**gpt-5.4**
> 上下文：本计划取代之前草拟的 `docs/refactor-pi-coding-agent.md`（已在工作树中删除，请勿再引用）。
> **本计划只负责搭建一条全新的、基于 `@openai/codex-sdk` 的后端链路**，并让前端默认呈现「codex 已选中」的状态。
> **旧聊天链路（Python FastAPI + `usePrismChat`）一律不动**，等新链路跑通、Smoke 验收通过后，再作为**最后一步**统一删除。

---

## 0. 一句话目标

新建一个 **Node sidecar**，里面只做一件事——用 **`@openai/codex-sdk`** 跑 codex thread；Tauri Rust 负责 spawn / 杀 / 桥接 stdio；前端通过 Tauri `invoke` + `listen("codex://event")` 和 sidecar 通信；UI 在模型选择区固定显示并锁定为 `codex`。旧 Python 后端和旧聊天组件保持原样，作为安全网活到 M7，再一次性删除。

---

## 1. 为什么选这个架构（必读）

调研后发现直接用 `codex mcp-server` 方向是反的（那是把 codex 暴露成 MCP server 给别人消费）。正确的官方路径是 **`@openai/codex-sdk`**：OpenAI 官方 TypeScript SDK，内部自己 spawn `codex` CLI，用 JSONL over stdio 通信，并提供 `runStreamed()`、自动会话持久化（`~/.codex/sessions`）、`resumeThread(id)`、图片输入、结构化输出等能力。

底层还有个 `codex app-server` 子命令（JSON-RPC / JSONL），但它目前标记为 experimental、协议会变，SDK 是稳定的上层抽象——**本计划一律走 SDK，不直接对接 app-server**。

架构：

```
┌──────────────┐  Tauri invoke        ┌────────────────┐  stdio JSONL        ┌────────────────┐
│  React 前端  │ ───────────────────▶ │  Rust 桥接     │ ───────────────────▶ │ Node sidecar    │
│ (web/src)    │ ◀───────────────────  │ (src-tauri)    │ ◀───────────────────  │ @openai/codex-  │
└──────────────┘ tauri emit 事件       └────────────────┘  stdout/stderr       │ sdk             │
                                                                                │ ↓ spawns        │
                                                                                │  codex CLI      │
                                                                                └────────────────┘
```

Rust 侧不再自己解析 codex 的事件，只做「文本帧转运」；所有 codex 相关业务逻辑集中在 Node sidecar 的 TypeScript 代码里。

---

## 2. 现状速读（执行前必读）

- 仓库：`/home/liangmj/Projects/Prism`，分支 `refactor/frontend`
- 旧后端（将被绕开，保留到 M7）：
  - Python：`server.py`、`routes/*.py`（10 个）、`ai/**`、`tools.py`、`tools.json`、`config.py`、`requirements.txt`、`Dockerfile`、`docker-compose.yml`
  - Release 启动：`src-tauri/src/lib.rs::spawn_release_backend()` 拉 `prism-runtime.exe`
  - Debug 启动：开发者自己起 Python，Tauri 通过 `PRISM_DESKTOP_API_BASE`（默认 `http://127.0.0.1:33100`）指向
- 前端：React 19 + Vite 7 + TS 5 + Tailwind 3 + Zustand 5 + Radix UI
  - 聊天入口：`web/src/hooks/usePrismChat.ts`（`@ai-sdk/react` + HTTP，**不要动**）
  - 模型状态：`web/src/store/configStore.ts`、`web/src/lib/configOptions.ts`
  - 聊天 UI：`web/src/components/chat/{ChatInput,ChatPanel,MessageList,MessageBubble,ThinkingBlock}.tsx`（**不要动**）
  - 顶层：`web/src/App.tsx` → `web/src/components/layout/AppLayout.tsx`
- Tauri：`src-tauri/src/lib.rs` + `main.rs`，已依赖 `tauri-plugin-shell/dialog/fs/single-instance`
- 本机 `codex` CLI：`/home/liangmj/.nvm/versions/node/v22.19.0/bin/codex`
- Node：v22 via nvm；打包时用 **Node Single Executable Applications（SEA，Node ≥ 20 内建）** 或 `@yao-pkg/pkg` 生成单文件 sidecar

**重要**：工作树中 `docs/refactor-pi-coding-agent.md` 处于 `deleted` 状态但未提交；同时之前 `3582353` commit 引入的 `agent-sidecar/` 目录可能还在 HEAD 中。执行者在 M1 开始前运行 `ls /home/liangmj/Projects/Prism/agent-sidecar 2>/dev/null` 确认：若存在，**在 M1 commit 里顺便 `git rm -r agent-sidecar`**（这是本计划唯一允许连带删除的旧目录，因为新 sidecar 会占用同名位置）。

---

## 3. 设计原则（不能违反）

1. **并行落地，延后删除**。M0–M6 期间只新增文件；M7 才统一 `git rm` 旧代码。唯一允许原地 edit 的旧文件是 `web/src/App.tsx`（diff ≤ 10 行）和 `src-tauri/src/lib.rs`（diff ≤ 30 行）。
2. **所有 codex 业务逻辑都写在 Node sidecar（TS）里**。Rust 只做进程管理 + stdio 转运 + 事件广播，**不解析 codex 事件结构**。
3. **前端不直接 import `@openai/codex-sdk`**（它有 Node 依赖、在浏览器里跑不起来）。前端只通过 Tauri invoke / listen 和 sidecar 通信。
4. **UI 锁死在 codex**：provider 下拉写成禁用态 `<Select value="codex" disabled>`，加一个 `Backend: codex` badge。不提供切回旧 provider 的路径。
5. **审批拦截不能省**：即使 codex SDK 对某些命令标为 low-risk，Rust / sidecar 也要有一张硬白名单，白名单外一律走审批弹窗。
6. **不要顺手重构**。看起来可以顺便改的 CSS / 命名 / README 一律忍住。本计划的 diff 应该是「纯增量 + 最后一次集中删除」。

---

## 4. 目标目录结构

```
Prism/
├── agent-sidecar/                 # ★ 新增 / 重建。Node 项目，单一职责：跑 codex-sdk
│   ├── package.json               # 依赖 @openai/codex-sdk、commander、zod（可选）
│   ├── tsconfig.json              # "module":"ESNext","target":"ES2022","strict":true
│   ├── src/
│   │   ├── index.ts               # 入口；argv 解析（--stdio|--http, --prism-home）
│   │   ├── bridge.ts              # stdio JSON-RPC 2.0 (ndjson 分帧) + 方法路由
│   │   ├── sessions.ts            # sessionId ↔ thread 映射；请求级 AbortController
│   │   ├── approval.ts            # 危险命令白名单 + 待审批 Deferred 队列
│   │   ├── logging.ts             # pino → stderr（stderr 由 Rust 转发到 tauri::log）
│   │   └── types.ts               # RPC 入参 / 事件 / 审批 payload 类型
│   ├── scripts/
│   │   └── build-sea.mjs          # 产单文件：node --experimental-sea-config build-sea.json
│   └── dist/                      # tsc 产物 → build-sea 打包后 copy 到 src-tauri/binaries/
│
├── web/src/codex/                 # ★ 新增。前端 codex 专用模块，不 import 任何旧 chat 代码
│   ├── client.ts                  # 封装 invoke('codex_*') + listen('codex://event')
│   ├── sessionStore.ts            # Zustand：sessionId → messages / status / approvals
│   ├── useCodexChat.ts            # 替代 usePrismChat 的新 hook（纯新写，不继承）
│   ├── CodexChatPanel.tsx         # 替代 ChatPanel 的新容器
│   └── components/
│       ├── CodexChatInput.tsx     # 复制 ChatInput.tsx 改造，provider 下拉写死 codex
│       ├── CodexMessageList.tsx   # 复制 MessageList.tsx 改造，解耦旧 topicStore
│       ├── ToolCallCard.tsx       # 工具调用卡片
│       ├── ApprovalDialog.tsx     # Radix Dialog，允许一次 / 拒绝
│       └── CodexSessionList.tsx   # 面板内轻量侧栏（不污染旧 Sidebar.tsx）
│
├── src-tauri/src/
│   ├── lib.rs                     # 改：注册新 command；加 USE_CODEX_BACKEND_RUST 常量短路 spawn_release_backend
│   ├── codex_sidecar.rs           # ★ 新增：spawn Node sidecar、pipe stdio、JSON-RPC client
│   └── codex_rpc.rs               # ★ 新增：RequestId 映射、事件广播到 window
│
├── src-tauri/binaries/
│   └── prism-codex-sidecar-<triple>  # ★ 构建产物（Node SEA 单文件）
│
├── scripts/
│   ├── build-sidecar.mjs          # ★ 新增：pnpm -C agent-sidecar build → SEA → copy
│   └── dev-sidecar.mjs            # ★ 新增：tsx watch 启动，供 tauri dev 直接挂载
│
├── docs/
│   ├── plan-codex-backend.md      # 本文件
│   └── wsl-debug-workflow.md      # 已有
│
└── package.json                   # 改：workspaces = ["agent-sidecar", "web"]
```

---

## 5. IPC 协议

**前端 → Rust**（Tauri `#[tauri::command]`）：

| 命令 | 入参 | 返回 |
|---|---|---|
| `codex_health` | — | `{ sidecarVersion, codexVersion, loggedIn }` |
| `codex_start_session` | `{ workspaceRoot: string }` | `{ sessionId }` |
| `codex_resume_session` | `{ threadId: string, workspaceRoot: string }` | `{ sessionId }` |
| `codex_send_message` | `{ sessionId, text, images?: string[] }` | `{ requestId }` |
| `codex_cancel` | `{ requestId }` | `void` |
| `codex_respond_approval` | `{ approvalId, decision: "allow" \| "deny" }` | `void` |
| `codex_list_threads` | — | `ThreadMeta[]`（直接透传 sidecar 读 `~/.codex/sessions/`） |

**Rust → Node sidecar**（stdio JSON-RPC 2.0，ndjson）：和前面命令一一映射，方法名就叫 `startSession` / `sendMessage` / `cancel` / `respondApproval` / `health` / `listThreads` / `resumeSession`。Rust 只做 `requestId` 映射和透传，**不解析 payload**。

**Node sidecar → Rust → 前端**（通知，`app.emit("codex://event", payload)`）：

```ts
type CodexEvent =
  | { type: 'delta';            requestId; sessionId; kind: 'text'|'thinking'; text: string }
  | { type: 'tool_call';        requestId; sessionId; toolCallId; name: string; args: unknown }
  | { type: 'tool_result';      requestId; sessionId; toolCallId; ok: boolean; output: string }
  | { type: 'approval_request'; requestId; sessionId; approvalId; toolCallId; command: string; risk: 'low'|'high' }
  | { type: 'done';             requestId; sessionId; usage?: { input: number; output: number }; threadId: string }
  | { type: 'error';            requestId; sessionId; message: string };
```

Sidecar 内部把 `@openai/codex-sdk` 的 `runStreamed()` 产出的 `item.completed` / `turn.completed` 等结构转成上面这套 schema——这是 M0 必须验证的关键点，因为 SDK 的事件类型文档里没完全列出。

---

## 6. `@openai/codex-sdk` 使用要点

```ts
import { Codex } from "@openai/codex-sdk";

const codex = new Codex({
  env: { PATH: process.env.PATH! },             // 确保能找到 codex 二进制
  config: { show_raw_agent_reasoning: true },   // 拿到 thinking 增量
});

const thread = codex.startThread({
  workingDirectory: workspaceRoot,
  skipGitRepoCheck: true,
});

const { events, threadId } = await thread.runStreamed("用户输入");
for await (const ev of events) {
  // ev.type: "item.started" | "item.updated" | "item.completed" | "turn.completed" | ...
  // 转成 CodexEvent 广播
}
```

M0 要落实的细节：
1. 事件 schema 的完整列表（`item.*` 有哪些子类；`turn.completed` 的 usage 形状）
2. **取消**：是否存在 `thread.cancel()` / `AbortSignal` 支持？若 SDK 不暴露，则在 sidecar 里记下 SDK 正在写的子进程 PID，cancel 时 `process.kill(pid, 'SIGINT')` 兜底
3. **审批**：SDK 是否有 `onToolRequest` / `approvalHandler` 回调？若没有，降级方案是在 `codex` 的 config.toml 里把 `approval_policy` 强制为 `"on-request"` 并让 `--ask-for-approval` 事件冒泡到 sidecar
4. `resumeThread(id)` 的错误行为（thread 不存在时抛什么）
5. 图片输入的本地路径形式：`{ type: "local_image", path }`

所有结论写进第 11 节 Scratchpad。

---

## 7. 里程碑（按顺序执行）

每个里程碑结束都是一个独立 commit，message 中文、`feat(codex):` / `refactor(codex):` / `chore(codex):` 开头。任意里程碑失败立即停手，body 写 `BLOCKED: <原因>`。

### M0 — 预验证（不写生产代码，只写 spike）
1. `which codex && codex --version` 通过；确认 `~/.codex/auth.json` 存在（没登录就停手）
2. 临时目录 `mkdir /tmp/codex-spike && cd /tmp/codex-spike && npm init -y && npm i @openai/codex-sdk`
3. 写一个 `spike.mjs`：
   ```js
   import { Codex } from "@openai/codex-sdk";
   const codex = new Codex();
   const thread = codex.startThread({ workingDirectory: process.cwd(), skipGitRepoCheck: true });
   const { events, threadId } = await thread.runStreamed("在当前目录创建 hello.txt 写入 hi");
   for await (const ev of events) console.log(JSON.stringify(ev));
   console.log("threadId", threadId);
   ```
4. 跑 `node spike.mjs`，把前 30 行事件输出 + `threadId` 贴进第 11 节
5. 打开 `node_modules/@openai/codex-sdk/dist/**/*.d.ts`，抄出 `runStreamed` 返回类型、事件 union、`startThread` / `resumeThread` 选项，全部贴进第 11 节
6. 在 `spike.mjs` 里试 `thread.runStreamed(...)` 过程中 `process.exit(0)` 前主动 `ac.abort()` 或调用 SDK 的 cancel API，记录实际行为
7. 试一次破坏性命令（`rm /tmp/codex-spike/hello.txt`），看是否触发 approval 事件，记录 SDK 的审批事件形状

**验收**：第 11 节 Scratchpad 写满；产 commit `docs(codex): M0 预验证结论`，只动本文件。若第 5–7 步有任何一项 SDK 能力缺失且无兜底方案，写 `BLOCKED:` 停手。

### M1 — Node sidecar 骨架（可独立 run，不接 Tauri）
- `pnpm-workspace.yaml` 加 `agent-sidecar`；根 `package.json` 追加 workspaces 配置（若旧 `agent-sidecar/` 存在，先 `git rm -r agent-sidecar` 再重建）
- 新建 `agent-sidecar/{package.json, tsconfig.json, src/index.ts, src/bridge.ts}`
- 依赖：`@openai/codex-sdk`、`zod`（可选校验）；devDeps：`typescript`、`tsx`、`@types/node`
- `src/bridge.ts` 实现 ndjson 分帧的 JSON-RPC 2.0 server：读 stdin 行 → 解析 → `methods[method]?.(params)` → 回写 result / error
- 实现一个 `health` 方法：返回 `{ sidecarVersion, codexVersion: await execCodexVersion(), loggedIn: fs.existsSync(~/.codex/auth.json) }`
- `pnpm -C agent-sidecar dev` 用 `tsx src/index.ts --stdio` 启动，手动 `echo '{"jsonrpc":"2.0","id":1,"method":"health"}' | pnpm -C agent-sidecar dev` 应该回 `{"jsonrpc":"2.0","id":1,"result":{...}}`

**验收**：手动 stdio 测试通过；commit `feat(codex): Node sidecar 骨架 + health 方法`。

### M2 — Rust 桥接 + health 打通到前端 console
- 新增 `src-tauri/src/codex_sidecar.rs`：
  - `pub struct CodexBridge { child: tokio::process::Child, stdin_tx: mpsc::Sender<String>, pending: Mutex<HashMap<u64, oneshot::Sender<Value>>> }`
  - `pub async fn spawn(app: &AppHandle) -> Result<Self, String>`：
    - dev 模式：`tsx agent-sidecar/src/index.ts --stdio`（通过 `scripts/dev-sidecar.mjs` 或直接 `npx tsx`）
    - release 模式：`tauri_plugin_shell::ShellExt::sidecar("prism-codex-sidecar")`
  - 启动后台 task：读 stdout 行 → JSON 解析 → 若有 `id` 则 match `pending`，否则当作通知 `app.emit("codex://event", payload)`
- 新增 `src-tauri/src/codex_rpc.rs`：封装 `call(method, params) -> Result<Value>`，自增 id
- `lib.rs`：
  - 加常量 `const USE_CODEX_BACKEND_RUST: bool = true;`
  - 在 `prepare_runtime()` 最前面：`if USE_CODEX_BACKEND_RUST { return empty_runtime() }` —— 彻底跳过 `spawn_release_backend()`
  - `setup` 里 spawn `CodexBridge`，塞进 `tauri::State`
  - `invoke_handler![...]` 追加 `codex_health`；目前只实现这一个命令，其它先返回 `Err("not implemented")`
- `Cargo.toml` 追加：`tokio = { version = "1", features = ["full"] }`、`serde_json`
- 前端 `web/src/codex/client.ts`：极简 `codexHealth()` 调 `invoke("codex_health")`
- `web/src/App.tsx` 加一行 `useEffect(() => { codexHealth().then(console.log) }, [])`（**唯一一次** 原地 edit，diff ≤ 5 行）

**验收**：`pnpm tauri dev` 启动后浏览器 console 打印出 `{sidecarVersion, codexVersion, loggedIn: true}`；commit `feat(codex): Tauri 桥接 sidecar 并打通 health`。

### M3 — 双向流式消息（文本 only，无工具、无审批）
- Sidecar：实现 `startSession` / `sendMessage` / `cancel`
  - `sessions.ts`：Map<sessionId, { thread, currentAbort?: AbortController }>
  - `sendMessage` 内部 `await thread.runStreamed(text, { signal })`，遍历事件→转成 `delta`/`done`/`error` 广播
  - `cancel` 调用对应 session 的 `AbortController.abort()` + 兜底 `process.kill` codex 子进程
- Rust：实现 `codex_start_session` / `codex_send_message` / `codex_cancel` 命令，纯透传
- 前端：
  - `sessionStore.ts`：Zustand，按 `sessionId` 存消息数组 + 流状态
  - `useCodexChat.ts`：封装「发送 → 监听 delta → 拼消息」
  - `CodexChatPanel.tsx`：极简 UI，一个 textarea + 发送按钮 + 消息 `<pre>` 渲染（样式 M5 再抛光）
  - `App.tsx` 顶加 `const USE_CODEX_BACKEND = true`，`true` 渲染 `CodexChatPanel`，`false` 渲染旧 `ChatPanel`（默认 true）

**验收**：WSLg 下 `pnpm tauri dev` 发送「你好」看到打字机流；取消按钮能中断；commit `feat(codex): 最小流式闭环`。

### M4 — 工具调用可视化 + 审批拦截
- Sidecar `approval.ts`：
  - 硬白名单（**即使 SDK 说 low-risk 也要强制人工确认**）：`rm -rf` / `sudo` / `curl ... | sh` / `git push --force` / 写路径超出 workspaceRoot / 读 `~/.ssh` `~/.aws` `~/.codex/auth.json`
  - 机制：收到 SDK 的 tool 审批事件时生成 `approvalId`，广播 `approval_request` 通知，`await new Promise` 挂起；前端回 `respondApproval` 后 resolve，把用户决定回喂给 SDK
- Rust：实现 `codex_respond_approval` 透传
- 前端：`ApprovalDialog.tsx`（Radix Dialog，Esc = deny）+ `ToolCallCard.tsx`；在 `useCodexChat` 里监听 `approval_request` 事件挂起 UI

**验收**：让 codex 执行 `echo hi > /tmp/prism-test.txt`，弹窗 → 允许 → 文件真的写出；重试时拒绝 → codex 收到错误并自适应；commit `feat(codex): 工具调用与审批弹窗`。

### M5 — UI 复刻 + 模型选择锁定
- 复制 `web/src/components/chat/ChatInput.tsx` 到 `web/src/codex/components/CodexChatInput.tsx`：
  - provider 下拉改为 `<Select value="codex" disabled>`
  - 旁边加 `<span className="rounded-full border border-border px-2 py-0.5 text-xs text-mutedForeground">Backend: codex</span>`
  - 保留图片上传 / reasoning effort 下拉（reasoning 透传到 sidecar 的 `config.reasoning_effort`）
- 复制 `web/src/components/chat/MessageList.tsx` 到 `web/src/codex/components/CodexMessageList.tsx`，把对 `topicStore` 字段的引用改成对 `codexSessionStore` 的引用
- `CodexChatPanel.tsx` 接入上面两个 + `ApprovalDialog`
- 视觉遵守 `DESIGN.md`（Ollama 风格：pill 按钮、12px 卡片、零阴影、纯灰度）

**验收**：人工对比截图，新旧面板视觉一致，仅多了 `Backend: codex` badge；commit `feat(codex): UI 复刻与模型锁定`。

### M6 — 会话列表（复用 SDK 自带持久化）
**SDK 已经把 thread 自动写到 `~/.codex/sessions/`，本里程碑不自己存盘，只做读取和展示。**
- Sidecar `listThreads` 方法：读 `~/.codex/sessions/` 目录，按 mtime 排序取最近 20 条，返回 `ThreadMeta[]`
- Sidecar `resumeSession` 方法：`codex.resumeThread(threadId)` + 放进 sessions map
- 前端 `CodexSessionList.tsx`：面板内左侧列表；点击调 `codex_resume_session`

**验收**：关闭重开 app 能看到历史列表，点开恢复消息；commit `feat(codex): 会话列表与恢复`。

### M7 — Release 构建冒烟 + 旧代码删除（**独立 commit**）

#### 7a. Release 构建
- `scripts/build-sidecar.mjs`：`pnpm -C agent-sidecar build` → `node --experimental-sea-config build-sea.json` 产 SEA 单文件 → copy 到 `src-tauri/binaries/prism-codex-sidecar-<triple>`
- `src-tauri/tauri.conf.json`：`bundle.externalBin = ["binaries/prism-codex-sidecar"]`；CSP 的 `connect-src` 清掉 `https://api.tavily.com` / `https://api.exa.ai`，只保留 `'self' ipc: http://ipc.localhost`
- `pnpm tauri build` 产 NSIS 安装包
- 手动冒烟：安装 → 启动 → 发「hello」→ 收到回复 → 创建一个文件（走审批）→ 关闭 → 重启恢复 session → 卸载

#### 7b. 旧代码物理删除
**这一步必须是独立 commit**，message：`refactor(codex): 删除旧 Python 后端与旧聊天链路`。

删除清单（精确到文件）：
```
server.py
tools.py
tools.json
config.py
desktop_logging.py
runtime_paths.py
requirements.txt
Dockerfile
docker-compose.yml
skills-lock.json
routes/                                  # 整个目录
ai/                                      # 整个目录
frontend/                                # 整个目录（已被 web/ 取代）
__pycache__/
tests/                                   # 仅 Python 部分；若含前端测试则保留前端
web/src/hooks/usePrismChat.ts
web/src/lib/topicMessages.ts
web/src/components/chat/ChatPanel.tsx
web/src/components/chat/ChatInput.tsx
web/src/components/chat/MessageList.tsx
web/src/components/chat/MessageBubble.tsx
web/src/components/chat/ThinkingBlock.tsx
```

同时：
- `src-tauri/src/lib.rs`：删除 `BACKEND_RESOURCE_DIR` / `BACKEND_EXECUTABLE_NAME` / `spawn_release_backend` / `ManagedBackendProcess` / `USE_CODEX_BACKEND_RUST` 常量，让 `prepare_runtime` 只走 codex 分支
- `web/src/App.tsx`：删除 `USE_CODEX_BACKEND` 常量和 `else` 分支
- `web/package.json`：移除 `@ai-sdk/react`、`ai`（确认无其它引用后）
- `docs/refactor-pi-coding-agent.md`：若工作树还是 deleted 未提交，一并 `git rm`

**验收**（全部必须通过）：
1. `rg -l 'fastapi|uvicorn|requirements.txt'` 无结果
2. `rg -l '@ai-sdk/react|DefaultChatTransport'` 无结果
3. `cargo check && cargo clippy --no-deps -- -D warnings` 通过
4. `pnpm -C web typecheck && pnpm -C web lint` 通过
5. `pnpm -C agent-sidecar build` 通过
6. `pnpm tauri dev` 从零启动、发消息、退出无红色报错

---

## 8. 明确不做

- ❌ 迁移旧 topic 数据
- ❌ 提供切回旧 provider 的 UI 路径
- ❌ 重写 API key 管理（依赖用户自己跑 `codex login`）
- ❌ 联网搜索 / HTML 预览 / CORS 代理
- ❌ 任何无关的性能优化 / 命名 refactor / README 更新
- ❌ 把 `codex` CLI 本身打进安装包（只打 Node sidecar；v1 要求用户机器已装 codex）
- ❌ macOS / Linux 打包（v1 仍只发 Windows）
- ❌ 绕过 `@openai/codex-sdk` 直连 `codex app-server`（协议还在变，SDK 稳定再说）

---

## 9. 安全底线

1. **硬白名单审批**：上述危险命令一律强制弹窗，不能被「允许本会话」记忆
2. **workspaceRoot 是硬边界**：sidecar 启动时固定 cwd；写路径逃逸由 sidecar 先检查再交给 SDK
3. **永不泄露 `~/.codex/auth.json` 内容**到日志 / 事件 / 前端
4. **取消必须真杀进程**：`AbortController` + `process.kill` 兜底

---

## 10. 执行者自检清单（每次 commit 前跑）

- [ ] 本次 commit 只动了本里程碑允许的文件
- [ ] 没 edit 除 `App.tsx` / `lib.rs` 以外的旧文件（M7 除外）
- [ ] 前端没 import `@openai/codex-sdk`（Node-only）
- [ ] `cargo check` / `cargo clippy --no-deps -- -D warnings` 绿
- [ ] `pnpm -C web typecheck` / `pnpm -C web lint` 绿
- [ ] `pnpm -C agent-sidecar build` 绿
- [ ] WSLg 下 `pnpm tauri dev` 跑过本里程碑主路径
- [ ] commit message 中文、以 `feat(codex):` / `refactor(codex):` / `chore(codex):` 开头
- [ ] 第 11 节 Scratchpad 追加了本里程碑的实际发现 / 坑

---

## 11. Scratchpad（执行者填写）

> 每个里程碑结束后在这里补充：实际遇到的非预期行为、SDK 事件真实 schema、命令输出片段、绕过方案。保留原文即可，不用整理成正文。

### M0 预验证结论
- `codex --version` 输出：`codex-cli 0.120.0`
- `@openai/codex-sdk` 版本 / 依赖 codex 的最低版本：安装到的是 `@openai/codex-sdk@0.120.0`；其 `package.json` 里把 `@openai/codex` 固定依赖为 `0.120.0`。源码里没有单独声明“兼容的最低 CLI 版本”，当前能确认的是 SDK/CLI 版本按同号配套。
- `runStreamed` 返回类型（从 `.d.ts` 抄）：
  ```ts
  type TurnOptions = {
    outputSchema?: unknown;
    signal?: AbortSignal;
  };

  type StreamedTurn = {
    events: AsyncGenerator<ThreadEvent>;
  };

  type UserInput =
    | { type: "text"; text: string }
    | { type: "local_image"; path: string };

  type Input = string | UserInput[];

  class Thread {
    get id(): string | null;
    runStreamed(input: Input, turnOptions?: TurnOptions): Promise<StreamedTurn>;
    run(input: Input, turnOptions?: TurnOptions): Promise<Turn>;
  }

  type ThreadOptions = {
    model?: string;
    sandboxMode?: "read-only" | "workspace-write" | "danger-full-access";
    workingDirectory?: string;
    skipGitRepoCheck?: boolean;
    modelReasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh";
    networkAccessEnabled?: boolean;
    webSearchMode?: "disabled" | "cached" | "live";
    webSearchEnabled?: boolean;
    approvalPolicy?: "never" | "on-request" | "on-failure" | "untrusted";
    additionalDirectories?: string[];
  };

  class Codex {
    startThread(options?: ThreadOptions): Thread;
    resumeThread(id: string, options?: ThreadOptions): Thread;
  }
  ```
- 事件 union 完整列表（`item.*` / `turn.*` / 其它）：
  ```ts
  type ThreadEvent =
    | { type: "thread.started"; thread_id: string }
    | { type: "turn.started" }
    | { type: "turn.completed"; usage: { input_tokens: number; cached_input_tokens: number; output_tokens: number } }
    | { type: "turn.failed"; error: { message: string } }
    | { type: "item.started"; item: ThreadItem }
    | { type: "item.updated"; item: ThreadItem }
    | { type: "item.completed"; item: ThreadItem }
    | { type: "error"; message: string };

  type ThreadItem =
    | { id: string; type: "agent_message"; text: string }
    | { id: string; type: "reasoning"; text: string }
    | { id: string; type: "command_execution"; command: string; aggregated_output: string; exit_code?: number; status: "in_progress" | "completed" | "failed" }
    | { id: string; type: "file_change"; changes: { path: string; kind: "add" | "delete" | "update" }[]; status: "completed" | "failed" }
    | { id: string; type: "mcp_tool_call"; server: string; tool: string; arguments: unknown; result?: { content: ContentBlock[]; structured_content: unknown }; error?: { message: string }; status: "in_progress" | "completed" | "failed" }
    | { id: string; type: "web_search"; query: string }
    | { id: string; type: "todo_list"; items: { text: string; completed: boolean }[] }
    | { id: string; type: "error"; message: string };
  ```
  额外实测：在 `show_raw_agent_reasoning: true` 情况下，本次 spike 仍然没有观察到 `item.updated` 或任何“文本 delta”事件；实际常见的是 `thread.started`、`turn.started`、`item.started`、`item.completed`、`turn.completed`、`error(Reconnecting...)`。
- spike.mjs 前 30 行事件实际输出：本次只有 7 行，原样如下：
  ```json
  {"type":"thread.started","thread_id":"019d7c6b-eae6-71b0-9fb8-0837255a4583"}
  {"type":"turn.started"}
  {"type":"error","message":"Reconnecting... 1/5 (stream disconnected before completion: stream closed before response.completed)"}
  {"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"将在当前目录创建 `hello.txt`，内容写入 `hi`。随后我会确认文件已落盘。"}}
  {"type":"item.started","item":{"id":"item_1","type":"file_change","changes":[{"path":"/tmp/codex-spike/hello.txt","kind":"add"}],"status":"in_progress"}}
  {"type":"item.completed","item":{"id":"item_1","type":"file_change","changes":[{"path":"/tmp/codex-spike/hello.txt","kind":"add"}],"status":"completed"}}
  {"type":"error","message":"Reconnecting... 1/5 (stream disconnected before completion: stream closed before response.completed)"}
  {"type":"item.completed","item":{"id":"item_2","type":"agent_message","text":"已创建 [hello.txt](/tmp/codex-spike/hello.txt)，内容为 `hi`。"}}
  {"type":"turn.completed","usage":{"input_tokens":21205,"cached_input_tokens":13952,"output_tokens":187}}
  ```
- `threadId` 示例：`019d7c6b-eae6-71b0-9fb8-0837255a4583`
- cancel / AbortSignal 的真实行为：
  - `.d.ts` 和 `dist/index.js` 都确认 `runStreamed(..., { signal })` 会把 `AbortSignal` 直接传给 `child_process.spawn(..., { signal })`
  - 实测 `AbortController.abort()` 后，调用方收到 `AbortError: The operation was aborted`
  - 本次观察到的流里只有 `thread.started`、`turn.started`、一条 `error(Reconnecting...)`，然后直接抛 `AbortError`
  - 没有观察到单独的 `turn.failed` / `item.completed(status=failed)` 作为取消完成信号，所以上层如果要做 UI 状态收尾，不能只等 stream 事件
- 审批 hook 的真实 API（或回退方案）：
  - SDK 的公开类型里只有 `approvalPolicy?: "never" | "on-request" | "on-failure" | "untrusted"`，没有 `approvalHandler`、`onApprovalRequest`、`respondApproval` 之类的 API
  - `dist/index.js` 实现确认：SDK 实际是 `spawn(codex exec --experimental-json ...)`，把 prompt 写进 stdin 后立刻 `stdin.end()`；后续没有保留一个可写控制通道给客户端回传审批决定
  - 实测 1：`approvalPolicy: "untrusted"` + “删除当前目录里的 hello.txt” 没有出现任何审批事件，直接执行了 `rm hello.txt`
  - 实测 2：`approvalPolicy: "untrusted"` + “在 /tmp/codex-outside-approval.txt 写入 hello” 也没有出现任何审批事件，直接完成了文件写入和校验
  - 官方文档里能找到审批请求/响应协议的是 `codex app-server` JSON-RPC，不是 SDK 的 `runStreamed()`/`codex exec --experimental-json` 这条链路
  - 当前结论：按本计划要求用 `@openai/codex-sdk` 做 sidecar 时，**没有已验证的办法把审批请求拦到前端，再把 allow/deny 回送给同一次 turn**。M4 依赖的能力目前视为缺失
- `resumeThread` 在 id 不存在时的错误形状：
  - `codex.resumeThread("nonexistent-thread-id")` 本身不抛错
  - 实测随后 `runStreamed("只回复 OK")` 会输出新的 `thread.started`，`thread_id` 变成一个全新的 id：`019d7c70-ee7f-7ab2-85d0-5957a3a0d7b5`
  - 然后 turn 正常完成，返回 `OK`
  - 也就是说：**对不存在的 thread id，不是“抛明确错误”，而是静默新开一个 thread**
  - 这会影响 M6：前端不能把“resume 成功”当成“历史 thread 一定存在”的证明，必须额外校验返回/事件里的真实 thread id
- BLOCKED:
  - 根因已确认：`@openai/codex-sdk` 当前公开能力只能把 `codex exec --experimental-json` 当成单向事件流来消费；审批交互能力存在于 `codex app-server` JSON-RPC 文档中，但 SDK 没暴露对应双向协议
  - 这与第 3 节原则 2、原则 5 以及 M4 的“前端审批弹窗 -> sidecar 回喂 SDK”直接冲突
  - 在不改架构为 `codex app-server`、也不放弃人工审批的前提下，本计划无法继续推进到 M1+

### M1–M7
- 实际执行路线已在 M0 后转向 `codex app-server`，原因见上面的 `BLOCKED` 结论。
- 已新增 `agent-sidecar/`，不再使用 `@openai/codex-sdk`，而是由 sidecar 直接 spawn `codex app-server --listen stdio://` 并做双向 JSON-RPC。
- Sidecar 当前已实现：
  - `health`
  - `startSession`
  - `resumeSession`
  - `sendMessage`
  - `cancel`
  - `respondApproval`
  - `listThreads`
- 已确认 `app-server` 的真实通知里存在：
  - `item/agentMessage/delta`
  - `item/reasoning/textDelta`
  - `item/commandExecution/requestApproval`
  - `turn/completed`
  - `thread/tokenUsage/updated`
- 已确认 destructive shell 命令会经由 `item/commandExecution/requestApproval` 冒泡；客户端回复 `decline` 后，服务端会继续产出最终 assistant 文本并在稍后 `turn/completed` 收尾。
- 2026-04-11 桌面联调补充结论：
  - `turn/completed` 的真实结构里没有顶层 `params.turnId`，而是放在 `params.turn.id`
  - sidecar 早期版本因此在 `handleNotification()` 里拿不到 request 绑定，表现为：普通消息能收到 `delta`，但前端一直等不到外层 `done`
  - 现已在 `agent-sidecar/src/index.ts` 改成同时兼容 `params.turnId` 和 `params.turn.id`
- 回归结果：普通文本消息可正常收到 `done`；高风险命令触发审批后，用户 `deny` 也能继续收到 assistant 收尾文本，并最终收到 `done`
- 当前前端已切到 `web/src/codex/**` 新链路；`App.tsx` 默认渲染 Codex 面板，顶部模型区固定显示 `codex`，并增加 `Backend: codex` 标识。
- 当前 Tauri 已改为启动 sidecar，不再启动旧 Python HTTP 后端。
- M7 清理已完成：
  - 已删除旧 Python 后端、旧静态 `frontend/`、旧 React 聊天组件与旧 topic 聊天状态链路
  - 已移除前端 `@ai-sdk/react` / `ai` 依赖，并把根目录 Windows 桌面脚本改为新的 Codex/Tauri 流程包装
  - 已确认源码层不再引用 `usePrismChat`、`topicMessages`、旧 `components/chat/**`、`server.py`、`tools.json`、`requirements.txt` 等旧入口

---

## 附录 A：给执行者的 Prompt 模板

> 你是 gpt-5.4。你正在 `/home/liangmj/Projects/Prism`（分支 `refactor/frontend`）上按 `docs/plan-codex-backend.md` 执行。当前要做 **M\<N\>**。执行前请：
> 1. 完整读一遍本计划（尤其是「设计原则」「明确不做」「里程碑」三节）
> 2. 只动本里程碑允许的文件
> 3. 跑一遍第 10 节自检清单
> 4. 用一个 commit 提交，message 以 `feat(codex):` / `refactor(codex):` / `chore(codex):` 开头
> 5. 在第 11 节 Scratchpad 追加本次里程碑的坑 / 样例
> 如果任何一步阻塞，写 `BLOCKED:` 并停手。

---

## 附录 B：参考链接

- [Codex SDK – OpenAI Developers](https://developers.openai.com/codex/sdk)
- [openai/codex TypeScript SDK on GitHub](https://github.com/openai/codex/tree/main/sdk/typescript)
- [Unlocking the Codex harness: how we built the App Server – OpenAI](https://openai.com/index/unlocking-the-codex-harness/)
- [Command line options – Codex CLI | OpenAI Developers](https://developers.openai.com/codex/cli/reference)
- [Node.js Single Executable Applications](https://nodejs.org/api/single-executable-applications.html)
