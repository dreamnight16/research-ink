use tauri::{Manager, Emitter};
use std::process::{Command, Child};
use std::sync::Mutex;
use std::time::Duration;

struct BackendState {
    process: Mutex<Option<Child>>,
    data_dir: Mutex<String>,
}

impl Drop for BackendState {
    fn drop(&mut self) {
        if let Ok(mut guard) = self.process.lock() {
            if let Some(ref mut child) = *guard {
                let _ = child.kill();
            }
        }
    }
}

fn find_python() -> &'static str {
    #[cfg(target_os = "windows")]
    { "python" }
    #[cfg(not(target_os = "windows"))]
    { "python3" }
}

fn start_backend() -> Option<Child> {
    if let Ok(child) = Command::new(find_python())
        .args(["-m", "backend.main"])
        .env("YANMO_HOST", "127.0.0.1")
        .spawn()
    {
        return Some(child);
    }
    if let Ok(child) = Command::new("python")
        .args(["-m", "backend.main"])
        .env("YANMO_HOST", "127.0.0.1")
        .spawn()
    {
        return Some(child);
    }
    None
}

fn home_dir() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    { std::env::var("USERPROFILE").ok().map(std::path::PathBuf::from) }
    #[cfg(not(target_os = "windows"))]
    { std::env::var("HOME").ok().map(std::path::PathBuf::from) }
}

#[tauri::command]
fn get_backend_status(state: tauri::State<BackendState>) -> String {
    let guard = state.process.lock().unwrap();
    match guard.as_ref() {
        Some(_) => "running".to_string(),
        None => "stopped".to_string(),
    }
}

#[tauri::command]
fn get_api_token(state: tauri::State<BackendState>) -> Result<String, String> {
    let data_dir = state.data_dir.lock().unwrap();
    let token_path = std::path::Path::new(&*data_dir).join(".api_token");
    std::fs::read_to_string(&token_path)
        .map(|s| s.trim().to_string())
        .map_err(|e| format!("无法读取 token: {}", e))
}

#[tauri::command]
fn restart_backend(state: tauri::State<BackendState>) -> Result<String, String> {
    let mut guard = state.process.lock().unwrap();
    if let Some(ref mut child) = *guard {
        let _ = child.kill();
    }
    match start_backend() {
        Some(child) => {
            *guard = Some(child);
            Ok("restarted".to_string())
        }
        None => Err("无法启动后端".to_string()),
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .manage(BackendState {
            process: Mutex::new(None),
            data_dir: Mutex::new(String::new()),
        })
        .invoke_handler(tauri::generate_handler![
            get_backend_status,
            get_api_token,
            restart_backend,
        ])
        .setup(|app| {
            let backend = start_backend();
            let state = app.state::<BackendState>();
            *state.process.lock().unwrap() = backend;

            if let Some(home) = home_dir() {
                let research-ink_dir = home.join(".research-ink");
                *state.data_dir.lock().unwrap() = research-ink_dir.to_string_lossy().to_string();
            }

            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_secs(2));
                let _ = handle.emit("backend-ready", ());
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
