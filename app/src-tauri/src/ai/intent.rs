use serde::{Deserialize, Serialize};
use anyhow::{Result, anyhow};
use regex::Regex;

/// Detected user intent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Intent {
    pub intent_type: IntentType,
    pub target_scope: TargetScope,
    pub confidence: f32,
}

/// Type of operation the user wants to perform
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IntentType {
    Analysis {
        analysis_type: AnalysisType,
    },
    Transformation {
        operation: TransformOperation,
    },
}

/// Types of analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AnalysisType {
    Statistics,
    Distribution,
    Correlation,
    Outliers,
    Missing,
    Duplicates,
    Summary,
}

/// Types of transformations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransformOperation {
    Normalize,
    FormatDates { target_format: String },
    FormatNumbers { decimal_places: usize },
    RemoveDuplicates,
    FillMissing { strategy: String },
    Capitalize,
    Lowercase,
    Uppercase,
    Trim,
    Replace { from: String, to: String },
}

/// Scope of the operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TargetScope {
    AllData,
    Column { name: String },
    Columns { names: Vec<String> },
    Selection { rows: Vec<usize>, columns: Vec<usize> },
}

/// Detect intent from user prompt using pattern matching
pub fn detect_intent(prompt: &str) -> Result<Intent> {
    let prompt_lower = prompt.to_lowercase();

    // Analysis patterns
    if let Some(analysis_type) = detect_analysis_type(&prompt_lower) {
        let target_scope = extract_target_scope(&prompt, &prompt_lower);
        return Ok(Intent {
            intent_type: IntentType::Analysis { analysis_type },
            target_scope,
            confidence: 0.8,
        });
    }

    // Transformation patterns
    if let Some(operation) = detect_transform_operation(&prompt, &prompt_lower) {
        let target_scope = extract_target_scope(&prompt, &prompt_lower);
        return Ok(Intent {
            intent_type: IntentType::Transformation { operation },
            target_scope,
            confidence: 0.8,
        });
    }

    Err(anyhow!("Could not understand the request. Please try rephrasing."))
}

fn detect_analysis_type(prompt: &str) -> Option<AnalysisType> {
    // Statistics keywords
    if prompt.contains("statistic") || prompt.contains("stats") ||
       prompt.contains("mean") || prompt.contains("average") ||
       prompt.contains("median") || prompt.contains("sum") {
        return Some(AnalysisType::Statistics);
    }

    // Distribution keywords
    if prompt.contains("distribution") || prompt.contains("histogram") ||
       prompt.contains("frequency") || prompt.contains("range") {
        return Some(AnalysisType::Distribution);
    }

    // Correlation keywords
    if prompt.contains("correlation") || prompt.contains("correlate") ||
       prompt.contains("relationship") || prompt.contains("relate") {
        return Some(AnalysisType::Correlation);
    }

    // Outliers keywords
    if prompt.contains("outlier") || prompt.contains("anomal") ||
       prompt.contains("unusual") || prompt.contains("extreme") {
        return Some(AnalysisType::Outliers);
    }

    // Missing data keywords
    if prompt.contains("missing") || prompt.contains("null") ||
       prompt.contains("empty") || prompt.contains("blank") {
        return Some(AnalysisType::Missing);
    }

    // Duplicates keywords
    if prompt.contains("duplicate") || prompt.contains("repeated") ||
       prompt.contains("same") && prompt.contains("row") {
        return Some(AnalysisType::Duplicates);
    }

    // Summary keywords
    if prompt.contains("summary") || prompt.contains("overview") ||
       prompt.contains("describe") || prompt.contains("show me") && prompt.contains("data") {
        return Some(AnalysisType::Summary);
    }

    None
}

fn detect_transform_operation(prompt: &str, prompt_lower: &str) -> Option<TransformOperation> {
    // Date formatting
    if prompt_lower.contains("date") && (prompt_lower.contains("format") ||
       prompt_lower.contains("convert") || prompt_lower.contains("standardize")) {
        let format = extract_date_format(prompt).unwrap_or("YYYY-MM-DD".to_string());
        return Some(TransformOperation::FormatDates { target_format: format });
    }

    // Number formatting
    if (prompt_lower.contains("number") || prompt_lower.contains("decimal")) &&
       prompt_lower.contains("format") {
        let places = extract_decimal_places(prompt).unwrap_or(2);
        return Some(TransformOperation::FormatNumbers { decimal_places: places });
    }

    // Remove duplicates
    if prompt_lower.contains("remove") && prompt_lower.contains("duplicate") {
        return Some(TransformOperation::RemoveDuplicates);
    }

    // Fill missing
    if (prompt_lower.contains("fill") || prompt_lower.contains("replace")) &&
       (prompt_lower.contains("missing") || prompt_lower.contains("null")) {
        let strategy = extract_fill_strategy(prompt_lower).unwrap_or("mean".to_string());
        return Some(TransformOperation::FillMissing { strategy });
    }

    // Text case transformations
    if prompt_lower.contains("capitalize") {
        return Some(TransformOperation::Capitalize);
    }
    if prompt_lower.contains("lowercase") || prompt_lower.contains("lower case") {
        return Some(TransformOperation::Lowercase);
    }
    if prompt_lower.contains("uppercase") || prompt_lower.contains("upper case") {
        return Some(TransformOperation::Uppercase);
    }

    // Trim
    if prompt_lower.contains("trim") || prompt_lower.contains("remove whitespace") {
        return Some(TransformOperation::Trim);
    }

    // Replace
    if prompt_lower.contains("replace") {
        if let Some((from, to)) = extract_replace_params(prompt) {
            return Some(TransformOperation::Replace { from, to });
        }
    }

    // Normalize
    if prompt_lower.contains("normalize") || prompt_lower.contains("standardize") {
        return Some(TransformOperation::Normalize);
    }

    None
}

fn extract_target_scope(prompt: &str, prompt_lower: &str) -> TargetScope {
    // Try to extract column names from quotes
    let quote_re = Regex::new(r#"["']([^"']+)["']"#).unwrap();
    let mut column_names = Vec::new();

    for cap in quote_re.captures_iter(prompt) {
        if let Some(name) = cap.get(1) {
            column_names.push(name.as_str().to_string());
        }
    }

    if column_names.len() > 1 {
        return TargetScope::Columns { names: column_names };
    } else if column_names.len() == 1 {
        return TargetScope::Column { name: column_names[0].clone() };
    }

    // Try to extract column names after "column" or "the" keywords
    let column_re = Regex::new(r"(?:column|the)\s+(\w+)").unwrap();
    if let Some(cap) = column_re.captures(prompt_lower) {
        if let Some(name) = cap.get(1) {
            return TargetScope::Column { name: name.as_str().to_string() };
        }
    }

    // Default to all data
    TargetScope::AllData
}

fn extract_date_format(prompt: &str) -> Option<String> {
    // Look for common date format patterns
    if prompt.contains("YYYY-MM-DD") || prompt.contains("yyyy-mm-dd") {
        Some("YYYY-MM-DD".to_string())
    } else if prompt.contains("DD/MM/YYYY") || prompt.contains("dd/mm/yyyy") {
        Some("DD/MM/YYYY".to_string())
    } else if prompt.contains("MM/DD/YYYY") || prompt.contains("mm/dd/yyyy") {
        Some("MM/DD/YYYY".to_string())
    } else if prompt.contains("ISO") || prompt.contains("iso") {
        Some("YYYY-MM-DD".to_string())
    } else {
        None
    }
}

fn extract_decimal_places(prompt: &str) -> Option<usize> {
    let re = Regex::new(r"(\d+)\s*decimal").unwrap();
    if let Some(cap) = re.captures(prompt) {
        if let Some(num) = cap.get(1) {
            return num.as_str().parse().ok();
        }
    }
    None
}

fn extract_fill_strategy(prompt: &str) -> Option<String> {
    if prompt.contains("mean") || prompt.contains("average") {
        Some("mean".to_string())
    } else if prompt.contains("median") {
        Some("median".to_string())
    } else if prompt.contains("mode") {
        Some("mode".to_string())
    } else if prompt.contains("zero") {
        Some("zero".to_string())
    } else if prompt.contains("forward") {
        Some("forward".to_string())
    } else {
        None
    }
}

fn extract_replace_params(prompt: &str) -> Option<(String, String)> {
    // Try to extract "replace X with Y" pattern
    let re = Regex::new(r#"replace\s+["']([^"']+)["']\s+(?:with|by|to)\s+["']([^"']+)["']"#).unwrap();
    if let Some(cap) = re.captures(prompt) {
        if let (Some(from), Some(to)) = (cap.get(1), cap.get(2)) {
            return Some((from.as_str().to_string(), to.as_str().to_string()));
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_statistics_intent() {
        let intent = detect_intent("Show me statistics for the price column").unwrap();
        assert!(matches!(intent.intent_type, IntentType::Analysis {
            analysis_type: AnalysisType::Statistics
        }));
    }

    #[test]
    fn test_detect_date_format_intent() {
        let intent = detect_intent("Convert dates to YYYY-MM-DD format").unwrap();
        assert!(matches!(intent.intent_type, IntentType::Transformation { .. }));
    }

    #[test]
    fn test_extract_column_from_quotes() {
        let scope = extract_target_scope("Analyze 'price' column", "analyze 'price' column");
        assert!(matches!(scope, TargetScope::Column { .. }));
    }
}
