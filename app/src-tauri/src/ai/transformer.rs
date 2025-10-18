use anyhow::{Result, anyhow};
use chrono::NaiveDate;
use regex::Regex;

use super::{TransformOperation, TargetScope, DataChange};

/// Performs data transformations on CSV data
#[derive(Debug)]
pub struct DataTransformer;

impl DataTransformer {
    pub fn new() -> Self {
        Self
    }

    pub fn transform(
        &self,
        operation: &TransformOperation,
        headers: &[String],
        rows: &[Vec<String>],
        scope: &TargetScope,
    ) -> Result<Vec<DataChange>> {
        match operation {
            TransformOperation::Normalize => self.normalize(headers, rows, scope),
            TransformOperation::FormatDates { target_format } => {
                self.format_dates(headers, rows, scope, target_format)
            }
            TransformOperation::FormatNumbers { decimal_places } => {
                self.format_numbers(headers, rows, scope, *decimal_places)
            }
            TransformOperation::RemoveDuplicates => {
                self.remove_duplicates(headers, rows, scope)
            }
            TransformOperation::FillMissing { strategy } => {
                self.fill_missing(headers, rows, scope, strategy)
            }
            TransformOperation::Capitalize => self.capitalize(headers, rows, scope),
            TransformOperation::Lowercase => self.lowercase(headers, rows, scope),
            TransformOperation::Uppercase => self.uppercase(headers, rows, scope),
            TransformOperation::Trim => self.trim(headers, rows, scope),
            TransformOperation::Replace { from, to } => {
                self.replace(headers, rows, scope, from, to)
            }
        }
    }

    fn normalize(
        &self,
        headers: &[String],
        rows: &[Vec<String>],
        scope: &TargetScope,
    ) -> Result<Vec<DataChange>> {
        let target_columns = self.get_target_column_indices(headers, scope)?;
        let mut changes = Vec::new();

        for &col_idx in &target_columns {
            let values: Vec<f64> = rows
                .iter()
                .enumerate()
                .filter_map(|(_, row)| {
                    row.get(col_idx)
                        .and_then(|v| v.trim().parse::<f64>().ok())
                })
                .collect();

            if values.is_empty() {
                continue;
            }

            let min = values.iter().cloned().fold(f64::INFINITY, f64::min);
            let max = values.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
            let range = max - min;

            if range == 0.0 {
                continue;
            }

            for (row_idx, row) in rows.iter().enumerate() {
                if let Some(old_value) = row.get(col_idx) {
                    if let Ok(value) = old_value.trim().parse::<f64>() {
                        let normalized = (value - min) / range;
                        let new_value = format!("{:.6}", normalized);

                        if old_value != &new_value {
                            changes.push(DataChange {
                                row_index: row_idx,
                                column_index: col_idx,
                                old_value: old_value.clone(),
                                new_value,
                            });
                        }
                    }
                }
            }
        }

        Ok(changes)
    }

    fn format_dates(
        &self,
        headers: &[String],
        rows: &[Vec<String>],
        scope: &TargetScope,
        target_format: &str,
    ) -> Result<Vec<DataChange>> {
        let target_columns = self.get_target_column_indices(headers, scope)?;
        let mut changes = Vec::new();

        let date_patterns = vec![
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%d-%m-%Y",
            "%d/%m/%Y",
            "%m/%d/%Y",
            "%Y%m%d",
            "%d.%m.%Y",
        ];

        let output_format = match target_format {
            "YYYY-MM-DD" => "%Y-%m-%d",
            "DD/MM/YYYY" => "%d/%m/%Y",
            "MM/DD/YYYY" => "%m/%d/%Y",
            _ => "%Y-%m-%d",
        };

        for &col_idx in &target_columns {
            for (row_idx, row) in rows.iter().enumerate() {
                if let Some(old_value) = row.get(col_idx) {
                    let trimmed = old_value.trim();
                    if trimmed.is_empty() {
                        continue;
                    }

                    // Try to parse with different formats
                    for pattern in &date_patterns {
                        if let Ok(date) = NaiveDate::parse_from_str(trimmed, pattern) {
                            let new_value = date.format(output_format).to_string();
                            if old_value != &new_value {
                                changes.push(DataChange {
                                    row_index: row_idx,
                                    column_index: col_idx,
                                    old_value: old_value.clone(),
                                    new_value,
                                });
                            }
                            break;
                        }
                    }
                }
            }
        }

        Ok(changes)
    }

    fn format_numbers(
        &self,
        headers: &[String],
        rows: &[Vec<String>],
        scope: &TargetScope,
        decimal_places: usize,
    ) -> Result<Vec<DataChange>> {
        let target_columns = self.get_target_column_indices(headers, scope)?;
        let mut changes = Vec::new();

        for &col_idx in &target_columns {
            for (row_idx, row) in rows.iter().enumerate() {
                if let Some(old_value) = row.get(col_idx) {
                    if let Ok(number) = old_value.trim().parse::<f64>() {
                        let new_value = format!("{:.prec$}", number, prec = decimal_places);
                        if old_value.trim() != new_value {
                            changes.push(DataChange {
                                row_index: row_idx,
                                column_index: col_idx,
                                old_value: old_value.clone(),
                                new_value,
                            });
                        }
                    }
                }
            }
        }

        Ok(changes)
    }

    fn remove_duplicates(
        &self,
        _headers: &[String],
        rows: &[Vec<String>],
        _scope: &TargetScope,
    ) -> Result<Vec<DataChange>> {
        let mut seen = std::collections::HashSet::new();
        let mut changes = Vec::new();

        for (row_idx, row) in rows.iter().enumerate() {
            let row_key = row.join("|");
            if !seen.insert(row_key) {
                // Mark this entire row for deletion
                // We use a special marker to indicate row deletion
                for (col_idx, old_value) in row.iter().enumerate() {
                    changes.push(DataChange {
                        row_index: row_idx,
                        column_index: col_idx,
                        old_value: old_value.clone(),
                        new_value: "<<DELETE_ROW>>".to_string(),
                    });
                }
            }
        }

        Ok(changes)
    }

    fn fill_missing(
        &self,
        headers: &[String],
        rows: &[Vec<String>],
        scope: &TargetScope,
        strategy: &str,
    ) -> Result<Vec<DataChange>> {
        let target_columns = self.get_target_column_indices(headers, scope)?;
        let mut changes = Vec::new();

        for &col_idx in &target_columns {
            let fill_value = match strategy {
                "mean" => self.calculate_mean(rows, col_idx),
                "median" => self.calculate_median(rows, col_idx),
                "mode" => self.calculate_mode(rows, col_idx),
                "zero" => Some("0".to_string()),
                "forward" => None, // Forward fill handled separately
                _ => None,
            };

            if strategy == "forward" {
                let mut last_valid = String::new();
                for (row_idx, row) in rows.iter().enumerate() {
                    if let Some(value) = row.get(col_idx) {
                        if value.trim().is_empty() {
                            if !last_valid.is_empty() {
                                changes.push(DataChange {
                                    row_index: row_idx,
                                    column_index: col_idx,
                                    old_value: value.clone(),
                                    new_value: last_valid.clone(),
                                });
                            }
                        } else {
                            last_valid = value.clone();
                        }
                    }
                }
            } else if let Some(fill) = fill_value {
                for (row_idx, row) in rows.iter().enumerate() {
                    if let Some(old_value) = row.get(col_idx) {
                        if old_value.trim().is_empty() {
                            changes.push(DataChange {
                                row_index: row_idx,
                                column_index: col_idx,
                                old_value: old_value.clone(),
                                new_value: fill.clone(),
                            });
                        }
                    }
                }
            }
        }

        Ok(changes)
    }

    fn capitalize(
        &self,
        headers: &[String],
        rows: &[Vec<String>],
        scope: &TargetScope,
    ) -> Result<Vec<DataChange>> {
        let target_columns = self.get_target_column_indices(headers, scope)?;
        let mut changes = Vec::new();

        for &col_idx in &target_columns {
            for (row_idx, row) in rows.iter().enumerate() {
                if let Some(old_value) = row.get(col_idx) {
                    let new_value: String = old_value
                        .split_whitespace()
                        .map(|word| {
                            let mut chars = word.chars();
                            match chars.next() {
                                None => String::new(),
                                Some(first) => {
                                    first.to_uppercase().collect::<String>() + &chars.as_str().to_lowercase()
                                }
                            }
                        })
                        .collect::<Vec<_>>()
                        .join(" ");

                    if old_value != &new_value {
                        changes.push(DataChange {
                            row_index: row_idx,
                            column_index: col_idx,
                            old_value: old_value.clone(),
                            new_value,
                        });
                    }
                }
            }
        }

        Ok(changes)
    }

    fn lowercase(
        &self,
        headers: &[String],
        rows: &[Vec<String>],
        scope: &TargetScope,
    ) -> Result<Vec<DataChange>> {
        let target_columns = self.get_target_column_indices(headers, scope)?;
        let mut changes = Vec::new();

        for &col_idx in &target_columns {
            for (row_idx, row) in rows.iter().enumerate() {
                if let Some(old_value) = row.get(col_idx) {
                    let new_value = old_value.to_lowercase();
                    if old_value != &new_value {
                        changes.push(DataChange {
                            row_index: row_idx,
                            column_index: col_idx,
                            old_value: old_value.clone(),
                            new_value,
                        });
                    }
                }
            }
        }

        Ok(changes)
    }

    fn uppercase(
        &self,
        headers: &[String],
        rows: &[Vec<String>],
        scope: &TargetScope,
    ) -> Result<Vec<DataChange>> {
        let target_columns = self.get_target_column_indices(headers, scope)?;
        let mut changes = Vec::new();

        for &col_idx in &target_columns {
            for (row_idx, row) in rows.iter().enumerate() {
                if let Some(old_value) = row.get(col_idx) {
                    let new_value = old_value.to_uppercase();
                    if old_value != &new_value {
                        changes.push(DataChange {
                            row_index: row_idx,
                            column_index: col_idx,
                            old_value: old_value.clone(),
                            new_value,
                        });
                    }
                }
            }
        }

        Ok(changes)
    }

    fn trim(
        &self,
        headers: &[String],
        rows: &[Vec<String>],
        scope: &TargetScope,
    ) -> Result<Vec<DataChange>> {
        let target_columns = self.get_target_column_indices(headers, scope)?;
        let mut changes = Vec::new();

        for &col_idx in &target_columns {
            for (row_idx, row) in rows.iter().enumerate() {
                if let Some(old_value) = row.get(col_idx) {
                    let new_value = old_value.trim().to_string();
                    if old_value != &new_value {
                        changes.push(DataChange {
                            row_index: row_idx,
                            column_index: col_idx,
                            old_value: old_value.clone(),
                            new_value,
                        });
                    }
                }
            }
        }

        Ok(changes)
    }

    fn replace(
        &self,
        headers: &[String],
        rows: &[Vec<String>],
        scope: &TargetScope,
        from: &str,
        to: &str,
    ) -> Result<Vec<DataChange>> {
        let target_columns = self.get_target_column_indices(headers, scope)?;
        let mut changes = Vec::new();

        for &col_idx in &target_columns {
            for (row_idx, row) in rows.iter().enumerate() {
                if let Some(old_value) = row.get(col_idx) {
                    let new_value = old_value.replace(from, to);
                    if old_value != &new_value {
                        changes.push(DataChange {
                            row_index: row_idx,
                            column_index: col_idx,
                            old_value: old_value.clone(),
                            new_value,
                        });
                    }
                }
            }
        }

        Ok(changes)
    }

    fn calculate_mean(&self, rows: &[Vec<String>], col_idx: usize) -> Option<String> {
        let values: Vec<f64> = rows
            .iter()
            .filter_map(|row| {
                row.get(col_idx)
                    .and_then(|v| v.trim().parse::<f64>().ok())
            })
            .collect();

        if values.is_empty() {
            return None;
        }

        let sum: f64 = values.iter().sum();
        let mean = sum / values.len() as f64;
        Some(format!("{:.2}", mean))
    }

    fn calculate_median(&self, rows: &[Vec<String>], col_idx: usize) -> Option<String> {
        let mut values: Vec<f64> = rows
            .iter()
            .filter_map(|row| {
                row.get(col_idx)
                    .and_then(|v| v.trim().parse::<f64>().ok())
            })
            .collect();

        if values.is_empty() {
            return None;
        }

        values.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let median = if values.len() % 2 == 0 {
            (values[values.len() / 2 - 1] + values[values.len() / 2]) / 2.0
        } else {
            values[values.len() / 2]
        };

        Some(format!("{:.2}", median))
    }

    fn calculate_mode(&self, rows: &[Vec<String>], col_idx: usize) -> Option<String> {
        let mut frequency = std::collections::HashMap::new();

        for row in rows {
            if let Some(value) = row.get(col_idx) {
                if !value.trim().is_empty() {
                    *frequency.entry(value.clone()).or_insert(0) += 1;
                }
            }
        }

        frequency
            .into_iter()
            .max_by_key(|(_, count)| *count)
            .map(|(value, _)| value)
    }

    fn get_target_column_indices(
        &self,
        headers: &[String],
        scope: &TargetScope,
    ) -> Result<Vec<usize>> {
        match scope {
            TargetScope::AllData => Ok((0..headers.len()).collect()),
            TargetScope::Column { name } => {
                headers.iter()
                    .position(|h| h.to_lowercase() == name.to_lowercase())
                    .map(|idx| vec![idx])
                    .ok_or_else(|| anyhow!("Column '{}' not found", name))
            }
            TargetScope::Columns { names } => {
                let indices: Vec<usize> = names.iter()
                    .filter_map(|name| {
                        headers.iter()
                            .position(|h| h.to_lowercase() == name.to_lowercase())
                    })
                    .collect();

                if indices.is_empty() {
                    Err(anyhow!("None of the specified columns were found"))
                } else {
                    Ok(indices)
                }
            }
            TargetScope::Selection { columns, .. } => Ok(columns.clone()),
        }
    }
}
