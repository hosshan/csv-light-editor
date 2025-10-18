use anyhow::{Result, anyhow};
use std::collections::HashMap;
use serde_json::json;

use super::{AnalysisType, TargetScope, Visualization};

/// Performs data analysis on CSV data
#[derive(Debug)]
pub struct DataAnalyzer;

impl DataAnalyzer {
    pub fn new() -> Self {
        Self
    }

    pub fn analyze(
        &self,
        analysis_type: &AnalysisType,
        headers: &[String],
        rows: &[Vec<String>],
        scope: &TargetScope,
    ) -> Result<AnalysisResult> {
        match analysis_type {
            AnalysisType::Statistics => self.compute_statistics(headers, rows, scope),
            AnalysisType::Distribution => self.compute_distribution(headers, rows, scope),
            AnalysisType::Correlation => self.compute_correlation(headers, rows, scope),
            AnalysisType::Outliers => self.detect_outliers(headers, rows, scope),
            AnalysisType::Missing => self.analyze_missing(headers, rows, scope),
            AnalysisType::Duplicates => self.detect_duplicates(headers, rows, scope),
            AnalysisType::Summary => self.generate_summary(headers, rows, scope),
        }
    }

    fn compute_statistics(
        &self,
        headers: &[String],
        rows: &[Vec<String>],
        scope: &TargetScope,
    ) -> Result<AnalysisResult> {
        let target_columns = self.get_target_column_indices(headers, scope)?;
        let mut details = HashMap::new();

        for &col_idx in &target_columns {
            if col_idx >= headers.len() {
                continue;
            }

            let column_name = &headers[col_idx];
            let values: Vec<f64> = rows
                .iter()
                .filter_map(|row| {
                    row.get(col_idx)
                        .and_then(|v| v.trim().parse::<f64>().ok())
                })
                .collect();

            if values.is_empty() {
                continue;
            }

            let count = values.len();
            let sum: f64 = values.iter().sum();
            let mean = sum / count as f64;

            let mut sorted = values.clone();
            sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());

            let median = if count % 2 == 0 {
                (sorted[count / 2 - 1] + sorted[count / 2]) / 2.0
            } else {
                sorted[count / 2]
            };

            let variance = values.iter()
                .map(|v| (v - mean).powi(2))
                .sum::<f64>() / count as f64;
            let std_dev = variance.sqrt();

            let min = sorted.first().copied().unwrap_or(0.0);
            let max = sorted.last().copied().unwrap_or(0.0);

            details.insert(
                column_name.clone(),
                json!({
                    "count": count,
                    "sum": sum,
                    "mean": mean,
                    "median": median,
                    "std_dev": std_dev,
                    "min": min,
                    "max": max,
                    "range": max - min,
                }),
            );
        }

        let summary = format!(
            "Statistical analysis completed for {} column(s). Found numeric data in {} column(s).",
            target_columns.len(),
            details.len()
        );

        Ok(AnalysisResult {
            summary,
            details,
            visualizations: vec![],
        })
    }

    fn compute_distribution(
        &self,
        headers: &[String],
        rows: &[Vec<String>],
        scope: &TargetScope,
    ) -> Result<AnalysisResult> {
        let target_columns = self.get_target_column_indices(headers, scope)?;
        let mut details = HashMap::new();
        let mut visualizations = Vec::new();

        for &col_idx in &target_columns {
            if col_idx >= headers.len() {
                continue;
            }

            let column_name = &headers[col_idx];
            let mut frequency_map: HashMap<String, usize> = HashMap::new();

            for row in rows {
                if let Some(value) = row.get(col_idx) {
                    *frequency_map.entry(value.clone()).or_insert(0) += 1;
                }
            }

            let mut frequency_vec: Vec<(String, usize)> = frequency_map.into_iter().collect();
            frequency_vec.sort_by(|a, b| b.1.cmp(&a.1));

            let top_values: Vec<_> = frequency_vec.iter().take(10).collect();

            details.insert(
                column_name.clone(),
                json!({
                    "unique_values": frequency_vec.len(),
                    "total_values": rows.len(),
                    "top_values": top_values,
                }),
            );

            // Create histogram data for visualization
            visualizations.push(Visualization {
                viz_type: "histogram".to_string(),
                title: format!("Distribution of {}", column_name),
                data: json!({
                    "labels": top_values.iter().map(|(k, _)| k).collect::<Vec<_>>(),
                    "values": top_values.iter().map(|(_, v)| v).collect::<Vec<_>>(),
                }),
            });
        }

        let summary = format!(
            "Distribution analysis completed for {} column(s).",
            target_columns.len()
        );

        Ok(AnalysisResult {
            summary,
            details,
            visualizations,
        })
    }

    fn compute_correlation(
        &self,
        headers: &[String],
        rows: &[Vec<String>],
        _scope: &TargetScope,
    ) -> Result<AnalysisResult> {
        // For correlation, we need at least 2 numeric columns
        let numeric_columns: Vec<(usize, Vec<f64>)> = (0..headers.len())
            .filter_map(|col_idx| {
                let values: Vec<f64> = rows
                    .iter()
                    .filter_map(|row| {
                        row.get(col_idx)
                            .and_then(|v| v.trim().parse::<f64>().ok())
                    })
                    .collect();

                if values.len() > 1 {
                    Some((col_idx, values))
                } else {
                    None
                }
            })
            .collect();

        if numeric_columns.len() < 2 {
            return Err(anyhow!("Need at least 2 numeric columns for correlation analysis"));
        }

        let mut details = HashMap::new();
        let mut correlations = Vec::new();

        for i in 0..numeric_columns.len() {
            for j in (i + 1)..numeric_columns.len() {
                let (idx1, values1) = &numeric_columns[i];
                let (idx2, values2) = &numeric_columns[j];

                let corr = self.pearson_correlation(values1, values2);

                correlations.push(json!({
                    "column1": headers[*idx1],
                    "column2": headers[*idx2],
                    "correlation": corr,
                }));
            }
        }

        details.insert("correlations".to_string(), json!(correlations));

        let summary = format!(
            "Computed {} correlation(s) between numeric columns.",
            correlations.len()
        );

        Ok(AnalysisResult {
            summary,
            details,
            visualizations: vec![],
        })
    }

    fn pearson_correlation(&self, x: &[f64], y: &[f64]) -> f64 {
        let n = x.len().min(y.len());
        if n == 0 {
            return 0.0;
        }

        let mean_x: f64 = x.iter().take(n).sum::<f64>() / n as f64;
        let mean_y: f64 = y.iter().take(n).sum::<f64>() / n as f64;

        let mut numerator = 0.0;
        let mut sum_sq_x = 0.0;
        let mut sum_sq_y = 0.0;

        for i in 0..n {
            let dx = x[i] - mean_x;
            let dy = y[i] - mean_y;
            numerator += dx * dy;
            sum_sq_x += dx * dx;
            sum_sq_y += dy * dy;
        }

        if sum_sq_x == 0.0 || sum_sq_y == 0.0 {
            return 0.0;
        }

        numerator / (sum_sq_x.sqrt() * sum_sq_y.sqrt())
    }

    fn detect_outliers(
        &self,
        headers: &[String],
        rows: &[Vec<String>],
        scope: &TargetScope,
    ) -> Result<AnalysisResult> {
        let target_columns = self.get_target_column_indices(headers, scope)?;
        let mut details = HashMap::new();

        for &col_idx in &target_columns {
            if col_idx >= headers.len() {
                continue;
            }

            let column_name = &headers[col_idx];
            let values: Vec<(usize, f64)> = rows
                .iter()
                .enumerate()
                .filter_map(|(row_idx, row)| {
                    row.get(col_idx)
                        .and_then(|v| v.trim().parse::<f64>().ok())
                        .map(|val| (row_idx, val))
                })
                .collect();

            if values.is_empty() {
                continue;
            }

            // IQR method for outlier detection
            let mut sorted_values: Vec<f64> = values.iter().map(|(_, v)| *v).collect();
            sorted_values.sort_by(|a, b| a.partial_cmp(b).unwrap());

            let q1_idx = sorted_values.len() / 4;
            let q3_idx = 3 * sorted_values.len() / 4;
            let q1 = sorted_values[q1_idx];
            let q3 = sorted_values[q3_idx];
            let iqr = q3 - q1;

            let lower_bound = q1 - 1.5 * iqr;
            let upper_bound = q3 + 1.5 * iqr;

            let outliers: Vec<_> = values
                .iter()
                .filter(|(_, v)| *v < lower_bound || *v > upper_bound)
                .take(50) // Limit to first 50 outliers
                .map(|(row_idx, value)| {
                    json!({
                        "row": row_idx,
                        "value": value,
                    })
                })
                .collect();

            details.insert(
                column_name.clone(),
                json!({
                    "outlier_count": outliers.len(),
                    "lower_bound": lower_bound,
                    "upper_bound": upper_bound,
                    "q1": q1,
                    "q3": q3,
                    "outliers": outliers,
                }),
            );
        }

        let total_outliers: usize = details.values()
            .filter_map(|v| v.get("outlier_count").and_then(|c| c.as_u64()))
            .map(|c| c as usize)
            .sum();

        let summary = format!(
            "Found {} outlier(s) across {} column(s) using IQR method.",
            total_outliers,
            details.len()
        );

        Ok(AnalysisResult {
            summary,
            details,
            visualizations: vec![],
        })
    }

    fn analyze_missing(
        &self,
        headers: &[String],
        rows: &[Vec<String>],
        scope: &TargetScope,
    ) -> Result<AnalysisResult> {
        let target_columns = self.get_target_column_indices(headers, scope)?;
        let mut details = HashMap::new();

        for &col_idx in &target_columns {
            if col_idx >= headers.len() {
                continue;
            }

            let column_name = &headers[col_idx];
            let mut missing_count = 0;
            let mut missing_rows = Vec::new();

            for (row_idx, row) in rows.iter().enumerate() {
                if let Some(value) = row.get(col_idx) {
                    if value.trim().is_empty() {
                        missing_count += 1;
                        if missing_rows.len() < 50 {
                            missing_rows.push(row_idx);
                        }
                    }
                } else {
                    missing_count += 1;
                    if missing_rows.len() < 50 {
                        missing_rows.push(row_idx);
                    }
                }
            }

            let percentage = (missing_count as f64 / rows.len() as f64) * 100.0;

            details.insert(
                column_name.clone(),
                json!({
                    "missing_count": missing_count,
                    "total_count": rows.len(),
                    "percentage": percentage,
                    "missing_rows": missing_rows,
                }),
            );
        }

        let total_missing: usize = details.values()
            .filter_map(|v| v.get("missing_count").and_then(|c| c.as_u64()))
            .map(|c| c as usize)
            .sum();

        let summary = format!(
            "Found {} missing value(s) across {} column(s).",
            total_missing,
            details.len()
        );

        Ok(AnalysisResult {
            summary,
            details,
            visualizations: vec![],
        })
    }

    fn detect_duplicates(
        &self,
        headers: &[String],
        rows: &[Vec<String>],
        _scope: &TargetScope,
    ) -> Result<AnalysisResult> {
        let mut seen = HashMap::new();
        let mut duplicates = Vec::new();

        for (idx, row) in rows.iter().enumerate() {
            let row_key = row.join("|");
            if let Some(&first_idx) = seen.get(&row_key) {
                if duplicates.len() < 100 {
                    duplicates.push(json!({
                        "row": idx,
                        "duplicate_of": first_idx,
                    }));
                }
            } else {
                seen.insert(row_key, idx);
            }
        }

        let summary = format!(
            "Found {} duplicate row(s) out of {} total rows.",
            duplicates.len(),
            rows.len()
        );

        let mut details = HashMap::new();
        details.insert("duplicates".to_string(), json!(duplicates));
        details.insert("total_rows".to_string(), json!(rows.len()));
        details.insert("unique_rows".to_string(), json!(seen.len()));

        Ok(AnalysisResult {
            summary,
            details,
            visualizations: vec![],
        })
    }

    fn generate_summary(
        &self,
        headers: &[String],
        rows: &[Vec<String>],
        _scope: &TargetScope,
    ) -> Result<AnalysisResult> {
        let mut details = HashMap::new();

        // Basic information
        details.insert("row_count".to_string(), json!(rows.len()));
        details.insert("column_count".to_string(), json!(headers.len()));

        // Column types
        let mut column_info = Vec::new();
        for (idx, header) in headers.iter().enumerate() {
            let sample_values: Vec<_> = rows.iter()
                .filter_map(|row| row.get(idx))
                .take(100)
                .collect();

            let numeric_count = sample_values.iter()
                .filter(|v| v.trim().parse::<f64>().is_ok())
                .count();

            let empty_count = sample_values.iter()
                .filter(|v| v.trim().is_empty())
                .count();

            let data_type = if numeric_count as f64 / sample_values.len() as f64 > 0.8 {
                "numeric"
            } else {
                "text"
            };

            column_info.push(json!({
                "name": header,
                "index": idx,
                "type": data_type,
                "empty_percentage": (empty_count as f64 / sample_values.len() as f64) * 100.0,
            }));
        }

        details.insert("columns".to_string(), json!(column_info));

        let summary = format!(
            "Dataset summary: {} rows, {} columns. Analyzed column types and data quality.",
            rows.len(),
            headers.len()
        );

        Ok(AnalysisResult {
            summary,
            details,
            visualizations: vec![],
        })
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

pub struct AnalysisResult {
    pub summary: String,
    pub details: HashMap<String, serde_json::Value>,
    pub visualizations: Vec<Visualization>,
}
