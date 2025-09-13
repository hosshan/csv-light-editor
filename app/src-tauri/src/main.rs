#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod csv_engine;
mod metadata;
mod state;
mod utils;

use state::{AppState, AppStateInner};
use tokio::sync::Mutex;

fn main() {
    env_logger::init();

    let app_state = AppState::new(AppStateInner::new());

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::open_csv_file,
            commands::save_csv_file,
            commands::get_csv_chunk,
            commands::get_csv_metadata,
            commands::validate_csv_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}