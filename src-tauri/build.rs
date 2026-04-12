use std::env;
use std::fs;
use std::path::PathBuf;

fn ensure_backend_resource_dir() {
    let manifest_dir = match env::var("CARGO_MANIFEST_DIR") {
        Ok(value) => PathBuf::from(value),
        Err(_) => return,
    };

    let backend_dir = manifest_dir.join("runtime");
    let _ = fs::create_dir_all(backend_dir);
}

fn main() {
    println!("cargo:rerun-if-changed=icons/32x32.png");
    println!("cargo:rerun-if-changed=icons/128x128.png");
    println!("cargo:rerun-if-changed=icons/icon.ico");
    println!("cargo:rerun-if-changed=tauri.conf.json");
    ensure_backend_resource_dir();
    tauri_build::build()
}
