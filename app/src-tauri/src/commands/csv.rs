use std::path::Path;
use tauri::State;
use crate::csv_engine::{CsvReader, CsvWriter};
use crate::csv_engine::reader::CsvData;
use crate::metadata::CsvMetadata;
use crate::state::AppState;
use crate::utils::AppError;

#[tauri::command]
pub async fn open_csv_file(
    path: String,
    state: State<'_, AppState>,
) -> Result<CsvData, AppError> {
    let path = Path::new(&path);

    if !path.exists() {
        return Err(AppError::new(
            format!("File not found: {}", path.display()),
            "FILE_NOT_FOUND",
        ));
    }

    let mut reader = CsvReader::new();
    let csv_data = reader.read_file(path)?;

    let mut state = state.lock().await;
    state.current_file = Some(path.to_path_buf());
    state.metadata_manager.load_metadata(path)?;

    Ok(csv_data)
}

#[tauri::command]
pub async fn save_csv_file(
    path: String,
    data: CsvData,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let path = Path::new(&path);

    let writer = CsvWriter::new()
        .with_delimiter(data.metadata.delimiter.as_bytes()[0]);

    writer.write_file(path, &data)?;

    let state = state.lock().await;
    state.metadata_manager.save_metadata(path, &data.metadata)?;

    Ok(())
}

#[tauri::command]
pub async fn get_csv_chunk(
    path: String,
    start_row: usize,
    end_row: usize,
) -> Result<Vec<Vec<String>>, AppError> {
    let path = Path::new(&path);

    if !path.exists() {
        return Err(AppError::new(
            format!("File not found: {}", path.display()),
            "FILE_NOT_FOUND",
        ));
    }

    let mut reader = CsvReader::new();
    let chunk = reader.read_chunk(path, start_row, end_row)?;

    Ok(chunk)
}

#[tauri::command]
pub async fn get_csv_metadata(
    path: String,
    state: State<'_, AppState>,
) -> Result<CsvMetadata, AppError> {
    let path = Path::new(&path);

    if !path.exists() {
        return Err(AppError::new(
            format!("File not found: {}", path.display()),
            "FILE_NOT_FOUND",
        ));
    }

    let mut state = state.lock().await;
    let metadata = state.metadata_manager.load_metadata(path)?;

    Ok(metadata)
}

#[tauri::command]
pub async fn validate_csv_file(path: String) -> Result<bool, AppError> {
    let path = Path::new(&path);

    if !path.exists() {
        return Err(AppError::new(
            format!("File not found: {}", path.display()),
            "FILE_NOT_FOUND",
        ));
    }

    // Check file extension
    if let Some(extension) = path.extension() {
        let ext = extension.to_string_lossy().to_lowercase();
        if !["csv", "tsv"].contains(&ext.as_str()) {
            return Ok(false);
        }
    } else {
        return Ok(false);
    }

    // Try to read first few lines to validate CSV format
    let mut reader = CsvReader::new();
    match reader.read_chunk(path, 0, 5) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}