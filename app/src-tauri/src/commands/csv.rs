use std::path::{Path, PathBuf};
use std::fs;
use tauri::State;
use crate::csv_engine::{reader::CsvReader, writer::CsvWriter};
use crate::csv_engine::reader::CsvData;
use crate::csv_engine::data_types::{DataType, DataTypeDetector};
use crate::csv_engine::validation::{ValidationRule, Validator, ValidationError as CustomValidationError};
use crate::csv_engine::quality::QualityAnalyzer;
use crate::csv_engine::cleansing::{DataCleanser, CleansingOptions, CleansingResult};
use crate::csv_engine::export::{Exporter, ExportFormat, ExportOptions};
use crate::metadata::CsvMetadata;
use crate::state::AppState;
use crate::utils::AppError;
use encoding_rs::{UTF_8, SHIFT_JIS, EUC_JP};
use chrono::Local;
use serde::{Deserialize, Serialize};

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

    // Always detect encoding and delimiter from the file itself
    let mut reader = CsvReader::new();
    let csv_data = reader.read_file(path)?;

    let mut state = state.lock().await;
    state.current_file = Some(path.to_path_buf());

    // Load metadata for user preferences (not for encoding/delimiter)
    state.metadata_manager.load_metadata(path).ok();

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
    let (encoding_type, encoding_name) = match encoding.as_deref() {
        Some("shift_jis") => (SHIFT_JIS, "Shift_JIS"),
        Some("euc_jp") => (EUC_JP, "EUC-JP"),
        Some("utf8") | _ => (UTF_8, "UTF-8"),
    };

    let writer = CsvWriter::new()
        .with_delimiter(delimiter)
        .with_encoding(encoding_type);

    writer.write_file(path, &data)?;

    // Update metadata with the actual encoding used
    let mut updated_metadata = data.metadata.clone();
    updated_metadata.encoding = encoding_name.to_string();
    updated_metadata.delimiter = match delimiter {
        b'\t' => "\t".to_string(),
        _ => String::from_utf8(vec![delimiter]).unwrap_or(",".to_string()),
    };

    let mut state = state.lock().await;
    state.current_file = Some(path.to_path_buf());
    state.metadata_manager.save_metadata(path, &updated_metadata)?;

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

#[tauri::command]
pub async fn add_column(
    mut data: CsvData,
    column_name: String,
    position: Option<usize>,
) -> Result<CsvData, AppError> {
    // Add to headers
    let position = position.unwrap_or(data.headers.len());
    if position > data.headers.len() {
        return Err(AppError::new(
            "Invalid column position".to_string(),
            "INVALID_POSITION",
        ));
    }
    data.headers.insert(position, column_name);

    // Add empty values to all rows
    for row in &mut data.rows {
        row.insert(position, String::new());
    }

    // Update metadata
    data.metadata.column_count = data.headers.len();

    Ok(data)
}

#[tauri::command]
pub async fn delete_column(
    mut data: CsvData,
    column_index: usize,
) -> Result<CsvData, AppError> {
    if column_index >= data.headers.len() {
        return Err(AppError::new(
            "Invalid column index".to_string(),
            "INVALID_INDEX",
        ));
    }

    // Remove from headers
    data.headers.remove(column_index);

    // Remove from all rows
    for row in &mut data.rows {
        if column_index < row.len() {
            row.remove(column_index);
        }
    }

    // Update metadata
    data.metadata.column_count = data.headers.len();

    Ok(data)
}

#[tauri::command]
pub async fn rename_column(
    mut data: CsvData,
    column_index: usize,
    new_name: String,
) -> Result<CsvData, AppError> {
    if column_index >= data.headers.len() {
        return Err(AppError::new(
            "Invalid column index".to_string(),
            "INVALID_INDEX",
        ));
    }

    data.headers[column_index] = new_name;

    Ok(data)
}

#[tauri::command]
pub async fn add_row(
    mut data: CsvData,
    row_index: Option<usize>,
) -> Result<CsvData, AppError> {
    let new_row = vec![String::new(); data.headers.len()];
    let position = row_index.unwrap_or(data.rows.len());

    if position > data.rows.len() {
        return Err(AppError::new(
            "Invalid row position".to_string(),
            "INVALID_POSITION",
        ));
    }

    data.rows.insert(position, new_row);
    data.metadata.row_count = data.rows.len();

    Ok(data)
}

#[tauri::command]
pub async fn delete_row(
    mut data: CsvData,
    row_index: usize,
) -> Result<CsvData, AppError> {
    if row_index >= data.rows.len() {
        return Err(AppError::new(
            "Invalid row index".to_string(),
            "INVALID_INDEX",
        ));
    }

    data.rows.remove(row_index);
    data.metadata.row_count = data.rows.len();

    Ok(data)
}

#[tauri::command]
pub async fn duplicate_row(
    mut data: CsvData,
    row_index: usize,
) -> Result<CsvData, AppError> {
    if row_index >= data.rows.len() {
        return Err(AppError::new(
            "Invalid row index".to_string(),
            "INVALID_INDEX",
        ));
    }

    let row_to_duplicate = data.rows[row_index].clone();
    data.rows.insert(row_index + 1, row_to_duplicate);
    data.metadata.row_count = data.rows.len();

    Ok(data)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ColumnTypeInfo {
    pub column_index: usize,
    pub column_name: String,
    pub detected_type: DataType,
    pub sample_values: Vec<String>,
}

#[tauri::command]
pub async fn detect_column_types(
    data: CsvData,
) -> Result<Vec<ColumnTypeInfo>, AppError> {
    let detector = DataTypeDetector::new();
    let mut column_types = Vec::new();

    for (index, header) in data.headers.iter().enumerate() {
        let column_values: Vec<String> = data.rows
            .iter()
            .take(100) // Sample first 100 rows for type detection
            .filter_map(|row| row.get(index))
            .cloned()
            .collect();

        let detected_type = detector.detect_column_type(&column_values);

        let sample_values = column_values
            .into_iter()
            .take(5)
            .collect();

        column_types.push(ColumnTypeInfo {
            column_index: index,
            column_name: header.clone(),
            detected_type,
            sample_values,
        });
    }

    Ok(column_types)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationResult {
    pub is_valid: bool,
    pub errors: Vec<ValidationError>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationError {
    pub row_index: usize,
    pub column_index: usize,
    pub value: String,
    pub expected_type: DataType,
    pub message: String,
}

#[tauri::command]
pub async fn validate_data_types(
    data: CsvData,
    column_types: Vec<(usize, DataType)>,
) -> Result<ValidationResult, AppError> {
    let detector = DataTypeDetector::new();
    let mut errors = Vec::new();

    for (row_index, row) in data.rows.iter().enumerate() {
        for (column_index, expected_type) in &column_types {
            if let Some(value) = row.get(*column_index) {
                if !value.is_empty() && !detector.validate_value(value, expected_type) {
                    errors.push(ValidationError {
                        row_index,
                        column_index: *column_index,
                        value: value.clone(),
                        expected_type: expected_type.clone(),
                        message: format!(
                            "Value '{}' is not a valid {}",
                            value,
                            format!("{:?}", expected_type).to_lowercase()
                        ),
                    });
                }
            }
        }
    }

    Ok(ValidationResult {
        is_valid: errors.is_empty(),
        errors,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FindOptions {
    pub search_text: String,
    pub case_sensitive: bool,
    pub whole_word: bool,
    pub regex: bool,
    pub column_index: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub row_index: usize,
    pub column_index: usize,
    pub value: String,
    pub context: String,
}

#[tauri::command]
pub async fn find_in_csv(
    data: CsvData,
    options: FindOptions,
) -> Result<Vec<SearchResult>, AppError> {
    let mut results = Vec::new();

    let search_regex = if options.regex {
        match regex::Regex::new(&options.search_text) {
            Ok(re) => Some(re),
            Err(e) => return Err(AppError::new(
                format!("Invalid regex pattern: {}", e),
                "INVALID_REGEX",
            )),
        }
    } else {
        None
    };

    for (row_index, row) in data.rows.iter().enumerate() {
        let columns_to_search = if let Some(col_idx) = options.column_index {
            vec![col_idx]
        } else {
            (0..row.len()).collect()
        };

        for column_index in columns_to_search {
            if let Some(value) = row.get(column_index) {
                let matches = if let Some(ref regex) = search_regex {
                    regex.is_match(value)
                } else if options.whole_word {
                    let search = if options.case_sensitive {
                        &options.search_text
                    } else {
                        &options.search_text.to_lowercase()
                    };
                    let val = if options.case_sensitive {
                        value.clone()
                    } else {
                        value.to_lowercase()
                    };
                    val.split_whitespace().any(|word| word == search)
                } else if options.case_sensitive {
                    value.contains(&options.search_text)
                } else {
                    value.to_lowercase().contains(&options.search_text.to_lowercase())
                };

                if matches {
                    let context = if value.len() > 100 {
                        format!("{}...", &value[..100])
                    } else {
                        value.clone()
                    };

                    results.push(SearchResult {
                        row_index,
                        column_index,
                        value: value.clone(),
                        context,
                    });
                }
            }
        }
    }

    Ok(results)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReplaceOptions {
    pub find_options: FindOptions,
    pub replace_text: String,
    pub preview_only: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReplaceResult {
    pub replaced_count: usize,
    pub data: Option<CsvData>,
    pub preview: Vec<ReplacePreview>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReplacePreview {
    pub row_index: usize,
    pub column_index: usize,
    pub original_value: String,
    pub new_value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SortDirection {
    Ascending,
    Descending,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SortColumn {
    pub column_index: usize,
    pub direction: SortDirection,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SortState {
    pub columns: Vec<SortColumn>,
}

#[tauri::command]
pub async fn replace_in_csv(
    mut data: CsvData,
    options: ReplaceOptions,
) -> Result<ReplaceResult, AppError> {
    let mut preview = Vec::new();
    let mut replaced_count = 0;

    let search_regex = if options.find_options.regex {
        match regex::Regex::new(&options.find_options.search_text) {
            Ok(re) => Some(re),
            Err(e) => return Err(AppError::new(
                format!("Invalid regex pattern: {}", e),
                "INVALID_REGEX",
            )),
        }
    } else {
        None
    };

    for (row_index, row) in data.rows.iter_mut().enumerate() {
        let columns_to_search = if let Some(col_idx) = options.find_options.column_index {
            vec![col_idx]
        } else {
            (0..row.len()).collect()
        };

        for column_index in columns_to_search {
            if let Some(value) = row.get_mut(column_index) {
                let original_value = value.clone();
                let mut new_value = original_value.clone();
                let mut was_replaced = false;

                if let Some(ref regex) = search_regex {
                    if regex.is_match(&original_value) {
                        new_value = regex.replace_all(&original_value, &options.replace_text).to_string();
                        was_replaced = true;
                    }
                } else if options.find_options.whole_word {
                    let words: Vec<String> = original_value.split_whitespace()
                        .map(|word| {
                            if options.find_options.case_sensitive {
                                if word == options.find_options.search_text {
                                    options.replace_text.clone()
                                } else {
                                    word.to_string()
                                }
                            } else {
                                if word.to_lowercase() == options.find_options.search_text.to_lowercase() {
                                    options.replace_text.clone()
                                } else {
                                    word.to_string()
                                }
                            }
                        })
                        .collect();
                    new_value = words.join(" ");
                    was_replaced = new_value != original_value;
                } else if options.find_options.case_sensitive {
                    new_value = original_value.replace(&options.find_options.search_text, &options.replace_text);
                    was_replaced = new_value != original_value;
                } else {
                    // Case-insensitive replace (more complex)
                    let lower_original = original_value.to_lowercase();
                    let lower_search = options.find_options.search_text.to_lowercase();
                    if lower_original.contains(&lower_search) {
                        // Simple implementation for case-insensitive replace
                        new_value = original_value.replace(&options.find_options.search_text, &options.replace_text);
                        was_replaced = true;
                    }
                }

                if was_replaced {
                    replaced_count += 1;
                    preview.push(ReplacePreview {
                        row_index,
                        column_index,
                        original_value: original_value.clone(),
                        new_value: new_value.clone(),
                    });

                    if !options.preview_only {
                        *value = new_value;
                    }
                }
            }
        }
    }

    Ok(ReplaceResult {
        replaced_count,
        data: if options.preview_only { None } else { Some(data) },
        preview,
    })
}

fn compare_values(a: &str, b: &str, direction: &SortDirection) -> std::cmp::Ordering {
    use std::cmp::Ordering;

    // Try to parse as numbers first
    if let (Ok(num_a), Ok(num_b)) = (a.parse::<f64>(), b.parse::<f64>()) {
        let cmp = num_a.partial_cmp(&num_b).unwrap_or(Ordering::Equal);
        return match direction {
            SortDirection::Ascending => cmp,
            SortDirection::Descending => cmp.reverse(),
        };
    }

    // Try to parse as dates
    if let (Ok(date_a), Ok(date_b)) = (
        chrono::NaiveDate::parse_from_str(a, "%Y-%m-%d").or_else(|_| chrono::NaiveDate::parse_from_str(a, "%m/%d/%Y")),
        chrono::NaiveDate::parse_from_str(b, "%Y-%m-%d").or_else(|_| chrono::NaiveDate::parse_from_str(b, "%m/%d/%Y")),
    ) {
        let cmp = date_a.cmp(&date_b);
        return match direction {
            SortDirection::Ascending => cmp,
            SortDirection::Descending => cmp.reverse(),
        };
    }

    // Fall back to string comparison
    let cmp = a.cmp(b);
    match direction {
        SortDirection::Ascending => cmp,
        SortDirection::Descending => cmp.reverse(),
    }
}

#[tauri::command]
pub async fn sort_csv_data(
    mut data: CsvData,
    sort_state: SortState,
) -> Result<CsvData, AppError> {
    if sort_state.columns.is_empty() {
        return Ok(data);
    }

    // Validate column indices
    for sort_col in &sort_state.columns {
        if sort_col.column_index >= data.headers.len() {
            return Err(AppError::new(
                format!("Invalid column index: {}", sort_col.column_index),
                "INVALID_COLUMN_INDEX",
            ));
        }
    }

    // Create vector of (original_index, row) tuples for stable sorting
    let mut rows_with_indices: Vec<(usize, &Vec<String>)> = data.rows
        .iter()
        .enumerate()
        .collect();

    // Sort the rows
    rows_with_indices.sort_by(|a, b| {
        for sort_col in &sort_state.columns {
            let val_a = a.1.get(sort_col.column_index).map(|s| s.as_str()).unwrap_or("");
            let val_b = b.1.get(sort_col.column_index).map(|s| s.as_str()).unwrap_or("");

            let cmp = compare_values(val_a, val_b, &sort_col.direction);
            if cmp != std::cmp::Ordering::Equal {
                return cmp;
            }
        }

        // If all sort columns are equal, maintain original order (stable sort)
        a.0.cmp(&b.0)
    });

    // Extract the sorted rows
    data.rows = rows_with_indices
        .into_iter()
        .map(|(_, row)| row.clone())
        .collect();

    Ok(data)
}

#[tauri::command]
pub async fn save_sort_state(
    path: String,
    sort_state: SortState,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let path = Path::new(&path);

    let mut state = state.lock().await;

    // Load current metadata
    let mut metadata = state.metadata_manager.load_metadata(path)?;

    // Update sort state
    metadata.sort_state = Some(sort_state);

    // Save updated metadata
    state.metadata_manager.save_metadata(path, &metadata)?;

    Ok(())
}

#[tauri::command]
pub async fn load_sort_state(
    path: String,
    state: State<'_, AppState>,
) -> Result<Option<SortState>, AppError> {
    let path = Path::new(&path);

    let mut state = state.lock().await;
    let metadata = state.metadata_manager.load_metadata(path)?;

    Ok(metadata.sort_state)
}

#[tauri::command]
pub async fn move_row(
    mut data: CsvData,
    from_index: usize,
    to_index: usize,
) -> Result<CsvData, AppError> {
    if from_index >= data.rows.len() || to_index > data.rows.len() {
        return Err(AppError::new(
            "Invalid row index for move operation".to_string(),
            "INVALID_ROW_INDEX",
        ));
    }

    if from_index == to_index {
        return Ok(data);
    }

    // Remove the row from its current position
    let row_to_move = data.rows.remove(from_index);

    // Calculate the new insertion index
    let insert_index = if to_index > from_index {
        to_index - 1
    } else {
        to_index
    };

    // Insert the row at the new position
    data.rows.insert(insert_index, row_to_move);

    Ok(data)
}

#[tauri::command]
pub async fn move_column(
    mut data: CsvData,
    from_index: usize,
    to_index: usize,
) -> Result<CsvData, AppError> {
    if from_index >= data.headers.len() || to_index > data.headers.len() {
        return Err(AppError::new(
            "Invalid column index for move operation".to_string(),
            "INVALID_COLUMN_INDEX",
        ));
    }

    if from_index == to_index {
        return Ok(data);
    }

    // Calculate the new insertion index
    let insert_index = if to_index > from_index {
        to_index - 1
    } else {
        to_index
    };

    // Move the header
    let header_to_move = data.headers.remove(from_index);
    data.headers.insert(insert_index, header_to_move);

    // Move the data in all rows
    for row in &mut data.rows {
        if from_index < row.len() {
            let cell_to_move = row.remove(from_index);
            // Ensure the row has enough columns
            while row.len() <= insert_index {
                row.push(String::new());
            }
            row.insert(insert_index, cell_to_move);
        }
    }

    // Update metadata
    data.metadata.column_count = data.headers.len();

    Ok(data)
}

// Custom Validation Rules
#[tauri::command]
pub async fn validate_with_rules(
    data: CsvData,
    rules: Vec<ValidationRule>,
) -> Result<Vec<CustomValidationError>, AppError> {
    let validator = Validator::new(rules);
    let errors = validator.validate(&data.rows, &data.headers);
    Ok(errors)
}

// Data Quality Report
#[tauri::command]
pub async fn generate_quality_report(
    data: CsvData,
) -> Result<crate::csv_engine::quality::QualityReport, AppError> {
    let report = QualityAnalyzer::analyze(&data.rows, &data.headers);
    Ok(report)
}

// Data Cleansing
#[tauri::command]
pub async fn cleanse_data(
    mut data: CsvData,
    options: CleansingOptions,
) -> Result<(CsvData, CleansingResult), AppError> {
    let result = DataCleanser::cleanse(&mut data.rows, &data.headers, &options);

    // Update metadata
    data.metadata.row_count = data.rows.len();

    Ok((data, result))
}

// Export to various formats
#[tauri::command]
pub async fn export_data(
    path: String,
    data: CsvData,
    options: ExportOptions,
) -> Result<(), AppError> {
    let path = Path::new(&path);
    Exporter::export(path, &data, &options)?;
    Ok(())
}

// Generate export preview
#[tauri::command]
pub async fn generate_export_preview(
    data: CsvData,
    options: ExportOptions,
    max_rows: usize,
) -> Result<String, AppError> {
    let preview = Exporter::generate_preview(&data, &options, max_rows)?;
    Ok(preview)
}

// Copy to clipboard
#[tauri::command]
pub async fn copy_to_clipboard(
    data: CsvData,
    options: ExportOptions,
    app_handle: tauri::AppHandle,
) -> Result<(), AppError> {
    // Generate the full export string
    let export_string = Exporter::generate_preview(&data, &options, data.rows.len())?;

    // Use Tauri's clipboard API
    app_handle
        .clipboard_manager()
        .write_text(export_string)
        .map_err(|e| AppError::new(
            format!("Failed to copy to clipboard: {}", e),
            "CLIPBOARD_ERROR",
        ))?;

    Ok(())
}