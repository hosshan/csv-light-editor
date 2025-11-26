// Data models for AI script generation and execution

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Script {
    pub id: String,
    pub content: String,
    pub script_type: ScriptType,
    pub generated_at: DateTime<Utc>,
    pub user_prompt: String,
    pub execution_state: ExecutionState,
    pub execution_result: Option<ExecutionResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ScriptType {
    Analysis,
    Transformation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExecutionState {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionResult {
    pub execution_id: String,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub result: ResultPayload,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ResultPayload {
    Analysis {
        summary: String,
        details: serde_json::Value,
    },
    Transformation {
        changes: Vec<DataChange>,
        preview: Vec<ChangePreview>,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataChange {
    pub row_index: usize,
    pub column_index: usize,
    pub old_value: String,
    pub new_value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangePreview {
    pub row_index: usize,
    pub column_index: usize,
    pub column_name: String,
    pub old_value: String,
    pub new_value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionContext {
    pub csv_path: Option<String>,
    pub headers: Vec<String>,
    pub row_count: usize,
    pub selected_range: Option<SelectionRange>,
    pub filter_state: Option<serde_json::Value>,
    pub sort_state: Option<serde_json::Value>,
    pub column_info: Option<Vec<ColumnInfo>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnInfo {
    pub column_index: usize,
    pub column_name: String,
    pub detected_type: String, // "integer", "float", "date", "datetime", "text", etc.
    pub format: Option<String>, // For datetime: "%Y-%m-%d %H:%M", etc.
    pub sample_values: Vec<String>, // First 5 non-empty values
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectionRange {
    pub start_row: usize,
    pub end_row: usize,
    pub start_column: usize,
    pub end_column: usize,
}

impl Script {
    pub fn new(content: String, script_type: ScriptType, user_prompt: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            content,
            script_type,
            generated_at: Utc::now(),
            user_prompt,
            execution_state: ExecutionState::Pending,
            execution_result: None,
        }
    }
}

