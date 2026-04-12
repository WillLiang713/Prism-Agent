# 在 WSL 里调试 Prism 的界面

## 一句话回答

**能。** WSL2 自带一个叫 **WSLg** 的东西，可以让 WSL 里的程序**直接弹出真正的图形窗口**，就像在 Windows 上跑一样。所以重构以后，你可以**完全不离开 WSL**，就能看到 Prism 界面、点按钮、调样式、联调 sidecar。

不需要远程桌面，不需要 X server，不需要把代码同步到 Windows。装好依赖，敲一条命令，窗口就弹出来。

---

## 原理（30 秒看完）

- Prism 是一个 Tauri 桌面应用
- Tauri 在不同系统上跑出来的界面看起来一样，但内部用的浏览器内核不同：
  - Windows 上用 WebView2（基于 Edge）
  - Linux 上用 webkit2gtk（基于 Safari 的内核）
- WSL 是 Linux，所以你在 WSL 里跑 Tauri，**它会用 Linux 那套**
- WSLg 把 Linux 程序的窗口"投"到 Windows 桌面上，看起来就像普通 Windows 窗口

**结论**：你在 WSL 里看到的 Prism 窗口，**99% 跟 Windows 版长得一样**。字体可能略有差别（Linux 没装 Windows 自带的字体），但布局、颜色、交互全对。

---

## 三步搞定

### 第一步：检查你的 WSL 能不能弹窗

打开 WSL 终端，跑这一条：

```bash
echo $WAYLAND_DISPLAY
```

- **有输出**（比如 `wayland-0`）→ ✅ WSLg 可用，继续第二步
- **没输出 / 报错** → 你的 WSL 太老了，先在 Windows PowerShell 里跑 `wsl --update`，然后**重启 WSL**（PowerShell 里 `wsl --shutdown`，再打开 WSL 终端）

> 想再确认一次？跑 `sudo apt install -y x11-apps && xeyes`。如果弹出一对眼睛跟着鼠标转的窗口，说明 WSLg 完全 OK。

### 第二步：装 Tauri 在 Linux 上需要的东西

**这一坨命令一次性跑完，以后再也不用动**：

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential curl wget file \
  libxdo-dev libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev pkg-config

# Rust（如果还没装过）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Tauri 命令行工具
cargo install tauri-cli --version "^2.0" --locked
```

⚠️ **唯一容易踩的坑**：上面那个 `libwebkit2gtk-4.1-dev` 必须是 **4.1**，不是 4.0。装错的话 Tauri 会编译失败。Ubuntu 22.04 及以上默认就是 4.1，没问题。

### 第三步：跑 Prism

**就一条命令**（需要在重构时实现这个脚本，详见下方"脚本里做了什么"）：

```bash
npm run desktop:dev:wslg
```

第一次会编译 Rust，要等 1–2 分钟。完成后 **WSLg 会弹出 Prism 窗口**。按 `Ctrl+C` 退出，脚本会自动清理后台进程。

之后改代码：
- **改前端 React 代码**：保存就生效，窗口自动刷新（Vite 热更新），不用重启脚本
- **改 sidecar 代码**：sidecar 自动重建，前端按一下「重连」按钮就行，不用重启脚本
- **改 Rust 代码**：要按 `Ctrl+C` 停掉，重新跑 `npm run desktop:dev:wslg`

---

## 脚本里做了什么

`npm run desktop:dev:wslg` 对应的是 `scripts/dev-tauri-wslg.sh`，它是 Windows 端 `dev-tauri-windows.ps1` 的 Linux/WSL 版本。**你不用关心内部细节**，但为了排查问题方便，列一下它做的事：

1. **检查环境**：确认 Node、Cargo、Tauri CLI 都在
2. **装前端依赖**：如果 `web/node_modules` 不存在，自动 `npm install`
3. **后台启动 sidecar**：跑 `node agent-sidecar/dist/agent-sidecar.js`，日志写到 `logs/sidecar.log`
4. **后台启动 Vite 开发服务器**：监听 `http://127.0.0.1:5173`
5. **等到两个都就绪**（最多 15 秒），都没起来就报错退出
6. **前台启动 Tauri**：`cargo tauri dev --config src-tauri/tauri.linux.conf.json`，WSLg 弹窗
7. **Ctrl+C 时清理**：把后台的 sidecar 和 Vite 进程都干掉，不留残余

> **配套文件**（也都需要在重构时一起加上）：
> - `scripts/dev-tauri-wslg.sh` — 启动脚本本体
> - `src-tauri/tauri.linux.conf.json` — Linux dev 用的 Tauri 配置（覆盖 bundle target，改成 `deb`，因为 NSIS 是 Windows 专属）
> - `package.json` 根部的 `scripts` 加一行：`"desktop:dev:wslg": "bash ./scripts/dev-tauri-wslg.sh"`

> ⚠️ **重构前临时验证 WSLg**：如果你想在动手重构**之前**就先确认 WSLg 弹窗能力，最简单的办法是跑 `cargo create-tauri-app` 在 `/tmp` 下建一个 hello-world Tauri 项目，`cargo tauri dev` 看能不能弹窗。这一步只验证工具链，不依赖 Prism 本身。

---

## 调试的时候怎么看东西

| 我想看 | 怎么看 |
|---|---|
| 前端 console.log | 在窗口里**右键 → Inspect Element** → Console 标签 |
| 前端报错 / 网络请求 | 同上，DevTools 里 |
| Rust 的日志 | 跑 `cargo tauri dev` 那个终端窗口里 |
| Sidecar 的日志 | 同上（dev 模式 sidecar 的输出会和 Rust 一起打到终端）|

也就是说，**一个终端 + 一个 Tauri 窗口里的 DevTools**，三层日志全在眼前。

---

## 如果搞不定怎么办

按下面顺序排查：

1. **WSLg 不弹窗**
   - 在 PowerShell 里跑 `wsl --update`，再 `wsl --shutdown`，重新打开 WSL 终端
   - Windows 版本要 Win10 21H2 以上，Win11 直接没问题
   - 实在不行就只能在 Windows 端调试（用项目里现成的 `npm run desktop:dev`）

2. **Tauri 编译失败，提示找不到 webkit**
   - 多半是装成了 webkit2gtk-4.0 而不是 4.1
   - 跑 `apt list --installed | grep webkit2gtk` 确认版本

3. **窗口弹出来但白屏**
   - 检查 Vite 那边是不是真起来了（终端有没有 `Local: http://localhost:5173`）
   - 浏览器（Edge 或 Chrome）打开 `http://localhost:5173` 看能不能直接访问，不能的话是前端的问题，跟 Tauri 无关

4. **字体看着怪**
   - 这是正常的，Linux 没有 Windows 那些字体
   - 不影响调试，最终视觉效果回到 Windows 端验收一次就好

---

## 总结

**不用纠结要不要进 Windows 调试**。你 90% 的开发时间都可以在 WSL 里完成：

```
写代码（VS Code / Claude Code，都在 WSL 里）
   ↓
cargo tauri dev --config src-tauri/tauri.linux.conf.json
   ↓
WSLg 弹窗，看到真界面
   ↓
改代码 → 自动刷新 → 继续看
```

只有最后要发版了，再切到 Windows 端跑一遍 `npm run desktop:dev` 做最终验收就行。
