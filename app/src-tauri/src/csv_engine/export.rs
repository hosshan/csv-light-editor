use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs::File;
use std::io::Write;
use std::path::Path;
use crate::csv_engine::reader::CsvData;
use crate::utils::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Csv,
    Tsv,
    Markdown,
    JsonArray,
    JsonObject,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportOptions {
    pub format: ExportFormat,
    pub include_headers: bool,
    pub pretty_print: bool,
}

pub struct Exporter;

impl Exporter {
    /// Export CSV data to various formats
    pub fn export(
        path: &Path,
        data: &CsvData,
        options: &ExportOptions,
    ) -> Result<(), AppError> {
        match options.format {
            ExportFormat::Csv => Self::export_csv(path, data, options),
            ExportFormat::Tsv => Self::export_tsv(path, data, options),
            ExportFormat::Markdown => Self::export_markdown(path, data, options),
            ExportFormat::JsonArray => Self::export_json_array(path, data, options),
            ExportFormat::JsonObject => Self::export_json_object(path, data, options),
        }
    }

    /// Generate preview string for the export
    pub fn generate_preview(
        data: &CsvData,
        options: &ExportOptions,
        max_rows: usize,
    ) -> Result<String, AppError> {
        let preview_data = CsvData {
            headers: data.headers.clone(),
            rows: data.rows.iter().take(max_rows).cloned().collect(),
            metadata: data.metadata.clone(),
        };

        match options.format {
            ExportFormat::Csv => Self::generate_csv_string(&preview_data, options),
            ExportFormat::Tsv => Self::generate_tsv_string(&preview_data, options),
            ExportFormat::Markdown => Self::generate_markdown_string(&preview_data, options),
            ExportFormat::JsonArray => Self::generate_json_array_string(&preview_data, options),
            ExportFormat::JsonObject => Self::generate_json_object_string(&preview_data, options),
        }
    }

    fn export_csv(path: &Path, data: &CsvData, options: &ExportOptions) -> Result<(), AppError> {
        let content = Self::generate_csv_string(data, options)?;
        Self::write_file(path, &content)
    }

    fn export_tsv(path: &Path, data: &CsvData, options: &ExportOptions) -> Result<(), AppError> {
        let content = Self::generate_tsv_string(data, options)?;
        Self::write_file(path, &content)
    }

    fn export_markdown(
        path: &Path,
        data: &CsvData,
        options: &ExportOptions,
    ) -> Result<(), AppError> {
        let content = Self::generate_markdown_string(data, options)?;
        Self::write_file(path, &content)
    }

    fn export_json_array(
        path: &Path,
        data: &CsvData,
        options: &ExportOptions,
    ) -> Result<(), AppError> {
        let content = Self::generate_json_array_string(data, options)?;
        Self::write_file(path, &content)
    }

    fn export_json_object(
        path: &Path,
        data: &CsvData,
        options: &ExportOptions,
    ) -> Result<(), AppError> {
        let content = Self::generate_json_object_string(data, options)?;
        Self::write_file(path, &content)
    }

    fn generate_csv_string(data: &CsvData, options: &ExportOptions) -> Result<String, AppError> {
        let mut content = String::new();

        if options.include_headers {
            content.push_str(&data.headers.join(","));
            content.push('\n');
        }

        for row in &data.rows {
            let escaped_row: Vec<String> = row
                .iter()
                .map(|cell| {
                    if cell.contains(',') || cell.contains('"') || cell.contains('\n') {
                        format!("\"{}\"", cell.replace('"', "\"\""))
                    } else {
                        cell.clone()
                    }
                })
                .collect();
            content.push_str(&escaped_row.join(","));
            content.push('\n');
        }

        Ok(content)
    }

    fn generate_tsv_string(data: &CsvData, options: &ExportOptions) -> Result<String, AppError> {
        let mut content = String::new();

        if options.include_headers {
            content.push_str(&data.headers.join("\t"));
            content.push('\n');
        }

        for row in &data.rows {
            content.push_str(&row.join("\t"));
            content.push('\n');
        }

        Ok(content)
    }

    fn generate_markdown_string(
        data: &CsvData,
        options: &ExportOptions,
    ) -> Result<String, AppError> {
        let mut content = String::new();

        // Calculate column widths
        let mut col_widths: Vec<usize> = data
            .headers
            .iter()
            .map(|h| h.len())
            .collect();

        for row in &data.rows {
            for (i, cell) in row.iter().enumerate() {
                if i < col_widths.len() {
                    col_widths[i] = col_widths[i].max(cell.len());
                }
            }
        }

        // Generate header
        if options.include_headers {
            content.push_str("| ");
            for (i, header) in data.headers.iter().enumerate() {
                content.push_str(&format!("{:<width$} | ", header, width = col_widths[i]));
            }
            content.push('\n');

            // Generate separator
            content.push_str("| ");
            for width in &col_widths {
                content.push_str(&format!("{:-<width$} | ", "", width = width));
            }
            content.push('\n');
        }

        // Generate rows
        for row in &data.rows {
            content.push_str("| ");
            for (i, cell) in row.iter().enumerate() {
                let width = col_widths.get(i).copied().unwrap_or(0);
                content.push_str(&format!("{:<width$} | ", cell, width = width));
            }
            content.push('\n');
        }

        Ok(content)
    }

    fn generate_json_array_string(
        data: &CsvData,
        options: &ExportOptions,
    ) -> Result<String, AppError> {
        let array: Vec<Vec<String>> = if options.include_headers {
            std::iter::once(data.headers.clone())
                .chain(data.rows.clone())
                .collect()
        } else {
            data.rows.clone()
        };

        let json_string = if options.pretty_print {
            serde_json::to_string_pretty(&array)
        } else {
            serde_json::to_string(&array)
        };

        json_string.map_err(|e| AppError::new(
            format!("Failed to serialize to JSON: {}", e),
            "JSON_SERIALIZATION_ERROR",
        ))
    }

    fn generate_json_object_string(
        data: &CsvData,
        options: &ExportOptions,
    ) -> Result<String, AppError> {
        let objects: Vec<serde_json::Value> = data
            .rows
            .iter()
            .map(|row| {
                let mut obj = serde_json::Map::new();
                for (i, header) in data.headers.iter().enumerate() {
                    let value = row.get(i).cloned().unwrap_or_default();
                    obj.insert(header.clone(), json!(value));
                }
                json!(obj)
            })
            .collect();

        let json_string = if options.pretty_print {
            serde_json::to_string_pretty(&objects)
        } else {
            serde_json::to_string(&objects)
        };

        json_string.map_err(|e| AppError::new(
            format!("Failed to serialize to JSON: {}", e),
            "JSON_SERIALIZATION_ERROR",
        ))
    }

    fn write_file(path: &Path, content: &str) -> Result<(), AppError> {
        let mut file = File::create(path).map_err(|e| {
            AppError::new(
                format!("Failed to create file: {}", e),
                "FILE_CREATE_ERROR",
            )
        })?;

        file.write_all(content.as_bytes()).map_err(|e| {
            AppError::new(format!("Failed to write file: {}", e), "FILE_WRITE_ERROR")
        })?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::metadata::CsvMetadata;

    fn create_test_data() -> CsvData {
        CsvData {
            headers: vec!["Name".to_string(), "Age".to_string(), "City".to_string()],
            rows: vec![
                vec!["Alice".to_string(), "30".to_string(), "NYC".to_string()],
                vec!["Bob".to_string(), "25".to_string(), "LA".to_string()],
            ],
            metadata: CsvMetadata {
                row_count: 2,
                column_count: 3,
                encoding: "UTF-8".to_string(),
                delimiter: ",".to_string(),
                has_headers: true,
            },
        }
    }

    #[test]
    fn test_generate_markdown() {
        let data = create_test_data();
        let options = ExportOptions {
            format: ExportFormat::Markdown,
            include_headers: true,
            pretty_print: false,
        };

        let result = Exporter::generate_markdown_string(&data, &options).unwrap();
        assert!(result.contains("| Name"));
        assert!(result.contains("| Alice"));
        assert!(result.contains("|---"));
    }

    #[test]
    fn test_generate_json_object() {
        let data = create_test_data();
        let options = ExportOptions {
            format: ExportFormat::JsonObject,
            include_headers: true,
            pretty_print: true,
        };

        let result = Exporter::generate_json_object_string(&data, &options).unwrap();
        assert!(result.contains("\"Name\""));
        assert!(result.contains("\"Alice\""));
    }

    #[test]
    fn test_generate_json_array() {
        let data = create_test_data();
        let options = ExportOptions {
            format: ExportFormat::JsonArray,
            include_headers: true,
            pretty_print: false,
        };

        let result = Exporter::generate_json_array_string(&data, &options).unwrap();
        assert!(result.contains("Name"));
        assert!(result.contains("Alice"));
    }

    #[test]
    fn test_generate_tsv() {
        let data = create_test_data();
        let options = ExportOptions {
            format: ExportFormat::Tsv,
            include_headers: true,
            pretty_print: false,
        };

        let result = Exporter::generate_tsv_string(&data, &options).unwrap();
        assert!(result.contains("Name\tAge\tCity"));
        assert!(result.contains("Alice\t30\tNYC"));
    }
}
