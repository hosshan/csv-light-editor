use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityReport {
    pub total_rows: usize,
    pub total_columns: usize,
    pub completeness: f64,
    pub column_reports: Vec<ColumnQualityReport>,
    pub duplicates: DuplicateReport,
    pub outliers: OutlierReport,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnQualityReport {
    pub column_index: usize,
    pub column_name: String,
    pub total_values: usize,
    pub empty_count: usize,
    pub unique_count: usize,
    pub completeness: f64,
    pub uniqueness: f64,
    pub data_type_consistency: f64,
    pub dominant_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateReport {
    pub total_duplicates: usize,
    pub duplicate_rows: Vec<DuplicateRow>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateRow {
    pub row_indices: Vec<usize>,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutlierReport {
    pub total_outliers: usize,
    pub outlier_details: Vec<OutlierDetail>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutlierDetail {
    pub row_index: usize,
    pub column_index: usize,
    pub column_name: String,
    pub value: String,
    pub z_score: f64,
    pub method: String,
}

pub struct QualityAnalyzer;

impl QualityAnalyzer {
    pub fn analyze(data: &[Vec<String>], headers: &[String]) -> QualityReport {
        let total_rows = data.len();
        let total_columns = headers.len();

        let column_reports = Self::analyze_columns(data, headers);
        let duplicates = Self::detect_duplicates(data);
        let outliers = Self::detect_outliers(data, headers);

        let total_cells = total_rows * total_columns;
        let empty_cells: usize = column_reports.iter().map(|r| r.empty_count).sum();
        let completeness = if total_cells > 0 {
            1.0 - (empty_cells as f64 / total_cells as f64)
        } else {
            1.0
        };

        QualityReport {
            total_rows,
            total_columns,
            completeness,
            column_reports,
            duplicates,
            outliers,
        }
    }

    fn analyze_columns(data: &[Vec<String>], headers: &[String]) -> Vec<ColumnQualityReport> {
        let mut reports = Vec::new();

        for (col_idx, header) in headers.iter().enumerate() {
            let mut empty_count = 0;
            let mut unique_values = HashSet::new();
            let type_detector = crate::csv_engine::data_types::DataTypeDetector::new();
            let mut type_counts: HashMap<String, usize> = HashMap::new();

            for row in data {
                if let Some(value) = row.get(col_idx) {
                    if value.trim().is_empty() {
                        empty_count += 1;
                    } else {
                        unique_values.insert(value.clone());
                        let detected_type = format!("{:?}", type_detector.detect_value_type(value));
                        *type_counts.entry(detected_type).or_insert(0) += 1;
                    }
                }
            }

            let total_values = data.len();
            let completeness = if total_values > 0 {
                1.0 - (empty_count as f64 / total_values as f64)
            } else {
                1.0
            };

            let uniqueness = if total_values > 0 {
                unique_values.len() as f64 / total_values as f64
            } else {
                0.0
            };

            let (dominant_type, dominant_count) = type_counts
                .iter()
                .max_by_key(|(_, count)| *count)
                .map(|(t, c)| (t.clone(), *c))
                .unwrap_or(("Text".to_string(), 0));

            let non_empty_count = total_values - empty_count;
            let data_type_consistency = if non_empty_count > 0 {
                dominant_count as f64 / non_empty_count as f64
            } else {
                1.0
            };

            reports.push(ColumnQualityReport {
                column_index: col_idx,
                column_name: header.clone(),
                total_values,
                empty_count,
                unique_count: unique_values.len(),
                completeness,
                uniqueness,
                data_type_consistency,
                dominant_type,
            });
        }

        reports
    }

    fn detect_duplicates(data: &[Vec<String>]) -> DuplicateReport {
        let mut row_map: HashMap<String, Vec<usize>> = HashMap::new();

        for (row_idx, row) in data.iter().enumerate() {
            let row_key = row.join("|");
            row_map.entry(row_key).or_insert_with(Vec::new).push(row_idx);
        }

        let mut duplicate_rows: Vec<DuplicateRow> = row_map
            .into_iter()
            .filter(|(_, indices)| indices.len() > 1)
            .map(|(_, row_indices)| {
                let count = row_indices.len();
                DuplicateRow { row_indices, count }
            })
            .collect();

        duplicate_rows.sort_by(|a, b| b.count.cmp(&a.count));

        let total_duplicates = duplicate_rows.iter().map(|d| d.count - 1).sum();

        DuplicateReport {
            total_duplicates,
            duplicate_rows,
        }
    }

    fn detect_outliers(data: &[Vec<String>], headers: &[String]) -> OutlierReport {
        let mut outlier_details = Vec::new();

        for (col_idx, header) in headers.iter().enumerate() {
            let mut numeric_values = Vec::new();
            let mut row_value_pairs = Vec::new();

            for (row_idx, row) in data.iter().enumerate() {
                if let Some(value) = row.get(col_idx) {
                    if let Ok(num) = value.parse::<f64>() {
                        numeric_values.push(num);
                        row_value_pairs.push((row_idx, value.clone(), num));
                    }
                }
            }

            if numeric_values.len() < 3 {
                continue; // Need at least 3 values for outlier detection
            }

            // Calculate mean and standard deviation
            let mean = numeric_values.iter().sum::<f64>() / numeric_values.len() as f64;
            let variance = numeric_values
                .iter()
                .map(|v| (v - mean).powi(2))
                .sum::<f64>()
                / numeric_values.len() as f64;
            let std_dev = variance.sqrt();

            if std_dev == 0.0 {
                continue; // All values are the same
            }

            // Detect outliers using Z-score (threshold: 3.0)
            for (row_idx, value, num) in row_value_pairs {
                let z_score = ((num - mean) / std_dev).abs();
                if z_score > 3.0 {
                    outlier_details.push(OutlierDetail {
                        row_index: row_idx,
                        column_index: col_idx,
                        column_name: header.clone(),
                        value,
                        z_score,
                        method: "Z-Score".to_string(),
                    });
                }
            }

            // IQR method as an alternative
            let mut sorted_values = numeric_values.clone();
            sorted_values.sort_by(|a, b| a.partial_cmp(b).unwrap());

            let q1_idx = sorted_values.len() / 4;
            let q3_idx = (sorted_values.len() * 3) / 4;

            if q1_idx < sorted_values.len() && q3_idx < sorted_values.len() {
                let q1 = sorted_values[q1_idx];
                let q3 = sorted_values[q3_idx];
                let iqr = q3 - q1;

                if iqr > 0.0 {
                    let lower_bound = q1 - 1.5 * iqr;
                    let upper_bound = q3 + 1.5 * iqr;

                    for (row_idx, row) in data.iter().enumerate() {
                        if let Some(value) = row.get(col_idx) {
                            if let Ok(num) = value.parse::<f64>() {
                                if num < lower_bound || num > upper_bound {
                                    // Only add if not already detected by Z-score
                                    if !outlier_details.iter().any(|o|
                                        o.row_index == row_idx && o.column_index == col_idx
                                    ) {
                                        outlier_details.push(OutlierDetail {
                                            row_index: row_idx,
                                            column_index: col_idx,
                                            column_name: header.clone(),
                                            value: value.clone(),
                                            z_score: 0.0,
                                            method: "IQR".to_string(),
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        outlier_details.sort_by(|a, b| b.z_score.partial_cmp(&a.z_score).unwrap());

        OutlierReport {
            total_outliers: outlier_details.len(),
            outlier_details,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_analyze_columns() {
        let data = vec![
            vec!["John".to_string(), "25".to_string()],
            vec!["Jane".to_string(), "30".to_string()],
            vec!["".to_string(), "35".to_string()],
        ];
        let headers = vec!["name".to_string(), "age".to_string()];

        let reports = QualityAnalyzer::analyze_columns(&data, &headers);

        assert_eq!(reports.len(), 2);
        assert_eq!(reports[0].empty_count, 1);
        assert_eq!(reports[0].unique_count, 2);
        assert_eq!(reports[1].empty_count, 0);
    }

    #[test]
    fn test_detect_duplicates() {
        let data = vec![
            vec!["John".to_string(), "25".to_string()],
            vec!["Jane".to_string(), "30".to_string()],
            vec!["John".to_string(), "25".to_string()],
        ];

        let report = QualityAnalyzer::detect_duplicates(&data);
        assert_eq!(report.total_duplicates, 1);
        assert_eq!(report.duplicate_rows.len(), 1);
    }

    #[test]
    fn test_detect_outliers() {
        let data = vec![
            vec!["1".to_string()],
            vec!["2".to_string()],
            vec!["3".to_string()],
            vec!["100".to_string()], // Outlier
        ];
        let headers = vec!["value".to_string()];

        let report = QualityAnalyzer::detect_outliers(&data, &headers);
        assert!(report.total_outliers > 0);
    }
}
