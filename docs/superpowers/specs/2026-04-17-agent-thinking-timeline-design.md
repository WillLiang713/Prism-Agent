# Agent 多段思考时间线设计

## 背景

当前前端把一轮 assistant 的思考内容汇总到单个 `message.thinking` 字段里，再用一个固定的 `ThinkingBlock` 渲染。这种模型和真实 agent 的执行过程不一致。

当前真实过程更接近：

1. 进入一段思考
2. 调用一个工具
3. 再进入一段思考
4. 再调用工具
5. 最终输出回答

现状的问题有两个：

- 所有思考都会堆进同一个区域，用户无法看出每段思考和工具调用之间的对应关系。
- 前端只有累积字符串，没有显式的“思考开始/结束”边界，无法准确拆出多个思考块。

本设计的目标是把 assistant 的执行过程改成一条按时间顺序展示的时间线，并保证“每次进入/结束思考都单独成块”。

## 目标

- 把一轮 assistant 的执行过程按真实顺序显示为时间线。
- 每次 `thinking_start` 到 `thinking_end` 形成一个独立思考块。
- 工具调用继续显示，但要插入到同一条时间线里，而不是挂在独立区域。
- 最终回答保留为正式正文，放在时间线之后，避免阅读负担过重。
- 在正常完成、报错、用户停止的情况下，时间线都能稳定收口，不留下悬空状态。

## 非目标

- 不在本次改动中把最终回答正文也拆成时间线 item。
- 不在本次改动中重做整套消息系统或把所有事件统一成全新的通用 item 流。
- 不在本次改动中改变工具卡片的核心视觉语言，只调整它在消息内的挂载位置。

## 现状

### Sidecar

`agent-sidecar/src/index.ts` 已经能收到内部 assistant 事件：

- `thinking_start`
- `thinking_delta`
- `thinking_end`

但当前只把 `thinking_delta` 透传给前端，且透传形式是：

- `type: 'delta'`
- `kind: 'thinking'`

这意味着前端拿不到思考块的显式边界。

### 前端事件层

`web/src/agent/client.ts` 当前 `AgentEvent` 只定义了：

- `delta`，其中 `kind` 为 `text` 或 `thinking`
- `tool_call`
- `tool_result`
- `done`
- `error`

因此前端无法表达单独的思考开始和结束。

### 前端状态层

`web/src/agent/sessionStore.ts` 当前 `AgentMessage` 结构包含：

- `text: string`
- `thinking: string`
- `thinkingStartedAt?: number`
- `thinkingDurationSec?: number`
- `toolEvents: AgentToolEvent[]`

这会天然把整轮思考压扁成一个字符串，和多段执行模型不匹配。

## 方案概览

本次采用“显式思考事件 + 消息内时间线渲染”的方案。

外层仍然保持“一轮 assistant 是一条消息”，只把消息内部从“固定思考区 + 工具区 + 正文区”改成：

- 过程时间线
- 最终正文

消息内部的基本结构为：

```txt
AssistantMessage
├─ Timeline
│  ├─ ThinkingItem
│  ├─ ToolItem
│  ├─ ThinkingItem
│  ├─ ToolItem
│  └─ ...
└─ FinalAnswer
```

这样既能保持现有聊天消息的基本结构，又能把执行过程按真实顺序展开。

## 事件模型

### 新增前端可见事件

在 `web/src/agent/client.ts` 的 `AgentEvent` 中新增：

- `thinking_start`
- `thinking_delta`
- `thinking_end`

建议结构如下：

```ts
type AgentEvent =
  | {
      type: 'thinking_start';
      requestId: string;
      sessionId: string;
      itemId: string;
      startedAt: number;
    }
  | {
      type: 'thinking_delta';
      requestId: string;
      sessionId: string;
      itemId: string;
      text: string;
    }
  | {
      type: 'thinking_end';
      requestId: string;
      sessionId: string;
      itemId: string;
      endedAt: number;
      durationSec: number;
      status: 'done' | 'aborted';
    };
```

其中：

- `itemId` 标识这一轮 assistant 消息。
- `status` 用于区分正常结束和中断结束。

### Sidecar 发射规则

`agent-sidecar/src/index.ts` 中，当前已经能识别内部 `thinking_start` / `thinking_delta` / `thinking_end`。本次只需要把这三个边界显式发给前端，而不是继续压缩成单个 `delta(kind: 'thinking')`。

规则如下：

- 收到内部 `thinking_start` 时，发射前端 `thinking_start`
- 收到内部 `thinking_delta` 时，发射前端 `thinking_delta`
- 收到内部 `thinking_end` 时，发射前端 `thinking_end`
- 在请求结束、报错、取消时，如果当前存在未结束思考块，sidecar 要补发一个 `thinking_end(status: 'aborted' | 'done')`

## 前端数据模型

### 新增时间线 item

在 `web/src/agent/sessionStore.ts` 中，为 assistant 消息增加时间线数组。建议结构如下：

```ts
type AgentTimelineItem =
  | AgentThinkingTimelineItem
  | AgentToolTimelineItem;

type AgentThinkingTimelineItem = {
  id: string;
  type: 'thinking';
  text: string;
  status: 'streaming' | 'done' | 'aborted';
  startedAt: number;
  endedAt?: number;
  durationSec?: number;
};

type AgentToolTimelineItem = {
  id: string;
  type: 'tool';
  toolCallId: string;
  name: string;
  status: 'running' | 'done' | 'error' | 'blocked';
  args: unknown;
  output: string;
  ok: boolean | null;
  diff?: string;
  exitCode?: number | null;
  summary?: string;
  skillName?: string | null;
};
```

### AgentMessage 调整

`AgentMessage` 需要从“单段思考 + 独立工具数组”调整为“正文 + 时间线”：

```ts
type AgentMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
  timeline: AgentTimelineItem[];
  error?: string;
};
```

本次移除或弃用以下字段：

- `thinking`
- `thinkingStartedAt`
- `thinkingDurationSec`
- `toolEvents`

历史 bootstrap 数据如果仍然是旧格式，需要在 `normalizeBootstrapMessages` 中兼容转换：

- 旧的 `thinking` 可转换成一个已完成的 `thinking` item
- 旧的 `toolEvents` 可转换成若干 `tool` item

这种兼容只用于读取旧会话，不要求旧会话一定能恢复出完全准确的时间顺序。

## 状态更新规则

前端 store 处理事件时应遵守以下规则。

### thinking_start

- 如果当前 assistant 消息已经存在一个未结束的 `thinking` item：
  - 先把旧 item 标记为 `aborted`
  - 再创建新的 `thinking` item
- 新 item 追加到 `timeline` 尾部
- 初始状态为 `streaming`

### thinking_delta

- 只追加到当前最后一个 `status === 'streaming'` 的 `thinking` item
- 如果不存在打开的思考块：
  - 允许兜底创建一个新的 `thinking` item
  - 状态为 `streaming`
  - `startedAt` 使用当前时间

### thinking_end

- 找到当前打开的 `thinking` item
- 设置：
  - `status = done` 或 `aborted`
  - `endedAt`
  - `durationSec`

### tool_call

- 如果当前有未结束的 `thinking` item：
  - 先自动结束它，状态设为 `done`
- 再追加 `tool` item

### tool_result

- 回填对应 `tool` item 的状态和输出
- 不新建新的分离结果块

### done / error / cancel

- 如果还有未结束的 `thinking` item：
  - 统一先结束它
- `done` 时标记为 `done`
- `error` 或取消时标记为 `aborted`

## 渲染结构

### 消息层级

消息列表仍然按当前方式渲染 user / assistant 消息。

assistant 消息内部改成两层：

1. `Timeline`
2. `FinalAnswer`

其中：

- `Timeline` 负责渲染 `thinking` 和 `tool` 项
- `FinalAnswer` 继续渲染 `message.text`

### ThinkingItem

思考块仍然采用可折叠结构，但每段思考是独立块。

标题规则：

- `streaming`：`思考中 X 秒`
- `done`：`已思考 X 秒`
- `aborted`：`思考已中断`

交互规则：

- 默认折叠
- 点击只展开当前这一段
- `streaming` 状态保留现有扫光特效
- `done` / `aborted` 不显示扫光

如果该思考块没有正文内容：

- 标题仍然保留
- 展开区可以为空
- 不因为正文为空而隐藏整个思考块

### ToolItem

工具卡片沿用现有卡片样式和展开模式，但不再单独从 `message.toolEvents` 渲染，而是作为 `timeline` 中的一个 item 渲染。

工具状态统一映射为：

- `running`
- `done`
- `error`
- `blocked`

### FinalAnswer

最终正文继续使用现有 assistant 正文渲染逻辑，放在全部 timeline item 之后。

如果本轮 assistant 没有工具调用，则消息结构可能是：

- 思考块 1
- 思考块 2
- 最终回答

## 兼容性与迁移

### 新会话

新会话全部走新的显式 thinking 事件和 timeline 模型。

### 旧会话

旧会话 bootstrap 仍可能只有：

- `thinking`
- `thinkingStartedAt`
- `thinkingDurationSec`
- `toolEvents`

前端需要在读取时做兼容转换，但不追求完美恢复原始交错顺序。兼容优先级如下：

1. 先保留能读
2. 再尽量保留已有内容
3. 不强行伪造不存在的精确边界

### 渐进迁移

本次优先让前端消费新事件并渲染 timeline。若 sidecar 尚未升级，前端可以继续兼容旧 `delta(kind: 'thinking')`，但仅作为兜底模式，不保证多段分块效果。

## 错误处理

- 任一未闭合思考块都必须在 `tool_call`、`done`、`error`、取消时被显式结束。
- 不允许同一 assistant 消息里同时存在两个 `streaming` 思考块。
- 工具调用缺少对应结果时，工具卡片仍保留为 `running`，直到请求结束时由 store 统一收口。
- 如果前端收到 `thinking_end` 但没有找到打开的思考块，只记录日志，不让 UI 崩溃。

## 测试策略

### Sidecar

- `thinking_start -> thinking_delta -> thinking_end` 能按顺序发射前端事件
- `tool_call` 前会自动结束未闭合思考块
- `done`、`error`、取消时会补发闭合事件

### Store

- 多次 `thinking_start/thinking_end` 会生成多个独立 `thinking` item
- `thinking_delta` 只会写入当前打开的思考块
- `tool_call/tool_result` 能正确追加并回填 `tool` item
- 中断场景下思考块会变成 `aborted`
- 旧 bootstrap 数据能被转换成可渲染的 timeline

### UI

- assistant 消息按 timeline 顺序显示多个思考块和工具卡片
- 思考块标题和状态文案正确
- `streaming` 状态存在扫光，完成后扫光消失
- 最终回答始终在 timeline 之后

## 实施边界

本设计只覆盖以下文件域的改动方向：

- `agent-sidecar/src/index.ts`
- `web/src/agent/client.ts`
- `web/src/agent/sessionStore.ts`
- `web/src/agent/components/ThinkingBlock.tsx`
- `web/src/agent/components/ToolCallCard.tsx`
- `web/src/agent/components/AgentMessageList.tsx`

如果实现时发现需要修改更多文件，应以“支持 timeline 渲染”为边界，不做无关重构。

## 决策摘要

- 采用“显式 thinking 事件 + assistant 消息内 timeline”的方案
- 每次进入/结束思考都形成独立块
- 思考和工具按时间顺序插入同一条时间线
- 最终回答保留在时间线之后，不并入时间线
- 旧数据通过兼容转换继续可读，但不保证恢复精确顺序
