use std::collections::HashMap;
use std::env;
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc,
};

use serde_json::{json, Value};
use tauri::{path::BaseDirectory, AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::{oneshot, Mutex};
use tokio::time::{timeout, Duration};

type PendingSender = oneshot::Sender<Result<Value, String>>;
const SIDECAR_RESPONSE_TIMEOUT_SECS: u64 = 10;

pub struct AgentBridge {
    child: Mutex<Child>,
    stdin: Mutex<ChildStdin>,
    pending: Mutex<HashMap<u64, PendingSender>>,
    next_id: AtomicU64,
}

impl AgentBridge {
    pub async fn spawn(app: &AppHandle) -> Result<Arc<Self>, String> {
        let mut command = build_sidecar_command(app)?;
        command.stdin(std::process::Stdio::piped());
        command.stdout(std::process::Stdio::piped());
        command.stderr(std::process::Stdio::piped());

        let mut child = command
            .spawn()
            .map_err(|error| format!("启动 agent sidecar 失败: {error}"))?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "sidecar stdin 不可用".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "sidecar stdout 不可用".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "sidecar stderr 不可用".to_string())?;

        let bridge = Arc::new(Self {
            child: Mutex::new(child),
            stdin: Mutex::new(stdin),
            pending: Mutex::new(HashMap::new()),
            next_id: AtomicU64::new(1),
        });

        spawn_stdout_task(app.clone(), bridge.clone(), stdout);
        spawn_stderr_task(stderr);

        Ok(bridge)
    }

    pub async fn call(&self, method: &str, params: Value) -> Result<Value, String> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let payload = json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params,
        });

        let (tx, rx) = oneshot::channel();
        self.pending.lock().await.insert(id, tx);

        {
            let mut stdin = self.stdin.lock().await;
            stdin
                .write_all(payload.to_string().as_bytes())
                .await
                .map_err(|error| format!("写入 sidecar 请求失败: {error}"))?;
            stdin
                .write_all(b"\n")
                .await
                .map_err(|error| format!("写入 sidecar 分帧失败: {error}"))?;
            stdin
                .flush()
                .await
                .map_err(|error| format!("刷新 sidecar stdin 失败: {error}"))?;
        }

        match timeout(Duration::from_secs(SIDECAR_RESPONSE_TIMEOUT_SECS), rx).await {
            Ok(Ok(result)) => result,
            Ok(Err(error)) => Err(format!("等待 sidecar 响应失败: {error}")),
            Err(_) => {
                self.pending.lock().await.remove(&id);
                Err(format!(
                    "等待 sidecar 响应超时（{}s，method={method}）",
                    SIDECAR_RESPONSE_TIMEOUT_SECS
                ))
            }
        }
    }

    pub async fn shutdown(&self) {
        let mut child = self.child.lock().await;
        let _ = child.kill().await;
    }
}

fn spawn_stdout_task(
    app: AppHandle,
    bridge: Arc<AgentBridge>,
    stdout: tokio::process::ChildStdout,
) {
    tokio::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            let parsed: Value = match serde_json::from_str(trimmed) {
                Ok(value) => value,
                Err(_) => continue,
            };

            if let Some(id) = parsed.get("id").and_then(Value::as_u64) {
                let result = if let Some(error) = parsed.get("error") {
                    Err(error
                        .get("message")
                        .and_then(Value::as_str)
                        .unwrap_or("未知 sidecar 错误")
                        .to_string())
                } else {
                    Ok(parsed.get("result").cloned().unwrap_or(Value::Null))
                };

                if let Some(sender) = bridge.pending.lock().await.remove(&id) {
                    let _ = sender.send(result);
                }
                continue;
            }

            let _ = app.emit("agent://event", parsed);
        }
    });
}

fn spawn_stderr_task(stderr: tokio::process::ChildStderr) {
    tokio::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            eprintln!("[agent-sidecar] {line}");
        }
    });
}

fn build_sidecar_command(app: &AppHandle) -> Result<Command, String> {
    let repo_root = repo_root()?;
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("解析应用数据目录失败: {error}"))?;
    let node_path = resolve_node_executable()?;

    if cfg!(debug_assertions) {
        let tsx_cli_path = repo_root
            .join("node_modules")
            .join("tsx")
            .join("dist")
            .join("cli.mjs");
        let script_path = repo_root.join("agent-sidecar").join("src").join("index.ts");
        let mut command = Command::new(node_path);
        command.current_dir(&repo_root);
        command.arg(tsx_cli_path);
        command.arg(script_path);
        command.arg("--stdio");
        command.env("PRISM_AGENT_DATA_DIR", &app_data_dir);
        return Ok(command);
    }

    let release_script = find_release_sidecar_script(app)?;
    let mut command = Command::new(node_path);
    command.current_dir(&repo_root);
    command.arg(release_script);
    command.arg("--stdio");
    command.env("PRISM_AGENT_DATA_DIR", &app_data_dir);
    Ok(command)
}

fn resolve_node_executable() -> Result<PathBuf, String> {
    if let Some(explicit_path) = env::var_os("PRISM_NODE_PATH") {
        let explicit_path = PathBuf::from(explicit_path);
        if explicit_path.is_file() {
            return Ok(explicit_path);
        }

        return Err(format!(
            "环境变量 PRISM_NODE_PATH 指向的 Node 不存在: {}",
            explicit_path.display()
        ));
    }

    if let Some(from_path) = find_in_path(node_candidate_names()) {
        return Ok(from_path);
    }

    #[cfg(windows)]
    {
        let windows_candidates = [
            PathBuf::from(r"C:\Program Files\nodejs\node.exe"),
            PathBuf::from(r"C:\Program Files (x86)\nodejs\node.exe"),
        ];

        for candidate in windows_candidates {
            if candidate.is_file() {
                return Ok(candidate);
            }
        }

        if let Some(local_app_data) = env::var_os("LOCALAPPDATA") {
            let candidate = PathBuf::from(local_app_data)
                .join("Programs")
                .join("nodejs")
                .join("node.exe");
            if candidate.is_file() {
                return Ok(candidate);
            }
        }
    }

    Err("未找到 Node.js 可执行文件；请确认已安装 Node，或设置 PRISM_NODE_PATH".to_string())
}

fn find_in_path(names: &[&str]) -> Option<PathBuf> {
    let path_var = env::var_os("PATH")?;

    for directory in env::split_paths(&path_var) {
        for name in names {
            let candidate = directory.join(name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    None
}

#[cfg(windows)]
fn node_candidate_names() -> &'static [&'static str] {
    &["node.exe", "node"]
}

#[cfg(not(windows))]
fn node_candidate_names() -> &'static [&'static str] {
    &["node"]
}

fn repo_root() -> Result<PathBuf, String> {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .canonicalize()
        .map_err(|error| format!("解析仓库根目录失败: {error}"))
}

fn find_release_sidecar_script(app: &AppHandle) -> Result<PathBuf, String> {
    let candidates = [
        "dist/index.js",
        "agent-sidecar/dist/index.js",
        "resources/dist/index.js",
    ];

    for relative in candidates {
        let candidate = app
            .path()
            .resolve(relative, BaseDirectory::Resource)
            .map_err(|error| format!("解析 sidecar 资源失败: {error}"))?;
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    Err("未找到发布版 sidecar 脚本".to_string())
}
