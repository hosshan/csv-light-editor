use serde::{Deserialize, Serialize};
use chrono::NaiveDate;
use regex::Regex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CleansingAction {
    TrimWhitespace,
    RemoveDuplicates,
    FillMissingValues,
    StandardizeFormat,
    RemoveOutliers,
    NormalizeText,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleansingOptions {
    pub action: CleansingAction,
    pub column_indices: Option<Vec<usize>>,
    pub parameters: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleansingResult {
    pub rows_affected: usize,
    pub cells_modified: usize,
    pub modifications: Vec<ModificationDetail>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModificationDetail {
    pub row_index: usize,
    pub column_index: usize,
    pub old_value: String,
    pub new_value: String,
}

pub struct DataCleanser;

impl DataCleanser {
    pub fn cleanse(
        data: &mut Vec<Vec<String>>,
        headers: &[String],
        options: &CleansingOptions,
    ) -> CleansingResult {
        match options.action {
            CleansingAction::TrimWhitespace => Self::trim_whitespace(data, &options.column_indices),
            CleansingAction::RemoveDuplicates => Self::remove_duplicates(data),
            CleansingAction::FillMissingValues => Self::fill_missing_values(data, options),
            CleansingAction::StandardizeFormat => Self::standardize_format(data, headers, options),
            CleansingAction::RemoveOutliers => Self::remove_outliers(data, &options.column_indices),
            CleansingAction::NormalizeText => Self::normalize_text(data, &options.column_indices),
        }
    }

    fn trim_whitespace(
        data: &mut Vec<Vec<String>>,
        column_indices: &Option<Vec<usize>>,
    ) -> CleansingResult {
        let mut modifications = Vec::new();
        let mut cells_modified = 0;

        for (row_idx, row) in data.iter_mut().enumerate() {
            for (col_idx, cell) in row.iter_mut().enumerate() {
                if let Some(indices) = column_indices {
                    if !indices.contains(&col_idx) {
                        continue;
                    }
                }

                let trimmed = cell.trim().to_string();
                if *cell != trimmed {
                    modifications.push(ModificationDetail {
                        row_index: row_idx,
                        column_index: col_idx,
                        old_value: cell.clone(),
                        new_value: trimmed.clone(),
                    });
                    *cell = trimmed;
                    cells_modified += 1;
                }
            }
        }

        CleansingResult {
            rows_affected: modifications.len(),
            cells_modified,
            modifications,
        }
    }

    fn remove_duplicates(data: &mut Vec<Vec<String>>) -> CleansingResult {
        let mut seen = std::collections::HashSet::new();
        let original_len = data.len();
        let mut modifications = Vec::new();

        data.retain(|row| {
            let key = row.join("|");
            if seen.contains(&key) {
                false
            } else {
                seen.insert(key);
                true
            }
        });

        let rows_removed = original_len - data.len();

        CleansingResult {
            rows_affected: rows_removed,
            cells_modified: 0,
            modifications,
        }
    }

    fn fill_missing_values(
        data: &mut Vec<Vec<String>>,
        options: &CleansingOptions,
    ) -> CleansingResult {
        let mut modifications = Vec::new();
        let mut cells_modified = 0;

        let fill_method = options
            .parameters
            .get("method")
            .map(|s| s.as_str())
            .unwrap_or("empty");

        let fill_value = options
            .parameters
            .get("value")
            .map(|s| s.as_str())
            .unwrap_or("");

        let column_indices = &options.column_indices;

        // Pre-calculate mean values for numeric columns if needed
        let mut column_means = std::collections::HashMap::new();
        if fill_method == "mean" {
            let max_col = data.iter().map(|r| r.len()).max().unwrap_or(0);
            for col_idx in 0..max_col {
                let numeric_values: Vec<f64> = data
                    .iter()
                    .filter_map(|r| r.get(col_idx))
                    .filter_map(|v| v.parse::<f64>().ok())
                    .collect();

                if !numeric_values.is_empty() {
                    let mean = numeric_values.iter().sum::<f64>() / numeric_values.len() as f64;
                    column_means.insert(col_idx, format!("{:.2}", mean));
                }
            }
        }

        // Collect previous values for forward_fill
        let mut previous_values: std::collections::HashMap<usize, String> = std::collections::HashMap::new();

        for (row_idx, row) in data.iter_mut().enumerate() {
            for (col_idx, cell) in row.iter_mut().enumerate() {
                if let Some(indices) = column_indices {
                    if !indices.contains(&col_idx) {
                        continue;
                    }
                }

                if cell.trim().is_empty() {
                    let new_value = match fill_method {
                        "custom" => fill_value.to_string(),
                        "forward_fill" => {
                            previous_values.get(&col_idx).cloned().unwrap_or_default()
                        }
                        "mean" => {
                            column_means.get(&col_idx).cloned().unwrap_or_default()
                        }
                        _ => String::new(),
                    };

                    if !new_value.is_empty() {
                        modifications.push(ModificationDetail {
                            row_index: row_idx,
                            column_index: col_idx,
                            old_value: cell.clone(),
                            new_value: new_value.clone(),
                        });
                        *cell = new_value.clone();
                        cells_modified += 1;
                    }
                } else {
                    // Update previous value for forward_fill
                    previous_values.insert(col_idx, cell.clone());
                }
            }
        }

        CleansingResult {
            rows_affected: modifications.len(),
            cells_modified,
            modifications,
        }
    }

    fn standardize_format(
        data: &mut Vec<Vec<String>>,
        _headers: &[String],
        options: &CleansingOptions,
    ) -> CleansingResult {
        let mut modifications = Vec::new();
        let mut cells_modified = 0;

        let format_type = options
            .parameters
            .get("type")
            .map(|s| s.as_str())
            .unwrap_or("date");

        let column_indices = &options.column_indices;

        for (row_idx, row) in data.iter_mut().enumerate() {
            for (col_idx, cell) in row.iter_mut().enumerate() {
                if let Some(indices) = column_indices {
                    if !indices.contains(&col_idx) {
                        continue;
                    }
                }

                if cell.is_empty() {
                    continue;
                }

                let new_value = match format_type {
                    "date" => Self::standardize_date(cell),
                    "number" => Self::standardize_number(cell),
                    "phone" => Self::standardize_phone(cell),
                    "email" => Self::standardize_email(cell),
                    _ => None,
                };

                if let Some(new_val) = new_value {
                    if *cell != new_val {
                        modifications.push(ModificationDetail {
                            row_index: row_idx,
                            column_index: col_idx,
                            old_value: cell.clone(),
                            new_value: new_val.clone(),
                        });
                        *cell = new_val;
                        cells_modified += 1;
                    }
                }
            }
        }

        CleansingResult {
            rows_affected: modifications.len(),
            cells_modified,
            modifications,
        }
    }

    fn standardize_date(value: &str) -> Option<String> {
        // Try different date formats and convert to ISO 8601
        let formats = vec![
            "%Y-%m-%d",
            "%d/%m/%Y",
            "%m/%d/%Y",
            "%Y/%m/%d",
            "%d-%m-%Y",
            "%m-%d-%Y",
        ];

        for format in formats {
            if let Ok(date) = NaiveDate::parse_from_str(value, format) {
                return Some(date.format("%Y-%m-%d").to_string());
            }
        }

        None
    }

    fn standardize_number(value: &str) -> Option<String> {
        // Remove commas and other formatting
        let cleaned = value.replace(",", "").replace(" ", "");
        if let Ok(num) = cleaned.parse::<f64>() {
            return Some(num.to_string());
        }
        None
    }

    fn standardize_phone(value: &str) -> Option<String> {
        // Remove all non-digit characters
        let digits: String = value.chars().filter(|c| c.is_numeric()).collect();

        if digits.len() >= 10 {
            // Format as (XXX) XXX-XXXX for 10 digits
            if digits.len() == 10 {
                return Some(format!(
                    "({}) {}-{}",
                    &digits[0..3],
                    &digits[3..6],
                    &digits[6..10]
                ));
            }
        }

        None
    }

    fn standardize_email(value: &str) -> Option<String> {
        // Convert to lowercase
        Some(value.trim().to_lowercase())
    }

    fn remove_outliers(
        data: &mut Vec<Vec<String>>,
        column_indices: &Option<Vec<usize>>,
    ) -> CleansingResult {
        let mut rows_to_remove = std::collections::HashSet::new();

        if let Some(indices) = column_indices {
            for &col_idx in indices {
                let mut numeric_values = Vec::new();

                for (row_idx, row) in data.iter().enumerate() {
                    if let Some(cell) = row.get(col_idx) {
                        if let Ok(num) = cell.parse::<f64>() {
                            numeric_values.push((row_idx, num));
                        }
                    }
                }

                if numeric_values.len() < 3 {
                    continue;
                }

                // Calculate mean and standard deviation
                let mean = numeric_values.iter().map(|(_, n)| n).sum::<f64>()
                    / numeric_values.len() as f64;
                let variance = numeric_values
                    .iter()
                    .map(|(_, n)| (n - mean).powi(2))
                    .sum::<f64>()
                    / numeric_values.len() as f64;
                let std_dev = variance.sqrt();

                if std_dev == 0.0 {
                    continue;
                }

                // Mark outliers (Z-score > 3)
                for (row_idx, num) in numeric_values {
                    let z_score = ((num - mean) / std_dev).abs();
                    if z_score > 3.0 {
                        rows_to_remove.insert(row_idx);
                    }
                }
            }
        }

        let original_len = data.len();
        let mut sorted_indices: Vec<_> = rows_to_remove.into_iter().collect();
        sorted_indices.sort_by(|a, b| b.cmp(a)); // Sort in reverse order

        for idx in sorted_indices {
            if idx < data.len() {
                data.remove(idx);
            }
        }

        let rows_removed = original_len - data.len();

        CleansingResult {
            rows_affected: rows_removed,
            cells_modified: 0,
            modifications: Vec::new(),
        }
    }

    fn normalize_text(
        data: &mut Vec<Vec<String>>,
        column_indices: &Option<Vec<usize>>,
    ) -> CleansingResult {
        let mut modifications = Vec::new();
        let mut cells_modified = 0;

        let whitespace_regex = Regex::new(r"\s+").unwrap();

        for (row_idx, row) in data.iter_mut().enumerate() {
            for (col_idx, cell) in row.iter_mut().enumerate() {
                if let Some(indices) = column_indices {
                    if !indices.contains(&col_idx) {
                        continue;
                    }
                }

                // Normalize whitespace
                let normalized = whitespace_regex.replace_all(cell, " ").trim().to_string();

                if *cell != normalized {
                    modifications.push(ModificationDetail {
                        row_index: row_idx,
                        column_index: col_idx,
                        old_value: cell.clone(),
                        new_value: normalized.clone(),
                    });
                    *cell = normalized;
                    cells_modified += 1;
                }
            }
        }

        CleansingResult {
            rows_affected: modifications.len(),
            cells_modified,
            modifications,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trim_whitespace() {
        let mut data = vec![
            vec!["  John  ".to_string(), "  Doe  ".to_string()],
            vec!["Jane".to_string(), "Smith  ".to_string()],
        ];

        let options = CleansingOptions {
            action: CleansingAction::TrimWhitespace,
            column_indices: None,
            parameters: std::collections::HashMap::new(),
        };

        let result = DataCleanser::cleanse(&mut data, &[], &options);
        assert_eq!(result.cells_modified, 3);
        assert_eq!(data[0][0], "John");
    }

    #[test]
    fn test_remove_duplicates() {
        let mut data = vec![
            vec!["John".to_string(), "25".to_string()],
            vec!["Jane".to_string(), "30".to_string()],
            vec!["John".to_string(), "25".to_string()],
        ];

        let options = CleansingOptions {
            action: CleansingAction::RemoveDuplicates,
            column_indices: None,
            parameters: std::collections::HashMap::new(),
        };

        let result = DataCleanser::cleanse(&mut data, &[], &options);
        assert_eq!(result.rows_affected, 1);
        assert_eq!(data.len(), 2);
    }

    #[test]
    fn test_standardize_date() {
        assert_eq!(
            DataCleanser::standardize_date("01/15/2024"),
            Some("2024-01-15".to_string())
        );
        assert_eq!(
            DataCleanser::standardize_date("2024-01-15"),
            Some("2024-01-15".to_string())
        );
    }
}
