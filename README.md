# Prism

[简体中文](./README.zh-CN.md)

Prism is now a desktop-first AI coding desktop app built with `React + Vite + Tauri`.

It uses:

- `web/` for the desktop UI frontend
- `src-tauri/` for the Tauri desktop shell
- `agent-sidecar/` for the Node sidecar that talks to the `pi` coding agent SDK

There is still a `web/` frontend project in the repo, but it is no longer a standalone browser product. The supported runtime is the desktop app.

## Download

- Repository: <https://github.com/WillLiang713/Prism>
- Releases: <https://github.com/WillLiang713/Prism/releases>

## Current Status

- Desktop-first workflow
- Agent backend via Tauri + Node sidecar
- Streaming responses, tool cards, and approval dialog
- Session resume from local Prism snapshots
- No standalone Python backend
- No standalone browser deployment path

## Prerequisites

Before local development, make sure you have:

- Node.js + npm
- Rust + Cargo
- Node.js + npm dependencies installed via `npm install`

If `cargo` is installed under `~/.cargo/bin`, the one-command dev script will auto-append it to `PATH`.

## Development

Install dependencies:

```bash
npm install
npm --prefix web install
```

Start the full desktop development environment with one command:

```bash
npm run dev
```

This command will:

- start the Vite frontend on `http://127.0.0.1:5183`
- reuse the existing Vite server if it is already running
- wait until the frontend is reachable
- start the Tauri desktop shell

If you want to run the pieces manually:

```bash
npm --prefix web run dev -- --host 127.0.0.1
source "$HOME/.cargo/env" && cargo tauri dev
```

## Build

Build the desktop app:

```bash
npm run build
```

Windows packaging is the primary supported release target in this repo.

## Notes

- `cargo tauri dev` expects the Vite dev server to already be available when run manually
- `npm run dev` is the recommended daily workflow
- The app currently targets desktop mode only
- Opening the frontend directly in a normal browser is not a supported end-user mode

## Tech Stack

- Frontend: React, Vite, TypeScript, Tailwind
- Desktop: Tauri 2
- Sidecar: Node.js
- Agent bridge: `@mariozechner/pi-coding-agent`

## Project Structure

```text
Prism/
├── agent-sidecar/         # Node sidecar for the pi agent runtime
├── scripts/               # Dev and build helper scripts
├── src-tauri/             # Tauri desktop shell
├── web/                   # React/Vite desktop frontend
├── package.json
└── README.md
```
