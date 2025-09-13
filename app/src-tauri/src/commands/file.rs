use std::path::Path;
use tauri::State;
use crate::state::AppState;
use crate::utils::AppError;

#[tauri::command]
pub async fn validate_csv_file(path: String) -> Result<bool, AppError> {
    let path = Path::new(&path);

    if !path.exists() {
        return Ok(false);
    }

    if !path.is_file() {
        return Ok(false);
    }

    let extension = path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    Ok(extension == "csv" || extension == "tsv")
}