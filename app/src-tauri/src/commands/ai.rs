use crate::ai::{AiAssistant, AiResponse, DataChange};
use crate::state::AppState;
use anyhow::Result;
use serde::{Deserialize, Serialize};

/// Request to detect user intent from a prompt
#[derive(Debug, Deserialize)]
pub struct DetectIntentRequest {
    pub prompt: String,
}

/// Response with detected intent
#[derive(Debug, Serialize)]
pub struct DetectIntentResponse {
    pub intent_type: String,
    pub target_scope: String,
    pub confidence: f32,
    pub description: String,
}

/// Request to execute an AI operation
#[derive(Debug, Deserialize)]
pub struct ExecuteAiRequest {
    pub prompt: String,
    pub max_rows: Option<usize>, // Limit data sent for processing
}

/// Response with AI execution results
#[derive(Debug, Serialize)]
#[serde(tag = "type")]
pub enum ExecuteAiResponse {
    Analysis {
        summary: String,
        details: serde_json::Value,
    },
    Transformation {
        summary: String,
        change_count: usize,
        preview: Vec<ChangePreview>,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChangePreview {
    pub row_index: usize,
    pub column_index: usize,
    pub column_name: String,
    pub old_value: String,
    pub new_value: String,
}

/// Apply detected changes to the CSV data
#[derive(Debug, Deserialize)]
pub struct ApplyChangesRequest {
    pub changes: Vec<DataChange>,
}

/// Stage 1: Detect intent from user prompt
/// This is fast and doesn't require loading all CSV data
#[tauri::command]
pub async fn ai_detect_intent(
    request: DetectIntentRequest,
) -> Result<DetectIntentResponse, String> {
    let assistant = AiAssistant::new();

    match assistant.detect_intent(&request.prompt) {
        Ok(intent) => {
            let intent_type = match &intent.intent_type {
                crate::ai::IntentType::Analysis { analysis_type } => {
                    format!("analysis:{:?}", analysis_type)
                }
                crate::ai::IntentType::Transformation { operation } => {
                    format!("transformation:{:?}", operation)
                }
            };

            let target_scope = match &intent.target_scope {
                crate::ai::TargetScope::AllData => "all_data".to_string(),
                crate::ai::TargetScope::Column { name } => format!("column:{}", name),
                crate::ai::TargetScope::Columns { names } => {
                    format!("columns:{}", names.join(","))
                }
                crate::ai::TargetScope::Selection { .. } => "selection".to_string(),
            };

            let description = generate_intent_description(&intent);

            Ok(DetectIntentResponse {
                intent_type,
                target_scope,
                confidence: intent.confidence,
                description,
            })
        }
        Err(e) => Err(format!("Failed to detect intent: {}", e)),
    }
}

/// Stage 2: Execute the AI operation with relevant data
/// Only the necessary data is loaded based on detected intent
/// Note: This is a simplified implementation that doesn't use state
/// In a full implementation, we'd load CSV data from the state
#[tauri::command]
pub async fn ai_execute(
    request: ExecuteAiRequest,
) -> Result<ExecuteAiResponse, String> {
    let assistant = AiAssistant::new();

    // Step 1: Detect intent
    let intent = assistant
        .detect_intent(&request.prompt)
        .map_err(|e| format!("Failed to detect intent: {}", e))?;

    // For now, return error message instructing to load CSV data
    // In production, this would integrate with the state management
    Ok(ExecuteAiResponse::Error {
        message: "AI execution requires integration with CSV data state. This is a prototype implementation demonstrating the 2-stage AI architecture (intent detection → execution).".to_string(),
    })
}

/// Apply transformation changes to the CSV data
/// Note: This is a prototype implementation
#[tauri::command]
pub async fn ai_apply_changes(
    request: ApplyChangesRequest,
) -> Result<usize, String> {
    // Simplified implementation for prototype
    Ok(request.changes.len())
}

fn generate_intent_description(intent: &crate::ai::Intent) -> String {
    match &intent.intent_type {
        crate::ai::IntentType::Analysis { analysis_type } => {
            let analysis_desc = match analysis_type {
                crate::ai::AnalysisType::Statistics => "Calculate statistics (mean, median, std dev, etc.)",
                crate::ai::AnalysisType::Distribution => "Analyze value distribution and frequency",
                crate::ai::AnalysisType::Correlation => "Compute correlations between numeric columns",
                crate::ai::AnalysisType::Outliers => "Detect outliers using IQR method",
                crate::ai::AnalysisType::Missing => "Analyze missing values",
                crate::ai::AnalysisType::Duplicates => "Detect duplicate rows",
                crate::ai::AnalysisType::Summary => "Generate dataset summary",
            };

            let scope_desc = match &intent.target_scope {
                crate::ai::TargetScope::AllData => "for all data",
                crate::ai::TargetScope::Column { name } => &format!("for column '{}'", name),
                crate::ai::TargetScope::Columns { names } => {
                    &format!("for columns: {}", names.join(", "))
                }
                crate::ai::TargetScope::Selection { .. } => "for selected data",
            };

            format!("{} {}", analysis_desc, scope_desc)
        }
        crate::ai::IntentType::Transformation { operation } => {
            let operation_desc = match operation {
                crate::ai::TransformOperation::Normalize => "Normalize values to 0-1 range",
                crate::ai::TransformOperation::FormatDates { target_format } => {
                    &format!("Format dates to {}", target_format)
                }
                crate::ai::TransformOperation::FormatNumbers { decimal_places } => {
                    &format!("Format numbers to {} decimal places", decimal_places)
                }
                crate::ai::TransformOperation::RemoveDuplicates => "Remove duplicate rows",
                crate::ai::TransformOperation::FillMissing { strategy } => {
                    &format!("Fill missing values using {} strategy", strategy)
                }
                crate::ai::TransformOperation::Capitalize => "Capitalize each word",
                crate::ai::TransformOperation::Lowercase => "Convert to lowercase",
                crate::ai::TransformOperation::Uppercase => "Convert to uppercase",
                crate::ai::TransformOperation::Trim => "Remove leading/trailing whitespace",
                crate::ai::TransformOperation::Replace { from, to } => {
                    &format!("Replace '{}' with '{}'", from, to)
                }
            };

            let scope_desc = match &intent.target_scope {
                crate::ai::TargetScope::AllData => "in all data",
                crate::ai::TargetScope::Column { name } => &format!("in column '{}'", name),
                crate::ai::TargetScope::Columns { names } => {
                    &format!("in columns: {}", names.join(", "))
                }
                crate::ai::TargetScope::Selection { .. } => "in selected data",
            };

            format!("{} {}", operation_desc, scope_desc)
        }
    }
}
