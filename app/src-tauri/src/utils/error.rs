use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Serialize, Deserialize)]
pub struct AppError {
    pub message: String,
    pub code: String,
}

impl AppError {
    pub fn new(message: impl Into<String>, code: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            code: code.into(),
        }
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl std::error::Error for AppError {}

impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        AppError::new(error.to_string(), "IO_ERROR")
    }
}

impl From<csv::Error> for AppError {
    fn from(error: csv::Error) -> Self {
        AppError::new(error.to_string(), "CSV_ERROR")
    }
}

impl From<anyhow::Error> for AppError {
    fn from(error: anyhow::Error) -> Self {
        AppError::new(error.to_string(), "GENERAL_ERROR")
    }
}