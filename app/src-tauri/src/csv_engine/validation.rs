use serde::{Deserialize, Serialize};
use regex::Regex;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ValidationRuleType {
    Range,
    Length,
    Pattern,
    Custom,
    Required,
    Unique,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationRule {
    pub rule_type: ValidationRuleType,
    pub column_index: usize,
    pub column_name: String,
    pub parameters: HashMap<String, String>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationError {
    pub row_index: usize,
    pub column_index: usize,
    pub column_name: String,
    pub value: String,
    pub rule_type: ValidationRuleType,
    pub message: String,
}

pub struct Validator {
    rules: Vec<ValidationRule>,
}

impl Validator {
    pub fn new(rules: Vec<ValidationRule>) -> Self {
        Self { rules }
    }

    pub fn validate(&self, data: &[Vec<String>], headers: &[String]) -> Vec<ValidationError> {
        let mut errors = Vec::new();

        for rule in &self.rules {
            match rule.rule_type {
                ValidationRuleType::Range => {
                    errors.extend(self.validate_range(data, headers, rule));
                }
                ValidationRuleType::Length => {
                    errors.extend(self.validate_length(data, headers, rule));
                }
                ValidationRuleType::Pattern => {
                    errors.extend(self.validate_pattern(data, headers, rule));
                }
                ValidationRuleType::Required => {
                    errors.extend(self.validate_required(data, headers, rule));
                }
                ValidationRuleType::Unique => {
                    errors.extend(self.validate_unique(data, headers, rule));
                }
                ValidationRuleType::Custom => {
                    // Custom rules would be handled by user-defined logic
                }
            }
        }

        errors
    }

    fn validate_range(
        &self,
        data: &[Vec<String>],
        headers: &[String],
        rule: &ValidationRule,
    ) -> Vec<ValidationError> {
        let mut errors = Vec::new();
        let col_idx = rule.column_index;

        let min = rule.parameters.get("min").and_then(|s| s.parse::<f64>().ok());
        let max = rule.parameters.get("max").and_then(|s| s.parse::<f64>().ok());

        for (row_idx, row) in data.iter().enumerate() {
            if let Some(value) = row.get(col_idx) {
                if let Ok(num) = value.parse::<f64>() {
                    let mut is_valid = true;

                    if let Some(min_val) = min {
                        if num < min_val {
                            is_valid = false;
                        }
                    }

                    if let Some(max_val) = max {
                        if num > max_val {
                            is_valid = false;
                        }
                    }

                    if !is_valid {
                        errors.push(ValidationError {
                            row_index: row_idx,
                            column_index: col_idx,
                            column_name: headers.get(col_idx).cloned().unwrap_or_default(),
                            value: value.clone(),
                            rule_type: ValidationRuleType::Range,
                            message: rule.error_message.clone().unwrap_or_else(|| {
                                format!("Value {} is out of range", value)
                            }),
                        });
                    }
                }
            }
        }

        errors
    }

    fn validate_length(
        &self,
        data: &[Vec<String>],
        headers: &[String],
        rule: &ValidationRule,
    ) -> Vec<ValidationError> {
        let mut errors = Vec::new();
        let col_idx = rule.column_index;

        let min_len = rule.parameters.get("min_length").and_then(|s| s.parse::<usize>().ok());
        let max_len = rule.parameters.get("max_length").and_then(|s| s.parse::<usize>().ok());

        for (row_idx, row) in data.iter().enumerate() {
            if let Some(value) = row.get(col_idx) {
                let len = value.len();
                let mut is_valid = true;

                if let Some(min) = min_len {
                    if len < min {
                        is_valid = false;
                    }
                }

                if let Some(max) = max_len {
                    if len > max {
                        is_valid = false;
                    }
                }

                if !is_valid {
                    errors.push(ValidationError {
                        row_index: row_idx,
                        column_index: col_idx,
                        column_name: headers.get(col_idx).cloned().unwrap_or_default(),
                        value: value.clone(),
                        rule_type: ValidationRuleType::Length,
                        message: rule.error_message.clone().unwrap_or_else(|| {
                            format!("Length {} is invalid", len)
                        }),
                    });
                }
            }
        }

        errors
    }

    fn validate_pattern(
        &self,
        data: &[Vec<String>],
        headers: &[String],
        rule: &ValidationRule,
    ) -> Vec<ValidationError> {
        let mut errors = Vec::new();
        let col_idx = rule.column_index;

        if let Some(pattern_str) = rule.parameters.get("pattern") {
            if let Ok(regex) = Regex::new(pattern_str) {
                for (row_idx, row) in data.iter().enumerate() {
                    if let Some(value) = row.get(col_idx) {
                        if !value.is_empty() && !regex.is_match(value) {
                            errors.push(ValidationError {
                                row_index: row_idx,
                                column_index: col_idx,
                                column_name: headers.get(col_idx).cloned().unwrap_or_default(),
                                value: value.clone(),
                                rule_type: ValidationRuleType::Pattern,
                                message: rule.error_message.clone().unwrap_or_else(|| {
                                    format!("Value '{}' does not match pattern", value)
                                }),
                            });
                        }
                    }
                }
            }
        }

        errors
    }

    fn validate_required(
        &self,
        data: &[Vec<String>],
        headers: &[String],
        rule: &ValidationRule,
    ) -> Vec<ValidationError> {
        let mut errors = Vec::new();
        let col_idx = rule.column_index;

        for (row_idx, row) in data.iter().enumerate() {
            if let Some(value) = row.get(col_idx) {
                if value.trim().is_empty() {
                    errors.push(ValidationError {
                        row_index: row_idx,
                        column_index: col_idx,
                        column_name: headers.get(col_idx).cloned().unwrap_or_default(),
                        value: value.clone(),
                        rule_type: ValidationRuleType::Required,
                        message: rule.error_message.clone().unwrap_or_else(|| {
                            "Required field is empty".to_string()
                        }),
                    });
                }
            }
        }

        errors
    }

    fn validate_unique(
        &self,
        data: &[Vec<String>],
        headers: &[String],
        rule: &ValidationRule,
    ) -> Vec<ValidationError> {
        let mut errors = Vec::new();
        let col_idx = rule.column_index;
        let mut seen = HashMap::new();

        for (row_idx, row) in data.iter().enumerate() {
            if let Some(value) = row.get(col_idx) {
                if !value.is_empty() {
                    if let Some(&first_row) = seen.get(value) {
                        errors.push(ValidationError {
                            row_index: row_idx,
                            column_index: col_idx,
                            column_name: headers.get(col_idx).cloned().unwrap_or_default(),
                            value: value.clone(),
                            rule_type: ValidationRuleType::Unique,
                            message: rule.error_message.clone().unwrap_or_else(|| {
                                format!("Duplicate value '{}' (first seen at row {})", value, first_row + 1)
                            }),
                        });
                    } else {
                        seen.insert(value.clone(), row_idx);
                    }
                }
            }
        }

        errors
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_range() {
        let mut params = HashMap::new();
        params.insert("min".to_string(), "0".to_string());
        params.insert("max".to_string(), "100".to_string());

        let rule = ValidationRule {
            rule_type: ValidationRuleType::Range,
            column_index: 0,
            column_name: "age".to_string(),
            parameters: params,
            error_message: None,
        };

        let validator = Validator::new(vec![rule]);
        let data = vec![
            vec!["50".to_string()],
            vec!["150".to_string()],
            vec!["-10".to_string()],
        ];
        let headers = vec!["age".to_string()];

        let errors = validator.validate(&data, &headers);
        assert_eq!(errors.len(), 2); // 150 and -10 are out of range
    }

    #[test]
    fn test_validate_required() {
        let rule = ValidationRule {
            rule_type: ValidationRuleType::Required,
            column_index: 0,
            column_name: "name".to_string(),
            parameters: HashMap::new(),
            error_message: None,
        };

        let validator = Validator::new(vec![rule]);
        let data = vec![
            vec!["John".to_string()],
            vec!["".to_string()],
            vec!["Jane".to_string()],
        ];
        let headers = vec!["name".to_string()];

        let errors = validator.validate(&data, &headers);
        assert_eq!(errors.len(), 1); // Empty string at row 1
    }

    #[test]
    fn test_validate_unique() {
        let rule = ValidationRule {
            rule_type: ValidationRuleType::Unique,
            column_index: 0,
            column_name: "id".to_string(),
            parameters: HashMap::new(),
            error_message: None,
        };

        let validator = Validator::new(vec![rule]);
        let data = vec![
            vec!["1".to_string()],
            vec!["2".to_string()],
            vec!["1".to_string()],
        ];
        let headers = vec!["id".to_string()];

        let errors = validator.validate(&data, &headers);
        assert_eq!(errors.len(), 1); // Duplicate "1" at row 2
    }
}
