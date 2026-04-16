use std::env;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{path::BaseDirectory, AppHandle, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

const SIDECAR_HOST: &str = "127.0.0.1";
const SIDECAR_PORT: u16 = 33200;

pub struct AgentSidecar {
    child: Mutex<Child>,
    pub api_base: String,
    pub auth_token: String,
}

impl AgentSidecar {
    pub async fn spawn(app: &AppHandle) -> Result<Arc<Self>, String> {
        let auth_token = generate_token();
        let mut command = build_sidecar_command(app, &auth_token)?;
        command.stdout(std::process::Stdio::piped());
        command.stderr(std::process::Stdio::piped());

        let mut child = command
            .spawn()
            .map_err(|error| format!("启动 agent sidecar 失败: {error}"))?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "sidecar stdout 不可用".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "sidecar stderr 不可用".to_string())?;

        spawn_log_task(stdout, "stdout");
        spawn_log_task(stderr, "stderr");

        Ok(Arc::new(Self {
            child: Mutex::new(child),
            api_base: format!("http://{SIDECAR_HOST}:{SIDECAR_PORT}"),
            auth_token,
        }))
    }

    pub async fn shutdown(&self) {
        let mut child = self.child.lock().await;
        let _ = child.kill().await;
    }
}

fn build_sidecar_command(app: &AppHandle, auth_token: &str) -> Result<Command, String> {
    let repo_root = normalize_path_for_node(repo_root()?);
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("解析应用数据目录失败: {error}"))?;
    let node_path = resolve_node_executable()?;

    if cfg!(debug_assertions) {
        let tsx_cli_path = normalize_path_for_node(
            repo_root
                .join("node_modules")
                .join("tsx")
                .join("dist")
                .join("cli.mjs"),
        );
        let script_path =
            normalize_path_for_node(repo_root.join("agent-sidecar").join("src").join("index.ts"));
        let mut command = Command::new(node_path);
        command.current_dir(&repo_root);
        command.arg(tsx_cli_path);
        command.arg(script_path);
        command.arg("--transport=http");
        command.arg("--host");
        command.arg(SIDECAR_HOST);
        command.arg("--port");
        command.arg(SIDECAR_PORT.to_string());
        command.arg("--token");
        command.arg(auth_token);
        command.env("PRISM_AGENT_DATA_DIR", &app_data_dir);
        return Ok(command);
    }

    let release_script = normalize_path_for_node(find_release_sidecar_script(app)?);
    let mut command = Command::new(node_path);
    command.current_dir(&repo_root);
    command.arg(release_script);
    command.arg("--transport=http");
    command.arg("--host");
    command.arg(SIDECAR_HOST);
    command.arg("--port");
    command.arg(SIDECAR_PORT.to_string());
    command.arg("--token");
    command.arg(auth_token);
    command.env("PRISM_AGENT_DATA_DIR", &app_data_dir);
    Ok(command)
}

fn spawn_log_task<T>(stream: T, label: &'static str)
where
    T: tokio::io::AsyncRead + Unpin + Send + 'static,
{
    tokio::spawn(async move {
        let mut lines = BufReader::new(stream).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if !line.trim().is_empty() {
                eprintln!("[agent-sidecar:{label}] {line}");
            }
        }
    });
}

fn generate_token() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_nanos())
        .unwrap_or(0);
    format!("prism-{}-{now}", std::process::id())
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

#[cfg(windows)]
fn normalize_path_for_node(path: PathBuf) -> PathBuf {
    let raw = path.as_os_str().to_string_lossy();

    if let Some(stripped) = raw.strip_prefix(r"\\?\UNC\") {
        return PathBuf::from(format!(r"\\{stripped}"));
    }

    if let Some(stripped) = raw.strip_prefix(r"\\?\") {
        return PathBuf::from(stripped);
    }

    path
}

#[cfg(not(windows))]
fn normalize_path_for_node(path: PathBuf) -> PathBuf {
    path
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

#[cfg(test)]
mod tests {
    use super::normalize_path_for_node;
    use std::path::PathBuf;

    #[test]
    #[cfg(windows)]
    fn strips_extended_length_drive_prefix() {
        let normalized = normalize_path_for_node(PathBuf::from(
            r"\\?\C:\dev\Project\Prism-Agent\agent-sidecar\src\index.ts",
        ));

        assert_eq!(
            normalized,
            PathBuf::from(r"C:\dev\Project\Prism-Agent\agent-sidecar\src\index.ts")
        );
    }

    #[test]
    #[cfg(windows)]
    fn strips_extended_length_unc_prefix() {
        let normalized =
            normalize_path_for_node(PathBuf::from(r"\\?\UNC\server\share\agent-sidecar"));

        assert_eq!(normalized, PathBuf::from(r"\\server\share\agent-sidecar"));
    }
}
