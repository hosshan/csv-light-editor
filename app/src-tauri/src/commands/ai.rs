use crate::ai::{AiAssistant, DataChange};
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
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
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

    match assistant.detect_intent(&request.prompt).await {
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
#[tauri::command]
pub async fn ai_execute(
    request: ExecuteAiRequest,
) -> Result<ExecuteAiResponse, String> {
    let assistant = AiAssistant::new();

    // Check if CSV data is provided
    if request.headers.is_empty() || request.rows.is_empty() {
        return Ok(ExecuteAiResponse::Error {
            message: "No CSV data loaded. Please open a CSV file first.".to_string(),
        });
    }

    // Step 1: Detect intent
    let intent = assistant
        .detect_intent(&request.prompt).await
        .map_err(|e| format!("Failed to detect intent: {}", e))?;

    // Step 2: Limit rows based on config and request
    let max_rows = request.max_rows.unwrap_or(10000);
    let row_limit = max_rows.min(request.rows.len());
    let limited_rows = &request.rows[..row_limit];

    // Step 3: Execute the intent
    match assistant.execute_intent(&intent, &request.headers, limited_rows) {
        Ok(crate::ai::AiResponse::Analysis { summary, details, .. }) => {
            Ok(ExecuteAiResponse::Analysis {
                summary,
                details: serde_json::to_value(details).unwrap(),
            })
        }
        Ok(crate::ai::AiResponse::Transformation { changes, preview }) => {
            let preview_with_names: Vec<ChangePreview> = preview
                .iter()
                .map(|p| {
                    let column_name = request.headers
                        .get(p.column_index)
                        .cloned()
                        .unwrap_or_else(|| format!("Column {}", p.column_index));

                    ChangePreview {
                        row_index: p.row_index,
                        column_index: p.column_index,
                        column_name,
                        old_value: p.old_value.clone(),
                        new_value: p.new_value.clone(),
                    }
                })
                .collect();

            Ok(ExecuteAiResponse::Transformation {
                summary: format!("Found {} change(s)", changes.len()),
                change_count: changes.len(),
                preview: preview_with_names,
            })
        }
        Err(e) => Ok(ExecuteAiResponse::Error {
            message: format!("Execution failed: {}", e),
        }),
    }
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
