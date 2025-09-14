use std::path::{Path, PathBuf};
use std::fs;
use tauri::State;
use crate::csv_engine::{CsvReader, CsvWriter};
use crate::csv_engine::reader::CsvData;
use crate::metadata::CsvMetadata;
use crate::state::AppState;
use crate::utils::AppError;
use encoding_rs::{UTF_8, SHIFT_JIS, EUC_JP};
use chrono::Local;

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

    let mut state = state.lock().await;
    state.current_file = Some(path.to_path_buf());
    state.metadata_manager.save_metadata(path, &data.metadata)?;

    Ok(())
}

#[tauri::command]
pub async fn save_csv_file_as(
    path: String,
    data: CsvData,
    format: Option<String>,
    encoding: Option<String>,
    create_backup: bool,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let path = Path::new(&path);

    // Create backup if requested and file exists
    if create_backup && path.exists() {
        let backup_path = create_backup_path(path)?;
        fs::copy(path, &backup_path)
            .map_err(|e| AppError::new(format!("Failed to create backup: {}", e), "BACKUP_ERROR"))?;
    }

    // Determine delimiter based on format
    let delimiter = match format.as_deref() {
        Some("tsv") => b'\t',
        Some("csv") | _ => b',',
    };

    // Determine encoding
    let encoding_type = match encoding.as_deref() {
        Some("shift_jis") => SHIFT_JIS,
        Some("euc_jp") => EUC_JP,
        Some("utf8") | _ => UTF_8,
    };

    let writer = CsvWriter::new()
        .with_delimiter(delimiter)
        .with_encoding(encoding_type);

    writer.write_file(path, &data)?;

    let mut state = state.lock().await;
    state.current_file = Some(path.to_path_buf());
    state.metadata_manager.save_metadata(path, &data.metadata)?;

    Ok(())
}

fn create_backup_path(original_path: &Path) -> Result<PathBuf, AppError> {
    let timestamp = Local::now().format("%Y%m%d_%H%M%S");
    let file_stem = original_path.file_stem()
        .ok_or_else(|| AppError::new("Invalid file path".to_string(), "INVALID_PATH"))?;
    let extension = original_path.extension()
        .ok_or_else(|| AppError::new("No file extension".to_string(), "NO_EXTENSION"))?;

    let backup_name = format!(
        "{}_{}.{}.bak",
        file_stem.to_string_lossy(),
        timestamp,
        extension.to_string_lossy()
    );

    let parent = original_path.parent()
        .ok_or_else(|| AppError::new("No parent directory".to_string(), "NO_PARENT"))?;

    Ok(parent.join(backup_name))
}

#[tauri::command]
pub async fn get_current_file(
    state: State<'_, AppState>,
) -> Result<Option<String>, AppError> {
    let state = state.lock().await;
    Ok(state.current_file.as_ref().map(|p| p.to_string_lossy().to_string()))
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