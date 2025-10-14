use tauri::{WindowBuilder, WindowUrl};
use crate::utils::AppError;

// File operations are handled in csv.rs now

#[tauri::command]
pub async fn open_file_in_new_window(
    file_path: String,
    app_handle: tauri::AppHandle,
) -> Result<(), AppError> {
    // Generate unique window label
    let window_label = format!("csv-editor-{}", uuid::Uuid::new_v4());

    // Create new window
    let window = WindowBuilder::new(
        &app_handle,
        &window_label,
        WindowUrl::App("index.html".into())
    )
    .title("CSV Light Editor")
    .inner_size(1280.0, 800.0)
    .min_inner_size(800.0, 600.0)
    .build()
    .map_err(|e| AppError::new(
        format!("Failed to create new window: {}", e),
        "WINDOW_CREATE_ERROR",
    ))?;

    // Wait a bit for the window to be ready, then emit the open-file event
    let file_path_clone = file_path.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(500));
        let _ = window.emit("open-file", file_path_clone);
    });

    Ok(())
}