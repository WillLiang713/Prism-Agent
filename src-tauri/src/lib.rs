mod codex_sidecar;

use std::sync::{Arc, Mutex};
#[cfg(windows)]
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc as StdArc,
};

use codex_sidecar::CodexBridge;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::webview::Color;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Theme, WebviewUrl, WebviewWindowBuilder,
};

#[cfg(windows)]
use windows::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    UI::{
        Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass},
        WindowsAndMessaging::{
            PostMessageW, WM_CLOSE, WM_ENDSESSION, WM_NCDESTROY, WM_QUERYENDSESSION,
        },
    },
};

const WINDOW_LABEL: &str = "main";
const TRAY_ID: &str = "main-tray";
const TRAY_MENU_SHOW_ID: &str = "tray-show";
const TRAY_MENU_QUIT_ID: &str = "tray-quit";
#[cfg(windows)]
const SESSION_END_SUBCLASS_ID: usize = 0x5052_4953_4D;

#[derive(Default)]
struct DesktopPreferencesState(Mutex<DesktopPreferences>);

#[derive(Default)]
struct ExitIntentState(Mutex<bool>);

struct CodexBridgeState(Arc<CodexBridge>);

#[cfg(windows)]
struct WindowsSessionEndState(StdArc<AtomicBool>);

struct DesktopPreferences {
    close_to_tray: bool,
}

impl Default for DesktopPreferences {
    fn default() -> Self {
        Self {
            close_to_tray: true,
        }
    }
}

#[cfg(windows)]
impl Default for WindowsSessionEndState {
    fn default() -> Self {
        Self(StdArc::new(AtomicBool::new(false)))
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopRuntime {
    platform: &'static str,
    api_base: String,
    backend_managed_by_desktop: bool,
    startup_error: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopPreferencesPayload {
    close_to_tray: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StartSessionPayload {
    workspace_root: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResumeSessionPayload {
    workspace_root: String,
    thread_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SendImagePayload {
    name: String,
    media_type: String,
    data_url: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SendMessagePayload {
    request_id: String,
    session_id: String,
    text: String,
    images: Option<Vec<SendImagePayload>>,
    reasoning_effort: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CancelPayload {
    request_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ApprovalPayload {
    approval_id: String,
    decision: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ArchiveThreadPayload {
    thread_id: String,
}

fn build_runtime_script(config: &DesktopRuntime) -> Result<String, String> {
    let runtime_json =
        serde_json::to_string(config).map_err(|error| format!("序列化桌面运行时失败: {error}"))?;

    Ok(format!(
        r#"
window.__PRISM_RUNTIME__ = {runtime_json};
"#
    ))
}

fn prepare_runtime() -> DesktopRuntime {
    DesktopRuntime {
        platform: "desktop",
        api_base: String::new(),
        backend_managed_by_desktop: true,
        startup_error: String::new(),
    }
}

fn background_color_for_theme(theme: Theme) -> Color {
    match theme {
        Theme::Light => Color(245, 245, 247, 255),
        Theme::Dark => Color(0, 0, 0, 255),
        _ => Color(0, 0, 0, 255),
    }
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn should_close_to_tray(app: &tauri::AppHandle) -> bool {
    app.state::<DesktopPreferencesState>()
        .0
        .lock()
        .map(|guard| guard.close_to_tray)
        .unwrap_or(false)
}

fn is_exit_requested(app: &tauri::AppHandle) -> bool {
    app.state::<ExitIntentState>()
        .0
        .lock()
        .map(|guard| *guard)
        .unwrap_or(false)
}

#[cfg(windows)]
fn is_windows_session_ending(app: &tauri::AppHandle) -> bool {
    app.state::<WindowsSessionEndState>()
        .0
        .load(Ordering::Relaxed)
}

#[cfg(not(windows))]
fn is_windows_session_ending(_app: &tauri::AppHandle) -> bool {
    false
}

fn request_exit(app: &tauri::AppHandle) {
    if let Ok(mut guard) = app.state::<ExitIntentState>().0.lock() {
        *guard = true;
    }
    app.exit(0);
}

#[cfg(windows)]
unsafe extern "system" fn handle_session_end_subclass(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    subclass_id: usize,
    ref_data: usize,
) -> LRESULT {
    let flag = ref_data as *const AtomicBool;
    if !flag.is_null() {
        match message {
            WM_QUERYENDSESSION => unsafe {
                (*flag).store(true, Ordering::Relaxed);
                let _ = PostMessageW(Some(hwnd), WM_CLOSE, WPARAM(0), LPARAM(0));
            },
            WM_ENDSESSION => unsafe {
                let ending = wparam.0 != 0;
                (*flag).store(ending, Ordering::Relaxed);
                if ending {
                    let _ = PostMessageW(Some(hwnd), WM_CLOSE, WPARAM(0), LPARAM(0));
                }
            },
            WM_NCDESTROY => unsafe {
                (*flag).store(false, Ordering::Relaxed);
                let _ = RemoveWindowSubclass(hwnd, Some(handle_session_end_subclass), subclass_id);
            },
            _ => {}
        }
    }

    unsafe { DefSubclassProc(hwnd, message, wparam, lparam) }
}

#[cfg(windows)]
fn install_windows_session_end_monitor(
    app: &tauri::AppHandle,
    window: &tauri::WebviewWindow,
) -> Result<(), String> {
    let hwnd = window
        .hwnd()
        .map_err(|error| format!("读取桌面窗口句柄失败: {error}"))?;
    let flag = app.state::<WindowsSessionEndState>().0.clone();
    let installed = unsafe {
        SetWindowSubclass(
            hwnd,
            Some(handle_session_end_subclass),
            SESSION_END_SUBCLASS_ID,
            StdArc::as_ptr(&flag) as usize,
        )
    };

    if !installed.as_bool() {
        return Err("注册 Windows 关机会话监听失败".to_string());
    }

    Ok(())
}

fn create_tray(app: &tauri::AppHandle) -> Result<(), String> {
    let show_item = MenuItem::with_id(app, TRAY_MENU_SHOW_ID, "显示窗口", true, None::<&str>)
        .map_err(|error| format!("创建托盘菜单失败: {error}"))?;
    let quit_item = MenuItem::with_id(app, TRAY_MENU_QUIT_ID, "退出", true, None::<&str>)
        .map_err(|error| format!("创建托盘菜单失败: {error}"))?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])
        .map_err(|error| format!("创建托盘菜单失败: {error}"))?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("Prism")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            TRAY_MENU_SHOW_ID => show_main_window(app),
            TRAY_MENU_QUIT_ID => request_exit(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                }
            ) {
                show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder
        .build(app)
        .map(|_| ())
        .map_err(|error| format!("创建托盘图标失败: {error}"))
}

async fn call_codex(
    app: &tauri::AppHandle,
    method: &str,
    params: Value,
) -> Result<Value, String> {
    let bridge = &app.state::<CodexBridgeState>().0;
    bridge.call(method, params).await
}

async fn shutdown_codex(app: &tauri::AppHandle) {
    if let Some(state) = app.try_state::<CodexBridgeState>() {
        state.0.shutdown().await;
    }
}

#[tauri::command]
fn update_desktop_preferences(
    app: tauri::AppHandle,
    payload: DesktopPreferencesPayload,
) -> Result<(), String> {
    let state = app.state::<DesktopPreferencesState>();
    let mut guard = state
        .0
        .lock()
        .map_err(|error| format!("更新桌面配置失败: {error}"))?;
    guard.close_to_tray = payload.close_to_tray;
    Ok(())
}

#[tauri::command]
async fn codex_health(app: tauri::AppHandle) -> Result<Value, String> {
    call_codex(&app, "health", Value::Null).await
}

#[tauri::command]
async fn codex_start_session(
    app: tauri::AppHandle,
    payload: StartSessionPayload,
) -> Result<Value, String> {
    call_codex(
        &app,
        "startSession",
        json!({
            "workspaceRoot": payload.workspace_root,
        }),
    )
    .await
}

#[tauri::command]
async fn codex_resume_session(
    app: tauri::AppHandle,
    payload: ResumeSessionPayload,
) -> Result<Value, String> {
    call_codex(
        &app,
        "resumeSession",
        json!({
            "workspaceRoot": payload.workspace_root,
            "threadId": payload.thread_id,
        }),
    )
    .await
}

#[tauri::command]
async fn codex_send_message(
    app: tauri::AppHandle,
    payload: SendMessagePayload,
) -> Result<Value, String> {
    let images = payload
        .images
        .unwrap_or_default()
        .into_iter()
        .map(|image| {
            json!({
                "name": image.name,
                "mediaType": image.media_type,
                "dataUrl": image.data_url,
            })
        })
        .collect::<Vec<_>>();

    call_codex(
        &app,
        "sendMessage",
        json!({
            "requestId": payload.request_id,
            "sessionId": payload.session_id,
            "text": payload.text,
            "images": images,
            "reasoningEffort": payload.reasoning_effort,
        }),
    )
    .await
}

#[tauri::command]
async fn codex_cancel(app: tauri::AppHandle, payload: CancelPayload) -> Result<Value, String> {
    call_codex(
        &app,
        "cancel",
        json!({
            "requestId": payload.request_id,
        }),
    )
    .await
}

#[tauri::command]
async fn codex_respond_approval(
    app: tauri::AppHandle,
    payload: ApprovalPayload,
) -> Result<Value, String> {
    call_codex(
        &app,
        "respondApproval",
        json!({
            "approvalId": payload.approval_id,
            "decision": payload.decision,
        }),
    )
    .await
}

#[tauri::command]
async fn codex_list_threads(app: tauri::AppHandle) -> Result<Value, String> {
    call_codex(&app, "listThreads", Value::Null).await
}

#[tauri::command]
async fn codex_archive_thread(
    app: tauri::AppHandle,
    payload: ArchiveThreadPayload,
) -> Result<Value, String> {
    call_codex(
        &app,
        "archiveThread",
        json!({
            "threadId": payload.thread_id,
        }),
    )
    .await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(DesktopPreferencesState::default())
        .manage(ExitIntentState::default());
    #[cfg(windows)]
    let builder = builder.manage(WindowsSessionEndState::default());
    let app = builder
        .invoke_handler(tauri::generate_handler![
            update_desktop_preferences,
            codex_health,
            codex_start_session,
            codex_resume_session,
            codex_send_message,
            codex_cancel,
            codex_respond_approval,
            codex_list_threads,
            codex_archive_thread
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if should_close_to_tray(window.app_handle())
                    && !is_exit_requested(window.app_handle())
                    && !is_windows_session_ending(window.app_handle())
                {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(|app| {
            let runtime = prepare_runtime();
            let bridge = tauri::async_runtime::block_on(CodexBridge::spawn(app.handle()))
                .map_err(std::io::Error::other)?;
            app.manage(CodexBridgeState(bridge));

            let init_script =
                build_runtime_script(&runtime).map_err(std::io::Error::other)?;
            let window =
                WebviewWindowBuilder::new(app, WINDOW_LABEL, WebviewUrl::App("index.html".into()))
                    .title("Prism")
                    .inner_size(1280.0, 820.0)
                    .min_inner_size(1100.0, 760.0)
                    .background_color(Color(0, 0, 0, 255))
                    .visible(false)
                    .decorations(false)
                    .center()
                    .initialization_script(init_script)
                    .build()
                    .map_err(std::io::Error::other)?;

            let theme = window.theme().unwrap_or(Theme::Dark);
            window
                .set_background_color(Some(background_color_for_theme(theme)))
                .map_err(std::io::Error::other)?;
            window.show().map_err(std::io::Error::other)?;

            #[cfg(windows)]
            install_windows_session_end_monitor(app.handle(), &window)
                .map_err(std::io::Error::other)?;

            create_tray(app.handle()).map_err(std::io::Error::other)?;

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build Prism desktop app");

    app.run(|app_handle, event| {
        if matches!(
            event,
            tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. }
        ) {
            tauri::async_runtime::block_on(shutdown_codex(app_handle));
        }
    });
}
