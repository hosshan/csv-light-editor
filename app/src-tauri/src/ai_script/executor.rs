// Script execution module
// Executes Python scripts with progress tracking and result parsing

use crate::ai_script::{Script, ExecutionResult, ExecutionProgress, ResultPayload, DataChange, ChangePreview};
use crate::ai_script::security::SecurityValidator;
use anyhow::{Result, anyhow};
use std::collections::HashMap;
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader, Write, Read};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;
use chrono::Utc;
use uuid::Uuid;
use serde_json;

pub struct ScriptExecutor {
    active_executions: Arc<Mutex<HashMap<String, ActiveExecution>>>,
    security_validator: SecurityValidator,
}

struct ActiveExecution {
    handle: JoinHandle<Result<ExecutionResult>>,
    progress: Arc<Mutex<ExecutionProgress>>,
    cancelled: Arc<Mutex<bool>>,
}

impl ScriptExecutor {
    pub fn new() -> Self {
        Self {
            active_executions: Arc::new(Mutex::new(HashMap::new())),
            security_validator: SecurityValidator::new(),
        }
    }

    pub async fn execute_script(
        &self,
        script: &Script,
        headers: &[String],
        rows: &[Vec<String>],
        window: Option<tauri::Window>,
    ) -> Result<ExecutionResult> {
        // Security validation
        self.security_validator.validate_script(&script.content)?;

        // Create execution ID
        let execution_id = Uuid::new_v4().to_string();
        let total_rows = rows.len();

        // Create progress tracker
        let progress = Arc::new(Mutex::new(ExecutionProgress::new(execution_id.clone(), total_rows)));
        let progress_clone = progress.clone();
        
        // Prepare CSV data as JSON
        let csv_data = serde_json::json!({
            "headers": headers,
            "rows": rows,
        });

        // Create temporary script file
        let script_path = self.create_temp_script(&script.content)?;
        let script_path_clone = script_path.clone();

        // Create cancellation flag
        let cancelled = Arc::new(Mutex::new(false));
        let cancelled_clone = cancelled.clone();
        let execution_id_clone = execution_id.clone();
        let csv_data_clone = csv_data.clone();

        // Spawn execution task
        let handle = tokio::spawn(async move {
            Self::execute_script_internal(
                script_path_clone,
                &csv_data_clone,
                &execution_id_clone,
                total_rows,
                cancelled_clone,
                Some(progress_clone),
                window,
            ).await
        });

        // Store active execution
        let active_execution = ActiveExecution {
            handle,
            progress,
            cancelled,
        };

        let mut executions = self.active_executions.lock().await;
        executions.insert(execution_id.clone(), active_execution);

        // Wait for execution to complete
        let result = {
            let mut executions = self.active_executions.lock().await;
            if let Some(exec) = executions.remove(&execution_id) {
                drop(executions); // Release lock before awaiting
                exec.handle.await?
            } else {
                return Err(anyhow!("Execution not found"));
            }
        };

        // Clean up temp file
        let _ = std::fs::remove_file(&script_path);

        result
    }

    async fn execute_script_internal(
        script_path: PathBuf,
        csv_data: &serde_json::Value,
        execution_id: &str,
        total_rows: usize,
        cancelled: Arc<Mutex<bool>>,
        progress_tracker: Option<Arc<Mutex<ExecutionProgress>>>,
        window: Option<tauri::Window>,
    ) -> Result<ExecutionResult> {
        let started_at = Utc::now();

        // Start Python process
        let mut child = Command::new("python3")
            .arg("-u") // Unbuffered output
            .arg(script_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .env("PYTHONPATH", "") // Restrict module imports
            .env("PYTHONDONTWRITEBYTECODE", "1")
            .spawn()
            .map_err(|e| anyhow!("Failed to start Python process: {}", e))?;

        // Write CSV data to stdin
        if let Some(mut stdin) = child.stdin.take() {
            let json_str = serde_json::to_string(csv_data)?;
            stdin.write_all(json_str.as_bytes())?;
            stdin.flush()?;
        }

        // Read stdout for progress and results
        let stdout = child.stdout.take().ok_or_else(|| anyhow!("Failed to capture stdout"))?;
        let reader = BufReader::new(stdout);
        let mut output_lines = Vec::new();

        // Stream output
        for line in reader.lines() {
            // Check if cancelled
            {
                let is_cancelled = cancelled.lock().await;
                if *is_cancelled {
                    let _ = child.kill();
                    return Err(anyhow!("Execution cancelled"));
                }
            }

            let line = line?;
            output_lines.push(line.clone());

            // Try to parse as progress update
            if let Ok(progress_json) = serde_json::from_str::<serde_json::Value>(&line) {
                if progress_json.get("type").and_then(|v| v.as_str()) == Some("progress") {
                    // Update progress tracker if available
                    if let Some(tracker) = &progress_tracker {
                        if let (Some(processed), Some(total), Some(step)) = (
                            progress_json.get("processed").and_then(|v| v.as_u64()),
                            progress_json.get("total").and_then(|v| v.as_u64()),
                            progress_json.get("step").and_then(|v| v.as_str()),
                        ) {
                            let mut progress = tracker.lock().await;
                            progress.update(processed as usize, step.to_string());
                            
                            // Emit Tauri event if window is available
                            if let Some(ref win) = window {
                                let _ = win.emit("script-progress", serde_json::json!({
                                    "executionId": execution_id,
                                    "progress": {
                                        "executionId": execution_id,
                                        "processedRows": processed,
                                        "totalRows": total,
                                        "currentStep": step,
                                        "progressPercentage": progress.progress_percentage,
                                        "startedAt": progress.started_at,
                                        "lastUpdated": progress.last_updated,
                                    }
                                }));
                            }
                        }
                    }
                    log::debug!("Progress update: {}", line);
                    continue;
                }
            }
        }

        // Wait for process to complete
        let status = child.wait()?;

        let completed_at = Some(Utc::now());

        // Parse result from last non-progress line
        let result = if status.success() {
            // Find the last JSON result (not progress)
            let result_line = output_lines
                .iter()
                .rev()
                .find(|line| {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                        json.get("type").and_then(|v| v.as_str()) != Some("progress")
                    } else {
                        false
                    }
                })
                .ok_or_else(|| anyhow!("No result found in script output"))?;

            Self::parse_result(result_line)?
        } else {
            // Read stderr for error message
            let stderr = child.stderr.take();
            let error_msg = if let Some(stderr) = stderr {
                let mut reader = BufReader::new(stderr);
                let mut error_text = String::new();
                reader.read_to_string(&mut error_text)?;
                error_text.trim().to_string()
            } else {
                "Script execution failed".to_string()
            };

            ResultPayload::Error {
                message: error_msg,
            }
        };

        Ok(ExecutionResult {
            execution_id: execution_id.to_string(),
            started_at,
            completed_at,
            result,
            error: if status.success() { None } else { Some("Script execution failed".to_string()) },
        })
    }

    fn parse_result(result_line: &str) -> Result<ResultPayload> {
        let json: serde_json::Value = serde_json::from_str(result_line)
            .map_err(|e| anyhow!("Failed to parse result JSON: {}", e))?;

        match json.get("type").and_then(|v| v.as_str()) {
            Some("analysis") => {
                let summary = json.get("summary")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Analysis completed")
                    .to_string();
                let details = json.get("details").cloned().unwrap_or(serde_json::json!({}));
                Ok(ResultPayload::Analysis { summary, details })
            }
            Some("transformation") => {
                let changes: Vec<DataChange> = json.get("changes")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|item| {
                                Some(DataChange {
                                    row_index: item.get("row")?.as_u64()? as usize,
                                    column_index: item.get("col")?.as_u64()? as usize,
                                    old_value: item.get("old_value")?.as_str()?.to_string(),
                                    new_value: item.get("new_value")?.as_str()?.to_string(),
                                })
                            })
                            .collect()
                    })
                    .unwrap_or_default();

                let preview: Vec<ChangePreview> = json.get("preview")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|item| {
                                Some(ChangePreview {
                                    row_index: item.get("row")?.as_u64()? as usize,
                                    column_index: item.get("col")?.as_u64()? as usize,
                                    column_name: item.get("column_name")?.as_str()?.to_string(),
                                    old_value: item.get("old_value")?.as_str()?.to_string(),
                                    new_value: item.get("new_value")?.as_str()?.to_string(),
                                })
                            })
                            .collect()
                    })
                    .unwrap_or_default();

                Ok(ResultPayload::Transformation { changes, preview })
            }
            Some("error") => {
                let message = json.get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown error")
                    .to_string();
                Ok(ResultPayload::Error { message })
            }
            _ => Err(anyhow!("Unknown result type")),
        }
    }

    fn create_temp_script(&self, script_content: &str) -> Result<PathBuf> {
        use std::fs;
        use std::io::Write;

        let temp_dir = std::env::temp_dir();
        let script_name = format!("csv_script_{}.py", Uuid::new_v4());
        let script_path = temp_dir.join(script_name);

        let mut file = fs::File::create(&script_path)?;
        file.write_all(script_content.as_bytes())?;
        file.flush()?;

        Ok(script_path)
    }

    pub async fn get_progress(&self, execution_id: &str) -> Option<ExecutionProgress> {
        let executions = self.active_executions.lock().await;
        if let Some(exec) = executions.get(execution_id) {
            // Get current progress from the tracker
            let progress = exec.progress.lock().await;
            Some(progress.clone())
        } else {
            None
        }
    }

    pub async fn cancel_execution(&self, execution_id: &str) -> Result<()> {
        let mut executions = self.active_executions.lock().await;
        if let Some(exec) = executions.get_mut(execution_id) {
            let mut cancelled = exec.cancelled.lock().await;
            *cancelled = true;
            Ok(())
        } else {
            Err(anyhow!("Execution not found"))
        }
    }
}

impl Default for ScriptExecutor {
    fn default() -> Self {
        Self::new()
    }
}
