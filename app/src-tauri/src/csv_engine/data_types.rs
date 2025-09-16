use chrono::{NaiveDate, NaiveDateTime};
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum DataType {
    Integer,
    Float,
    Boolean,
    Date,
    DateTime,
    Email,
    Url,
    Json,
    Text,
}

pub struct DataTypeDetector {
    email_regex: Regex,
    url_regex: Regex,
}

impl DataTypeDetector {
    pub fn new() -> Self {
        Self {
            email_regex: Regex::new(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$").unwrap(),
            url_regex: Regex::new(r"^https?://[^\s/$.?#].[^\s]*$").unwrap(),
        }
    }

    pub fn detect_column_type(&self, values: &[String]) -> DataType {
        if values.is_empty() {
            return DataType::Text;
        }

        // Count occurrences of each type
        let mut type_counts = std::collections::HashMap::new();

        for value in values.iter().filter(|v| !v.is_empty()) {
            let detected_type = self.detect_value_type(value);
            *type_counts.entry(detected_type).or_insert(0) += 1;
        }

        // Find the most common type
        type_counts
            .into_iter()
            .max_by_key(|(_, count)| *count)
            .map(|(data_type, _)| data_type)
            .unwrap_or(DataType::Text)
    }

    pub fn detect_value_type(&self, value: &str) -> DataType {
        if value.is_empty() {
            return DataType::Text;
        }

        // Check boolean
        if value.eq_ignore_ascii_case("true") || value.eq_ignore_ascii_case("false") {
            return DataType::Boolean;
        }

        // Check integer
        if value.parse::<i64>().is_ok() {
            return DataType::Integer;
        }

        // Check float
        if value.parse::<f64>().is_ok() {
            return DataType::Float;
        }

        // Check date formats
        if NaiveDate::parse_from_str(value, "%Y-%m-%d").is_ok() ||
           NaiveDate::parse_from_str(value, "%d/%m/%Y").is_ok() ||
           NaiveDate::parse_from_str(value, "%m/%d/%Y").is_ok() {
            return DataType::Date;
        }

        // Check datetime formats
        if NaiveDateTime::parse_from_str(value, "%Y-%m-%d %H:%M:%S").is_ok() ||
           NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M:%S").is_ok() {
            return DataType::DateTime;
        }

        // Check email
        if self.email_regex.is_match(value) {
            return DataType::Email;
        }

        // Check URL
        if self.url_regex.is_match(value) {
            return DataType::Url;
        }

        // Check JSON
        if (value.starts_with('{') && value.ends_with('}')) ||
           (value.starts_with('[') && value.ends_with(']')) {
            if serde_json::from_str::<serde_json::Value>(value).is_ok() {
                return DataType::Json;
            }
        }

        DataType::Text
    }

    pub fn validate_value(&self, value: &str, data_type: &DataType) -> bool {
        if value.is_empty() {
            return true; // Empty values are allowed
        }

        match data_type {
            DataType::Integer => value.parse::<i64>().is_ok(),
            DataType::Float => value.parse::<f64>().is_ok(),
            DataType::Boolean => {
                value.eq_ignore_ascii_case("true") || value.eq_ignore_ascii_case("false")
            }
            DataType::Date => {
                NaiveDate::parse_from_str(value, "%Y-%m-%d").is_ok() ||
                NaiveDate::parse_from_str(value, "%d/%m/%Y").is_ok() ||
                NaiveDate::parse_from_str(value, "%m/%d/%Y").is_ok()
            }
            DataType::DateTime => {
                NaiveDateTime::parse_from_str(value, "%Y-%m-%d %H:%M:%S").is_ok() ||
                NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M:%S").is_ok()
            }
            DataType::Email => self.email_regex.is_match(value),
            DataType::Url => self.url_regex.is_match(value),
            DataType::Json => serde_json::from_str::<serde_json::Value>(value).is_ok(),
            DataType::Text => true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_integer() {
        let detector = DataTypeDetector::new();
        assert_eq!(detector.detect_value_type("123"), DataType::Integer);
        assert_eq!(detector.detect_value_type("-456"), DataType::Integer);
    }

    #[test]
    fn test_detect_float() {
        let detector = DataTypeDetector::new();
        assert_eq!(detector.detect_value_type("123.45"), DataType::Float);
        assert_eq!(detector.detect_value_type("-456.78"), DataType::Float);
    }

    #[test]
    fn test_detect_boolean() {
        let detector = DataTypeDetector::new();
        assert_eq!(detector.detect_value_type("true"), DataType::Boolean);
        assert_eq!(detector.detect_value_type("FALSE"), DataType::Boolean);
    }

    #[test]
    fn test_detect_date() {
        let detector = DataTypeDetector::new();
        assert_eq!(detector.detect_value_type("2024-01-15"), DataType::Date);
        assert_eq!(detector.detect_value_type("15/01/2024"), DataType::Date);
    }

    #[test]
    fn test_detect_email() {
        let detector = DataTypeDetector::new();
        assert_eq!(detector.detect_value_type("test@example.com"), DataType::Email);
    }

    #[test]
    fn test_detect_url() {
        let detector = DataTypeDetector::new();
        assert_eq!(detector.detect_value_type("https://example.com"), DataType::Url);
    }
}