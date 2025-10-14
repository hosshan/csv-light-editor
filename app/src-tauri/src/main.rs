#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod csv_engine;
mod metadata;
mod state;
mod utils;
mod settings;

use state::{AppState, AppStateInner};
use tokio::sync::Mutex;
use settings::SettingsManager;
use commands::settings::SettingsState;
use tauri::Manager;

fn main() {
    env_logger::init();

    let app_state = AppState::new(AppStateInner::new());
    let settings_state = SettingsState(Mutex::new(SettingsManager::new()));

    tauri::Builder::default()
        .manage(app_state)
        .manage(settings_state)
        .setup(|app| {
            // Handle file open from command line arguments (macOS - app not running)
            let args: Vec<String> = std::env::args().collect();
            if args.len() > 1 {
                let file_path = &args[1];
                if file_path.ends_with(".csv") {
                    println!("Opening file from args: {}", file_path);
                    let _ = app.emit_all("open-file", file_path.clone());
                }
            }

            // Handle file drop events
            let app_handle = app.handle();
            let window = app.get_window("main").unwrap();

            // Listen for file drop events via window events
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::FileDrop(tauri::FileDropEvent::Dropped(paths)) = event {
                    println!("File drop dropped: {:?}", paths);
                    if let Some(file_path) = paths.first() {
                        if file_path.to_string_lossy().ends_with(".csv") {
                            let path_str = file_path.to_string_lossy().to_string();
                            println!("Emitting open-file event for: {}", path_str);
                            let _ = app_handle.emit_all("open-file", path_str);
                        }
                    }
                }
            });

            Ok(())
        })
        .on_menu_event(|event| {
            // macOS specific: Handle "Open File" from Finder (app already running)
            match event.menu_item_id() {
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::file::open_file_in_new_window,
            commands::csv::open_csv_file,
            commands::csv::save_csv_file,
            commands::csv::save_csv_file_as,
            commands::csv::get_current_file,
            commands::csv::get_csv_chunk,
            commands::csv::get_csv_metadata,
            commands::csv::validate_csv_file,
            commands::csv::add_column,
            commands::csv::delete_column,
            commands::csv::rename_column,
            commands::csv::add_row,
            commands::csv::delete_row,
            commands::csv::duplicate_row,
            commands::csv::detect_column_types,
            commands::csv::validate_data_types,
            commands::csv::find_in_csv,
            commands::csv::replace_in_csv,
            commands::csv::sort_csv_data,
            commands::csv::save_sort_state,
            commands::csv::load_sort_state,
            commands::csv::move_row,
            commands::csv::move_column,
            commands::csv::validate_with_rules,
            commands::csv::generate_quality_report,
            commands::csv::cleanse_data,
            commands::csv::export_data,
            commands::csv::generate_export_preview,
            commands::csv::copy_to_clipboard,
            commands::settings::get_import_export_settings,
            commands::settings::update_import_export_settings,
            commands::settings::reset_import_export_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}