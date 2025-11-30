// Data models for AI script generation and execution

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Script {
    pub id: String,
    pub content: String,
    #[serde(alias = "script_type")]
    pub script_type: ScriptType,
    #[serde(alias = "generated_at")]
    pub generated_at: DateTime<Utc>,
    #[serde(alias = "user_prompt")]
    pub user_prompt: String,
    #[serde(alias = "execution_state")]
    pub execution_state: ExecutionState,
    #[serde(alias = "execution_result")]
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
    #[serde(alias = "execution_id")]
    pub execution_id: String,
    #[serde(alias = "started_at")]
    pub started_at: DateTime<Utc>,
    #[serde(alias = "completed_at")]
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
        // Legacy format - backward compatibility
        #[serde(skip_serializing_if = "Option::is_none")]
        changes: Option<Vec<DataChange>>,
        // New unified format
        #[serde(skip_serializing_if = "Option::is_none")]
        unified_changes: Option<Vec<Change>>,
        preview: Vec<ChangePreview>,
    },
    Error {
        message: String,
    },
}

// Legacy format - kept for backward compatibility
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataChange {
    #[serde(alias = "row_index")]
    pub row_index: usize,
    #[serde(alias = "column_index")]
    pub column_index: usize,
    #[serde(alias = "old_value")]
    pub old_value: String,
    #[serde(alias = "new_value")]
    pub new_value: String,
}

// Unified change structure that supports all types of operations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Change {
    #[serde(rename = "cell")]
    Cell {
        #[serde(alias = "row_index")]
        row_index: usize,
        #[serde(alias = "column_index")]
        column_index: usize,
        #[serde(alias = "old_value")]
        old_value: String,
        #[serde(alias = "new_value")]
        new_value: String,
    },
    #[serde(rename = "add_column")]
    AddColumn {
        #[serde(alias = "column_index")]
        column_index: usize,
        #[serde(alias = "column_name")]
        column_name: String,
        position: ColumnPosition,
        #[serde(alias = "default_value")]
        default_value: Option<String>,
    },
    #[serde(rename = "remove_column")]
    RemoveColumn {
        #[serde(alias = "column_index")]
        column_index: usize,
        #[serde(alias = "column_name")]
        column_name: String,
    },
    #[serde(rename = "rename_column")]
    RenameColumn {
        #[serde(alias = "column_index")]
        column_index: usize,
        #[serde(alias = "old_name")]
        old_name: String,
        #[serde(alias = "new_name")]
        new_name: String,
    },
    #[serde(rename = "add_row")]
    AddRow {
        #[serde(alias = "row_index")]
        row_index: usize,
        position: RowPosition,
        #[serde(alias = "row_data")]
        row_data: Option<Vec<String>>,
    },
    #[serde(rename = "remove_row")]
    RemoveRow {
        #[serde(alias = "row_index")]
        row_index: usize,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ColumnPosition {
    Before,
    After,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RowPosition {
    Before,
    After,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangePreview {
    #[serde(alias = "row_index")]
    pub row_index: usize,
    #[serde(alias = "column_index")]
    pub column_index: usize,
    #[serde(alias = "column_name")]
    pub column_name: String,
    #[serde(alias = "old_value")]
    pub old_value: String,
    #[serde(alias = "new_value")]
    pub new_value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionContext {
    #[serde(alias = "csv_path")]
    pub csv_path: Option<String>,
    pub headers: Vec<String>,
    #[serde(alias = "row_count")]
    pub row_count: usize,
    #[serde(alias = "selected_range")]
    pub selected_range: Option<SelectionRange>,
    #[serde(alias = "filter_state")]
    pub filter_state: Option<serde_json::Value>,
    #[serde(alias = "sort_state")]
    pub sort_state: Option<serde_json::Value>,
    #[serde(alias = "column_info")]
    pub column_info: Option<Vec<ColumnInfo>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnInfo {
    #[serde(alias = "column_index")]
    pub column_index: usize,
    #[serde(alias = "column_name")]
    pub column_name: String,
    #[serde(alias = "detected_type")]
    pub detected_type: String, // "integer", "float", "date", "datetime", "text", etc.
    pub format: Option<String>, // For datetime: "%Y-%m-%d %H:%M", etc.
    #[serde(alias = "sample_values")]
    pub sample_values: Vec<String>, // First 5 non-empty values
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectionRange {
    #[serde(alias = "start_row")]
    pub start_row: usize,
    #[serde(alias = "end_row")]
    pub end_row: usize,
    #[serde(alias = "start_column")]
    pub start_column: usize,
    #[serde(alias = "end_column")]
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

