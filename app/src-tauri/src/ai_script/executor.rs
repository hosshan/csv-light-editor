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
        log::info!("[EXECUTE] Starting script execution");
        
        // Security validation
        log::info!("[EXECUTE] Step 1/8: Validating script security");
        self.security_validator.validate_script(&script.content)?;
        log::info!("[EXECUTE] Step 1/8: Security validation passed");

        // Create execution ID
        let execution_id = Uuid::new_v4().to_string();
        let total_rows = rows.len();
        log::info!("[EXECUTE] Step 2/8: Created execution ID: {}, total rows: {}", execution_id, total_rows);

        // Create progress tracker
        let progress = Arc::new(Mutex::new(ExecutionProgress::new(execution_id.clone(), total_rows)));
        let progress_clone = progress.clone();
        
        // Prepare CSV data as JSON
        let csv_data = serde_json::json!({
            "headers": headers,
            "rows": rows,
        });

        // Log script content for debugging
        log::info!("[EXECUTE] Generated Python script content:\n{}", script.content);
        log::debug!("Script path will be: {:?}",
            std::env::temp_dir().join(format!("csv_script_*.py")));

        // Create temporary script file
        let script_path = self.create_temp_script(&script.content)?;
        log::info!("Created temporary script at: {:?}", script_path);
        let script_path_clone = script_path.clone();

        // Create cancellation flag
        let cancelled = Arc::new(Mutex::new(false));
        let cancelled_clone = cancelled.clone();
        let execution_id_clone = execution_id.clone();
        let csv_data_clone = csv_data.clone();

        // Spawn execution task
        log::info!("[EXECUTE] Step 6/8: Spawning execution task");
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
        log::info!("[EXECUTE] Step 7/8: Storing active execution");
        let active_execution = ActiveExecution {
            handle,
            progress,
            cancelled,
        };

        {
            let mut executions = self.active_executions.lock().await;
            executions.insert(execution_id.clone(), active_execution);
        } // Release lock here

        // Wait for execution to complete
        log::info!("[EXECUTE] Step 8/8: Waiting for execution to complete");
        let result = {
            let mut executions = self.active_executions.lock().await;
            if let Some(exec) = executions.remove(&execution_id) {
                drop(executions); // Release lock before awaiting
                log::info!("[EXECUTE] Awaiting task completion...");
                match exec.handle.await {
                    Ok(result) => {
                        log::info!("[EXECUTE] Task completed, execution_id: {}", result.as_ref().map(|r| r.execution_id.as_str()).unwrap_or("error"));
                        result
                    }
                    Err(join_error) => {
                        log::error!("[EXECUTE] Task join error: {:?}", join_error);
                        return Err(anyhow!("Task execution failed: {}", join_error));
                    }
                }
            } else {
                log::error!("[EXECUTE] Execution not found in active executions");
                return Err(anyhow!("Execution not found"));
            }
        };

        // Clean up temp file
        log::info!("[EXECUTE] Cleaning up temporary script file");
        let _ = std::fs::remove_file(&script_path);

        log::info!("[EXECUTE] Script execution completed successfully");
        result
    }

    async fn execute_script_internal(
        script_path: PathBuf,
        csv_data: &serde_json::Value,
        execution_id: &str,
        _total_rows: usize,
        cancelled: Arc<Mutex<bool>>,
        progress_tracker: Option<Arc<Mutex<ExecutionProgress>>>,
        window: Option<tauri::Window>,
    ) -> Result<ExecutionResult> {
        let started_at = Utc::now();
        log::info!("[INTERNAL] Starting execute_script_internal for execution_id: {}", execution_id);
        log::info!("[INTERNAL] Script path: {:?}", script_path);

        // Start Python process
        log::info!("[INTERNAL] Step A: Starting Python process");
        let mut child = Command::new("python3")
            .arg("-u") // Unbuffered output
            .arg(&script_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .env("PYTHONPATH", "") // Restrict module imports
            .env("PYTHONDONTWRITEBYTECODE", "1")
            .spawn()
            .map_err(|e| {
                log::error!("[INTERNAL] Failed to start Python process: {}", e);
                anyhow!("Failed to start Python process: {}", e)
            })?;
        log::info!("[INTERNAL] Step A: Python process started (PID: {:?})", child.id());

        // Write CSV data to stdin
        log::info!("[INTERNAL] Step B: Writing CSV data to stdin");
        if let Some(mut stdin) = child.stdin.take() {
            let json_str = serde_json::to_string(csv_data)
                .map_err(|e| {
                    log::error!("[INTERNAL] Failed to serialize CSV data: {}", e);
                    e
                })?;
            log::info!("[INTERNAL] JSON data size: {} bytes (first 200 chars: {})", 
                json_str.len(),
                json_str.chars().take(200).collect::<String>());
            
            stdin.write_all(json_str.as_bytes())
                .map_err(|e| {
                    log::error!("[INTERNAL] Failed to write to stdin: {}", e);
                    e
                })?;
            stdin.write_all(b"\n")
                .map_err(|e| {
                    log::error!("[INTERNAL] Failed to write newline to stdin: {}", e);
                    e
                })?;
            stdin.flush()
                .map_err(|e| {
                    log::error!("[INTERNAL] Failed to flush stdin: {}", e);
                    e
                })?;
            log::info!("[INTERNAL] Step B: Finished writing to stdin");
        } else {
            log::error!("[INTERNAL] Step B: Failed to capture stdin for Python process");
            return Err(anyhow!("Failed to capture stdin for Python process"));
        }

        // Read stdout for progress and results
        log::info!("[INTERNAL] Step C: Capturing stdout");
        let stdout = child.stdout.take().ok_or_else(|| {
            log::error!("[INTERNAL] Failed to capture stdout");
            anyhow!("Failed to capture stdout")
        })?;
        let reader = BufReader::new(stdout);
        let mut output_lines = Vec::new();

        // Stream output
        log::info!("[INTERNAL] Step D: Starting to read stdout from Python process");
        let mut line_count = 0;
        for line in reader.lines() {
            // Check if cancelled
            {
                let is_cancelled = cancelled.lock().await;
                if *is_cancelled {
                    let _ = child.kill();
                    return Err(anyhow!("Execution cancelled"));
                }
            }

            let line = line.map_err(|e| {
                log::error!("[INTERNAL] Failed to read line from stdout: {}", e);
                e
            })?;
            line_count += 1;
            log::info!("[INTERNAL] Step D: Received line #{} from Python: {}", line_count, line);
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
        log::info!("[INTERNAL] Step E: Finished reading stdout ({} lines total), waiting for Python process to complete...", line_count);
        let status = child.wait().map_err(|e| {
            log::error!("[INTERNAL] Failed to wait for Python process: {}", e);
            e
        })?;
        log::info!("[INTERNAL] Step E: Python process completed with status: {:?} (success: {})", status, status.success());

        let completed_at = Some(Utc::now());

        // Parse result from last non-progress line
        log::info!("[INTERNAL] Step F: Parsing result from output ({} lines available)", output_lines.len());
        let result = if status.success() {
            log::info!("[INTERNAL] Step F: Process succeeded, looking for result JSON");
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
                .ok_or_else(|| {
                    log::error!("[INTERNAL] No result found in script output. Available lines: {:?}", output_lines);
                    anyhow!("No result found in script output")
                })?;

            log::info!("[INTERNAL] Step F: Found result line: {}", result_line);
            let parsed_result = Self::parse_result(result_line)?;
            log::info!("[INTERNAL] Step F: Successfully parsed result");
            parsed_result
        } else {
            log::warn!("[INTERNAL] Step F: Process failed, reading stderr");
            // Read stderr for error message
            let stderr = child.stderr.take();
            let error_msg = if let Some(stderr) = stderr {
                let mut reader = BufReader::new(stderr);
                let mut error_text = String::new();
                reader.read_to_string(&mut error_text)
                    .map_err(|e| {
                        log::error!("[INTERNAL] Failed to read stderr: {}", e);
                        e
                    })?;
                log::error!("[INTERNAL] Python stderr: {}", error_text);
                
                // Parse Python error message to make it more user-friendly
                let user_friendly_error = Self::parse_python_error(&error_text);
                user_friendly_error
            } else {
                log::warn!("[INTERNAL] No stderr available");
                "Script execution failed. Please check the generated script for errors.".to_string()
            };

            ResultPayload::Error {
                message: error_msg,
            }
        };

        log::info!("[INTERNAL] Step G: Creating ExecutionResult");
        let execution_result = ExecutionResult {
            execution_id: execution_id.to_string(),
            started_at,
            completed_at,
            result,
            error: if status.success() { None } else { Some("Script execution failed".to_string()) },
        };
        log::info!("[INTERNAL] Step G: ExecutionResult created successfully");
        log::info!("[INTERNAL] execute_script_internal completed for execution_id: {}", execution_id);
        Ok(execution_result)
    }

    /// Parse Python error message to make it more user-friendly
    fn parse_python_error(stderr: &str) -> String {
        let error_lines: Vec<&str> = stderr.lines().collect();
        
        // Look for common Python error patterns
        for line in &error_lines {
            if line.contains("IndentationError") {
                if let Some(detail) = error_lines.iter().find(|l| l.contains("unexpected indent") || l.contains("expected an indented block")) {
                    return format!("Python indentation error: The generated script has incorrect indentation. This is usually caused by the AI model generating code with inconsistent spacing. Please try regenerating the script.\n\nDetails: {}", detail.trim());
                }
                return "Python indentation error: The generated script has incorrect indentation. Please try regenerating the script.".to_string();
            }
            if line.contains("SyntaxError") {
                if let Some(detail) = error_lines.iter().find(|l| l.contains("invalid syntax")) {
                    return format!("Python syntax error: The generated script contains invalid syntax.\n\nDetails: {}", detail.trim());
                }
                return "Python syntax error: The generated script contains invalid syntax. Please try regenerating the script.".to_string();
            }
            if line.contains("NameError") {
                if let Some(detail) = error_lines.iter().find(|l| l.contains("is not defined")) {
                    let error_msg = if let Some(msg_line) = error_lines.iter().find(|l| l.contains("NameError:")) {
                        msg_line.trim()
                    } else {
                        detail.trim()
                    };
                    return format!("Python name error: A variable or function is used but not defined. This usually means the generated script is missing variable definitions or has incorrect variable names.\n\nDetails: {}", error_msg);
                }
                return "Python name error: A variable or function is used but not defined. Please try regenerating the script.".to_string();
            }
            if line.contains("TypeError") {
                if let Some(detail) = error_lines.iter().find(|l| l.contains("unsupported operand") || l.contains("not supported")) {
                    return format!("Python type error: An operation is performed on incompatible types.\n\nDetails: {}", detail.trim());
                }
                return "Python type error: An operation is performed on incompatible types. Please try regenerating the script.".to_string();
            }
            if line.contains("AttributeError") {
                if let Some(detail) = error_lines.iter().find(|l| l.contains("has no attribute")) {
                    return format!("Python attribute error: An object doesn't have the expected attribute.\n\nDetails: {}", detail.trim());
                }
                return "Python attribute error: An object doesn't have the expected attribute. Please try regenerating the script.".to_string();
            }
            if line.contains("ValueError") {
                // Check for specific ValueError patterns
                if let Some(detail) = error_lines.iter().find(|l| l.contains("time data") && l.contains("does not match format")) {
                    return format!("Data format error: The script expected a different date/time format than what's in your CSV data. The generated script may need to be adjusted to match your actual data format.\n\nDetails: {}", detail.trim());
                }
                if let Some(detail) = error_lines.iter().find(|l| l.contains("ValueError")) {
                    // Extract the actual error message
                    let error_msg = if let Some(msg_line) = error_lines.iter().find(|l| l.starts_with("ValueError:")) {
                        msg_line.trim()
                    } else {
                        detail.trim()
                    };
                    return format!("Data value error: The script encountered invalid data values.\n\nDetails: {}", error_msg);
                }
                return "Python value error: The script encountered invalid data values. Please check your CSV data or try regenerating the script.".to_string();
            }
            if line.contains("KeyError") {
                if let Some(detail) = error_lines.iter().find(|l| l.contains("KeyError")) {
                    let error_msg = if let Some(msg_line) = error_lines.iter().find(|l| l.starts_with("KeyError:")) {
                        msg_line.trim()
                    } else {
                        detail.trim()
                    };
                    return format!("Data key error: The script tried to access a column or key that doesn't exist in your data.\n\nDetails: {}", error_msg);
                }
                return "Python key error: The script tried to access a column or key that doesn't exist. Please check your CSV data or try regenerating the script.".to_string();
            }
            if line.contains("IndexError") {
                if let Some(detail) = error_lines.iter().find(|l| l.contains("IndexError")) {
                    let error_msg = if let Some(msg_line) = error_lines.iter().find(|l| l.starts_with("IndexError:")) {
                        msg_line.trim()
                    } else {
                        detail.trim()
                    };
                    return format!("Data index error: The script tried to access a row or column index that doesn't exist.\n\nDetails: {}", error_msg);
                }
                return "Python index error: The script tried to access a row or column index that doesn't exist. Please check your CSV data or try regenerating the script.".to_string();
            }
        }
        
        // If no specific error pattern found, return the first few lines of the error
        let error_summary: String = error_lines
            .iter()
            .take(5)
            .map(|l| l.trim())
            .filter(|l| !l.is_empty())
            .collect::<Vec<_>>()
            .join("\n");
        
        if error_summary.is_empty() {
            "Script execution failed. Please check the generated script for errors.".to_string()
        } else {
            format!("Script execution failed:\n\n{}", error_summary)
        }
    }

    fn parse_result(result_line: &str) -> Result<ResultPayload> {
        let json: serde_json::Value = serde_json::from_str(result_line)
            .map_err(|e| anyhow!("Failed to parse result JSON: {}", e))?;

        match json.get("type").and_then(|v| v.as_str()) {
            Some("analysis") => {
                // Handle summary as string, object, or array
                let summary = match json.get("summary") {
                    Some(v) if v.is_string() => {
                        v.as_str().unwrap_or("Analysis completed").to_string()
                    }
                    Some(v) if v.is_object() || v.is_array() => {
                        // Convert object/array to formatted JSON string
                        serde_json::to_string_pretty(v)
                            .unwrap_or_else(|_| "Analysis completed".to_string())
                    }
                    Some(v) => {
                        // For other types, convert to string
                        v.to_string()
                    }
                    None => "Analysis completed".to_string(),
                };
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

                Ok(ResultPayload::Transformation {
                    changes: Some(changes),
                    unified_changes: None,  // TODO: Parse unified_changes from Python output
                    preview
                })
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
