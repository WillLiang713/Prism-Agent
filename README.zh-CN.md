# Prism

[English](./README.md)

Prism 现在是一个**桌面优先**的 Codex 客户端，技术栈是 `React + Vite + Tauri`。

当前结构里：

- `web/` 负责桌面界面的前端
- `src-tauri/` 负责 Tauri 桌面壳
- `agent-sidecar/` 负责 Node sidecar，并和 `codex app-server` 通信

仓库里虽然还保留了 `web/` 前端工程，但它已经**不再是独立可用的浏览器版产品**。当前支持的运行方式是桌面端。

## 下载

- 仓库地址：<https://github.com/WillLiang713/Prism>
- Releases 页面：<https://github.com/WillLiang713/Prism/releases>

## 当前状态

- 以桌面端开发和使用为主
- 后端链路基于 Tauri + Node sidecar + Codex
- 支持流式输出、工具卡片、审批弹窗
- 支持从 Codex 历史 thread 恢复会话
- 已不再依赖独立 Python 后端
- 已不再提供独立浏览器部署路径

## 开发前准备

本地开发前请先确认：

- 已安装 Node.js 和 npm
- 已安装 Rust 和 Cargo
- 已安装 `codex` CLI
- 已完成 `codex login`

如果你的 `cargo` 在 `~/.cargo/bin` 下，一键开发脚本会自动把它补进 `PATH`。

## 本地开发

先安装依赖：

```bash
npm install
npm --prefix web install
```

然后一条命令启动完整开发环境：

```bash
npm run dev
```

这条命令会自动：

- 启动 `http://127.0.0.1:5173` 的 Vite 前端
- 如果前端已经在跑，就直接复用
- 等前端可访问后再启动 Tauri 桌面壳

如果你想手动分开启动，也可以：

```bash
npm --prefix web run dev -- --host 127.0.0.1
source "$HOME/.cargo/env" && npm run tauri:dev
```

## 打包

桌面版打包命令：

```bash
npm run tauri:build
```

这个仓库当前主要面向 Windows 桌面版发布。

## 说明

- `npm run tauri:dev` 默认要求 Vite 开发服务已经先启动
- 日常开发推荐直接用 `npm run dev`
- 当前只支持桌面模式
- 直接在普通浏览器里打开前端页面，不是当前支持的正式使用方式

## 技术栈

- 前端：React、Vite、TypeScript、Tailwind
- 桌面端：Tauri 2
- Sidecar：Node.js
- Codex 桥接：`codex app-server`

## 项目结构

```text
Prism/
├── agent-sidecar/         # Codex app-server 的 Node sidecar
├── scripts/               # 开发与打包辅助脚本
├── src-tauri/             # Tauri 桌面壳
├── web/                   # React/Vite 桌面前端
├── package.json
└── README.zh-CN.md
```
