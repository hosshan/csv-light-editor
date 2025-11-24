use crate::ai::{AiAssistant, DataChange};
use crate::ai_script::{Script, ExecutionContext, ResultPayload, ScriptType};
use crate::ai_script::generator::ScriptGenerator;
use crate::state::{ScriptExecutorState, AppState};
use crate::chat::ChatHistory;
use crate::metadata::MetadataManager;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use tauri::{State, Window};
use std::path::PathBuf;

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

// ============================================================================
// New AI Chat Commands (Script Generation & Execution)
// ============================================================================

/// Request to generate a script from user prompt
#[derive(Debug, Deserialize)]
pub struct GenerateScriptRequest {
    pub prompt: String,
    pub csv_context: ExecutionContext,
}

/// Response with generated script
#[derive(Debug, Serialize)]
pub struct GenerateScriptResponse {
    pub script: Script,
    pub script_type: String, // "analysis" or "transformation"
    pub requires_approval: bool,
}

/// Generate a Python script from user prompt
#[tauri::command]
pub async fn generate_script(
    prompt: String,
    csv_context: ExecutionContext,
) -> Result<GenerateScriptResponse, String> {
    let generator = ScriptGenerator::new();
    
    match generator.generate_script(&prompt, &csv_context).await {
        Ok(script) => {
            let script_type_str = match &script.script_type {
                ScriptType::Analysis => "analysis",
                ScriptType::Transformation => "transformation",
            };
            let requires_approval = matches!(&script.script_type, ScriptType::Transformation);
            
            Ok(GenerateScriptResponse {
                script,
                script_type: script_type_str.to_string(),
                requires_approval,
            })
        }
        Err(e) => {
            let error_str = e.to_string();
            let error_msg = if error_str.contains("API key") || error_str.contains("authentication") {
                "API key not configured. Please set your API key in settings.".to_string()
            } else if error_str.contains("network") || error_str.contains("fetch") {
                "Network error. Please check your internet connection.".to_string()
            } else if error_str.contains("timeout") {
                "Request timed out. Please try again.".to_string()
            } else if error_str.contains("rate limit") {
                "Rate limit exceeded. Please wait a moment and try again.".to_string()
            } else {
                format!("Failed to generate script: {}", e)
            };
            Err(error_msg)
        }
    }
}

/// Request to execute a script
#[derive(Debug, Deserialize)]
pub struct ExecuteScriptRequest {
    pub script: Script,
    pub approval: bool,
    pub csv_data: CsvDataInput,
}

#[derive(Debug, Deserialize)]
pub struct CsvDataInput {
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

/// Response with execution result
#[derive(Debug, Serialize)]
pub struct ExecuteScriptResponse {
    pub execution_id: String,
    pub result: ResultPayload,
    pub changes: Option<Vec<crate::ai_script::DataChange>>,
}

/// Execute a Python script
#[tauri::command]
pub async fn execute_script(
    script: Script,
    approval: bool,
    csv_data: CsvDataInput,
    executor_state: State<'_, ScriptExecutorState>,
    window: Window,
) -> Result<ExecuteScriptResponse, String> {
    // Check if approval is required for transformation scripts
    let requires_approval = matches!(script.script_type, ScriptType::Transformation);
    if requires_approval && !approval {
        return Err("Script execution requires approval".to_string());
    }

    let executor = executor_state.0.lock().await;
    
    match executor.execute_script(&script, &csv_data.headers, &csv_data.rows, Some(window)).await {
        Ok(execution_result) => {
            let changes = match &execution_result.result {
                ResultPayload::Transformation { changes, .. } => Some(changes.clone()),
                _ => None,
            };

            Ok(ExecuteScriptResponse {
                execution_id: execution_result.execution_id.clone(),
                result: execution_result.result,
                changes,
            })
        }
                Err(e) => {
                    let error_str = e.to_string();
                    let error_msg = if error_str.contains("security") || error_str.contains("validation") {
                        "The script contains potentially unsafe operations and was blocked for security reasons.".to_string()
                    } else if error_str.contains("python") || error_str.contains("syntax") {
                        "Python syntax error. The generated script may need to be reviewed.".to_string()
                    } else if error_str.contains("timeout") || error_str.contains("cancelled") {
                        "Execution was cancelled or timed out.".to_string()
                    } else if error_str.contains("permission") || error_str.contains("access") {
                        "Permission denied. The script may be trying to access restricted resources.".to_string()
                    } else {
                        format!("Script execution failed: {}", e)
                    };
                    Err(error_msg)
                }
    }
}

/// Request to get script execution progress
#[derive(Debug, Deserialize)]
pub struct GetScriptProgressRequest {
    pub execution_id: String,
}

/// Response with progress information
#[derive(Debug, Serialize)]
pub struct GetScriptProgressResponse {
    pub progress: crate::ai_script::ExecutionProgress,
    pub is_completed: bool,
}

/// Get script execution progress
#[tauri::command]
pub async fn get_script_progress(
    execution_id: String,
    executor_state: State<'_, ScriptExecutorState>,
) -> Result<GetScriptProgressResponse, String> {
    let executor = executor_state.0.lock().await;
    
    match executor.get_progress(&execution_id).await {
        Some(progress) => {
            // Check if execution is still active
            // If progress is at 100%, it's likely completed
            let is_completed = progress.progress_percentage >= 100.0;
            Ok(GetScriptProgressResponse {
                progress,
                is_completed,
            })
        }
        None => Err("Execution not found".to_string()),
    }
}

/// Request to cancel script execution
#[derive(Debug, Deserialize)]
pub struct CancelScriptExecutionRequest {
    pub execution_id: String,
}

/// Response with cancellation result
#[derive(Debug, Serialize)]
pub struct CancelScriptExecutionResponse {
    pub success: bool,
    pub message: String,
}

/// Cancel script execution
#[tauri::command]
pub async fn cancel_script_execution(
    execution_id: String,
    executor_state: State<'_, ScriptExecutorState>,
) -> Result<CancelScriptExecutionResponse, String> {
    let executor = executor_state.0.lock().await;
    
    match executor.cancel_execution(&execution_id).await {
        Ok(()) => Ok(CancelScriptExecutionResponse {
            success: true,
            message: "Execution cancelled".to_string(),
        }),
        Err(e) => Ok(CancelScriptExecutionResponse {
            success: false,
            message: format!("Failed to cancel execution: {}", e),
        }),
    }
}

/// Request to save chat history
#[derive(Debug, Deserialize)]
pub struct SaveChatHistoryRequest {
    pub csv_path: String,
    pub history: ChatHistory,
}

/// Response with save result
#[derive(Debug, Serialize)]
pub struct SaveChatHistoryResponse {
    pub success: bool,
    pub message: String,
}

/// Save chat history to metadata
#[tauri::command]
pub async fn save_chat_history(
    csv_path: String,
    history: ChatHistory,
    app_state: State<'_, AppState>,
) -> Result<SaveChatHistoryResponse, String> {
    let path = PathBuf::from(&csv_path);
    
    let mut state = app_state.lock().await;
    
    match state.metadata_manager.save_chat_history(&path, history) {
        Ok(()) => Ok(SaveChatHistoryResponse {
            success: true,
            message: "Chat history saved successfully".to_string(),
        }),
        Err(e) => Ok(SaveChatHistoryResponse {
            success: false,
            message: format!("Failed to save chat history: {}", e),
        }),
    }
}

/// Request to load chat history
#[derive(Debug, Deserialize)]
pub struct LoadChatHistoryRequest {
    pub csv_path: String,
}

/// Response with chat history
#[derive(Debug, Serialize)]
pub struct LoadChatHistoryResponse {
    pub history: Option<ChatHistory>,
}

/// Load chat history from metadata
#[tauri::command]
pub async fn load_chat_history(
    csv_path: String,
    app_state: State<'_, AppState>,
) -> Result<LoadChatHistoryResponse, String> {
    let path = PathBuf::from(&csv_path);
    
    let mut state = app_state.lock().await;
    
    match state.metadata_manager.load_chat_history(&path) {
        Ok(history) => Ok(LoadChatHistoryResponse {
            history,
        }),
        Err(e) => Err(format!("Failed to load chat history: {}", e)),
    }
}
