use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use async_trait::async_trait;

use super::{Intent, IntentType, TargetScope, AnalysisType, TransformOperation};
use crate::ai_script::ExecutionContext;

/// LLM Provider types
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub enum LlmProvider {
    OpenAI,
    Gemini,
    Local,
}

/// Trait for LLM clients
#[async_trait]
pub trait LlmClient: Send + Sync {
    async fn detect_intent(&self, prompt: &str) -> Result<Intent>;
    
    /// Generate a Python script from user prompt and CSV context
    async fn generate_script(
        &self,
        prompt: &str,
        csv_context: &ExecutionContext,
    ) -> Result<String>;
}

/// OpenAI API client
pub struct OpenAiClient {
    api_key: String,
    endpoint: String,
    model: String,
}

impl OpenAiClient {
    pub fn new(api_key: String, model: Option<String>) -> Self {
        Self {
            api_key,
            endpoint: "https://api.openai.com/v1/chat/completions".to_string(),
            model: model.unwrap_or_else(|| "gpt-4o-mini".to_string()),
        }
    }

    fn create_system_prompt() -> String {
        r#"You are an AI assistant for a CSV data editor. Your job is to understand user requests about CSV data operations and return structured JSON responses.

Analyze the user's request and determine:
1. Type of operation (analysis or transformation)
2. Specific operation to perform
3. Target scope (which columns/data to operate on)

Return ONLY a valid JSON object in this exact format:

For ANALYSIS requests:
{
  "intent_type": "analysis",
  "analysis_type": "statistics" | "distribution" | "correlation" | "outliers" | "missing" | "duplicates" | "summary",
  "target_scope": {
    "type": "all_data" | "column" | "columns",
    "column_name": "column name" (optional, for single column),
    "column_names": ["col1", "col2"] (optional, for multiple columns)
  }
}

For TRANSFORMATION requests:
{
  "intent_type": "transformation",
  "operation": "normalize" | "format_dates" | "format_numbers" | "remove_duplicates" | "fill_missing" | "capitalize" | "lowercase" | "uppercase" | "trim" | "replace",
  "parameters": {
    "target_format": "YYYY-MM-DD" (for format_dates),
    "decimal_places": 2 (for format_numbers),
    "strategy": "mean" | "median" | "mode" | "zero" | "forward" (for fill_missing),
    "from": "text", "to": "replacement" (for replace)
  },
  "target_scope": {
    "type": "all_data" | "column" | "columns",
    "column_name": "column name" (optional),
    "column_names": ["col1", "col2"] (optional)
  }
}

Analysis types:
- statistics: Calculate mean, median, std dev, etc.
- distribution: Show value frequency and distribution
- correlation: Find correlations between numeric columns
- outliers: Detect outliers using statistical methods
- missing: Analyze missing/empty values
- duplicates: Find duplicate rows
- summary: General dataset overview

Transformation operations:
- normalize: Scale values to 0-1 range
- format_dates: Standardize date format
- format_numbers: Format decimal places
- remove_duplicates: Remove duplicate rows
- fill_missing: Fill empty values
- capitalize: Capitalize first letter of each word
- lowercase: Convert to lowercase
- uppercase: Convert to uppercase
- trim: Remove leading/trailing whitespace
- replace: Find and replace text

Return ONLY the JSON object, no other text."#.to_string()
    }
}

#[async_trait]
impl LlmClient for OpenAiClient {
    async fn detect_intent(&self, prompt: &str) -> Result<Intent> {
        #[derive(Serialize)]
        struct OpenAiRequest {
            model: String,
            messages: Vec<OpenAiMessage>,
            temperature: f32,
            response_format: ResponseFormat,
        }

        #[derive(Serialize)]
        struct ResponseFormat {
            #[serde(rename = "type")]
            format_type: String,
        }

        #[derive(Serialize)]
        struct OpenAiMessage {
            role: String,
            content: String,
        }

        #[derive(Deserialize)]
        struct OpenAiResponse {
            choices: Vec<OpenAiChoice>,
        }

        #[derive(Deserialize)]
        struct OpenAiChoice {
            message: OpenAiResponseMessage,
        }

        #[derive(Deserialize)]
        struct OpenAiResponseMessage {
            content: String,
        }

        let request = OpenAiRequest {
            model: self.model.clone(),
            messages: vec![
                OpenAiMessage {
                    role: "system".to_string(),
                    content: Self::create_system_prompt(),
                },
                OpenAiMessage {
                    role: "user".to_string(),
                    content: prompt.to_string(),
                },
            ],
            temperature: 0.1,
            response_format: ResponseFormat {
                format_type: "json_object".to_string(),
            },
        };

        let client = reqwest::Client::new();
        let response = client
            .post(&self.endpoint)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| anyhow!("Failed to call OpenAI API: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow!("OpenAI API error {}: {}", status, error_text));
        }

        let openai_response: OpenAiResponse = response
            .json()
            .await
            .map_err(|e| anyhow!("Failed to parse OpenAI response: {}", e))?;

        let content = openai_response
            .choices
            .first()
            .ok_or_else(|| anyhow!("No response from OpenAI"))?
            .message
            .content
            .clone();

        log::debug!("OpenAI response: {}", content);

        parse_llm_response(&content)
    }

    async fn generate_script(
        &self,
        prompt: &str,
        csv_context: &ExecutionContext,
    ) -> Result<String> {
        #[derive(Serialize)]
        struct OpenAiRequest {
            model: String,
            messages: Vec<OpenAiMessage>,
            temperature: f32,
        }

        #[derive(Serialize)]
        struct OpenAiMessage {
            role: String,
            content: String,
        }

        #[derive(Deserialize)]
        struct OpenAiResponse {
            choices: Vec<OpenAiChoice>,
        }

        #[derive(Deserialize)]
        struct OpenAiChoice {
            message: OpenAiResponseMessage,
        }

        #[derive(Deserialize)]
        struct OpenAiResponseMessage {
            content: String,
        }

        // Create system prompt for script generation
        let system_prompt = Self::create_script_generation_prompt(csv_context);

        let request = OpenAiRequest {
            model: self.model.clone(),
            messages: vec![
                OpenAiMessage {
                    role: "system".to_string(),
                    content: system_prompt,
                },
                OpenAiMessage {
                    role: "user".to_string(),
                    content: prompt.to_string(),
                },
            ],
            temperature: 0.2, // Lower temperature for more deterministic code generation
        };

        let client = reqwest::Client::new();
        let response = client
            .post(&self.endpoint)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| anyhow!("Failed to call OpenAI API: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow!("OpenAI API error {}: {}", status, error_text));
        }

        let openai_response: OpenAiResponse = response
            .json()
            .await
            .map_err(|e| anyhow!("Failed to parse OpenAI response: {}", e))?;

        let content = openai_response
            .choices
            .first()
            .ok_or_else(|| anyhow!("No response from OpenAI"))?
            .message
            .content
            .clone();

        log::debug!("OpenAI script generation response: {}", content);

        // Extract Python code from response (may include markdown code blocks)
        extract_python_code(&content)
    }
}

impl OpenAiClient {
    fn create_script_generation_prompt(context: &ExecutionContext) -> String {
        let sample_rows = if context.row_count > 0 && !context.headers.is_empty() {
            format!(
                "\nSample data:\nHeaders: {}\nRow count: {}",
                context.headers.join(", "),
                context.row_count
            )
        } else {
            String::new()
        };

        let selected_range_info = if let Some(range) = &context.selected_range {
            format!(
                "\nSelected range: rows {}-{}, columns {}-{}",
                range.start_row, range.end_row, range.start_column, range.end_column
            )
        } else {
            String::new()
        };

        // Add column information if available
        let column_info = if let Some(ref columns) = context.column_info {
            let mut info_lines = vec!["\nColumn Information:".to_string()];
            for col in columns {
                let mut col_info = format!("  - {} (index {}): type={}", col.column_name, col.column_index, col.detected_type);
                if let Some(ref format) = col.format {
                    col_info.push_str(&format!(", format=\"{}\"", format));
                }
                if !col.sample_values.is_empty() {
                    col_info.push_str(&format!(", samples=[{}]", col.sample_values.join(", ")));
                }
                info_lines.push(col_info);
            }
            info_lines.join("\n")
        } else {
            String::new()
        };

        format!(
            r#"You are a Python code generator for CSV data manipulation in CSV Light Editor.

Your task is to generate Python code that processes CSV data according to user requests.

CSV Context:{}{}{}

IMPORTANT: Pay close attention to the column information above, especially datetime formats.
When parsing datetime values, use the EXACT format specified in the column information.
For example, if a column shows format="%Y-%m-%d %H:%M", use datetime.strptime(value, "%Y-%m-%d %H:%M") NOT "%Y-%m-%d %H:%M:%S".

NOTE: The template already imports "from datetime import datetime", so you can use datetime.strptime() directly.
Do NOT use "import datetime" or "datetime.datetime.strptime" - just use "datetime.strptime()".

Requirements:
1. Generate ONLY the Python code for the operation (the code that goes in the {{generated_code}} section)
2. Do NOT include the template structure (imports, input/output handling)
3. Do NOT use: os, subprocess, sys (except stdin/stdout), file operations, network operations
4. The code will receive CSV data as:
   - headers: List[str] - column headers
   - rows: List[List[str]] - data rows

5. For ANALYSIS operations (read-only, no data modification):
   - Examples: "show statistics", "count duplicates", "analyze data"
   - Calculate statistics, summaries, or insights
   - DO NOT modify the data
   - Return results as: summary (str), details (dict)
   - You MUST define variables: summary, details

6. For TRANSFORMATION operations (modify data):
   - Examples: "convert to integers", "remove duplicates", "change format", "add column", "add row"
   - Modify the CSV data (rows/headers)
   - Track all changes using the UNIFIED CHANGE FORMAT

   UNIFIED CHANGE FORMAT (USE THIS):
   unified_changes is a List of change objects. Each change MUST have a "type" field:

   a) Cell value change:
      {{"type": "cell", "row_index": int, "column_index": int, "old_value": str, "new_value": str}}

   b) Add column:
      {{"type": "add_column", "column_index": int, "column_name": str, "position": "before"|"after", "default_value": str}}

   c) Remove column:
      {{"type": "remove_column", "column_index": int, "column_name": str}}

   d) Rename column:
      {{"type": "rename_column", "column_index": int, "old_name": str, "new_name": str}}

   e) Add row:
      {{"type": "add_row", "row_index": int, "position": "before"|"after", "row_data": [str, ...]}}

   f) Remove row:
      {{"type": "remove_row", "row_index": int}}

   CRITICAL ORDER: When adding columns/rows, put structural changes FIRST, then cell changes:
   1. Add/remove/rename columns (if any)
   2. Add/remove rows (if any)
   3. Modify cell values (if any)

   You MUST define variables: unified_changes, preview
   - unified_changes: List of change objects (as defined above)
   - preview: List of preview objects for display (first 10 changes)

   Example for "add column and populate it":
   unified_changes = [
     {{"type": "add_column", "column_index": 2, "column_name": "New Col", "position": "after", "default_value": ""}},
     {{"type": "cell", "row_index": 0, "column_index": 3, "old_value": "", "new_value": "value1"}},
     {{"type": "cell", "row_index": 1, "column_index": 3, "old_value": "", "new_value": "value2"}}
   ]

7. Output format:
   - Analysis: {{"summary": "...", "details": {{...}}}}
   - Transformation: {{"unified_changes": [...], "preview": [...]}}

8. Use only standard library: json, csv, typing, statistics, datetime, re, etc.

9. Progress updates: Print progress as JSON: {{"type": "progress", "processed": int, "total": int, "step": str}}

CRITICAL: Determine if the user wants to:
- READ/VIEW/ANALYZE data → Generate ANALYSIS code (define summary, details)
- MODIFY/CHANGE/UPDATE data → Generate TRANSFORMATION code (define changes, preview)

Generate ONLY the Python code, no explanations, no markdown formatting."#,
            sample_rows, selected_range_info, column_info
        )
    }
}

/// Gemini API client
pub struct GeminiClient {
    #[allow(dead_code)]
    api_key: String,
    endpoint: String,
    #[allow(dead_code)]
    model: String,
}

impl GeminiClient {
    pub fn new(api_key: String, model: Option<String>) -> Self {
        let model_name = model.unwrap_or_else(|| "gemini-1.5-flash".to_string());
        Self {
            api_key: api_key.clone(),
            endpoint: format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
                model_name, api_key
            ),
            model: model_name,
        }
    }

    fn create_system_prompt() -> String {
        // Same as OpenAI
        OpenAiClient::create_system_prompt()
    }
}

#[async_trait]
impl LlmClient for GeminiClient {
    async fn detect_intent(&self, prompt: &str) -> Result<Intent> {
        #[derive(Serialize)]
        struct GeminiRequest {
            contents: Vec<GeminiContent>,
            generation_config: GeminiGenerationConfig,
        }

        #[derive(Serialize)]
        struct GeminiContent {
            parts: Vec<GeminiPart>,
        }

        #[derive(Serialize)]
        struct GeminiPart {
            text: String,
        }

        #[derive(Serialize)]
        struct GeminiGenerationConfig {
            temperature: f32,
            #[serde(rename = "responseMimeType")]
            response_mime_type: String,
        }

        #[derive(Deserialize)]
        struct GeminiResponse {
            candidates: Vec<GeminiCandidate>,
        }

        #[derive(Deserialize)]
        struct GeminiCandidate {
            content: GeminiResponseContent,
        }

        #[derive(Deserialize)]
        struct GeminiResponseContent {
            parts: Vec<GeminiResponsePart>,
        }

        #[derive(Deserialize)]
        struct GeminiResponsePart {
            text: String,
        }

        let full_prompt = format!(
            "{}\n\nUser request: {}",
            Self::create_system_prompt(),
            prompt
        );

        let request = GeminiRequest {
            contents: vec![GeminiContent {
                parts: vec![GeminiPart {
                    text: full_prompt,
                }],
            }],
            generation_config: GeminiGenerationConfig {
                temperature: 0.1,
                response_mime_type: "application/json".to_string(),
            },
        };

        let client = reqwest::Client::new();
        let response = client
            .post(&self.endpoint)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| anyhow!("Failed to call Gemini API: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow!("Gemini API error {}: {}", status, error_text));
        }

        let gemini_response: GeminiResponse = response
            .json()
            .await
            .map_err(|e| anyhow!("Failed to parse Gemini response: {}", e))?;

        let content = gemini_response
            .candidates
            .first()
            .ok_or_else(|| anyhow!("No response from Gemini"))?
            .content
            .parts
            .first()
            .ok_or_else(|| anyhow!("No content in Gemini response"))?
            .text
            .clone();

        log::debug!("Gemini response: {}", content);

        parse_llm_response(&content)
    }

    async fn generate_script(
        &self,
        prompt: &str,
        csv_context: &ExecutionContext,
    ) -> Result<String> {
        #[derive(Serialize)]
        struct GeminiRequest {
            contents: Vec<GeminiContent>,
            generation_config: GeminiGenerationConfig,
        }

        #[derive(Serialize)]
        struct GeminiContent {
            parts: Vec<GeminiPart>,
        }

        #[derive(Serialize)]
        struct GeminiPart {
            text: String,
        }

        #[derive(Serialize)]
        struct GeminiGenerationConfig {
            temperature: f32,
        }

        #[derive(Deserialize)]
        struct GeminiResponse {
            candidates: Vec<GeminiCandidate>,
        }

        #[derive(Deserialize)]
        struct GeminiCandidate {
            content: GeminiResponseContent,
        }

        #[derive(Deserialize)]
        struct GeminiResponseContent {
            parts: Vec<GeminiResponsePart>,
        }

        #[derive(Deserialize)]
        struct GeminiResponsePart {
            text: String,
        }

        // Create system prompt for script generation
        let system_prompt = OpenAiClient::create_script_generation_prompt(csv_context);
        let full_prompt = format!("{}\n\nUser request: {}", system_prompt, prompt);

        let request = GeminiRequest {
            contents: vec![GeminiContent {
                parts: vec![GeminiPart {
                    text: full_prompt,
                }],
            }],
            generation_config: GeminiGenerationConfig {
                temperature: 0.2, // Lower temperature for more deterministic code generation
            },
        };

        let client = reqwest::Client::new();
        let response = client
            .post(&self.endpoint)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| anyhow!("Failed to call Gemini API: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow!("Gemini API error {}: {}", status, error_text));
        }

        let gemini_response: GeminiResponse = response
            .json()
            .await
            .map_err(|e| anyhow!("Failed to parse Gemini response: {}", e))?;

        let content = gemini_response
            .candidates
            .first()
            .ok_or_else(|| anyhow!("No response from Gemini"))?
            .content
            .parts
            .first()
            .ok_or_else(|| anyhow!("No content in Gemini response"))?
            .text
            .clone();

        log::debug!("Gemini script generation response: {}", content);

        // Extract Python code from response
        extract_python_code(&content)
    }
}

/// Extract Python code from LLM response (may include markdown code blocks)
fn extract_python_code(response: &str) -> Result<String> {
    // Remove markdown code blocks if present
    let code = if response.contains("```python") {
        let start = response.find("```python").unwrap_or(0) + 9;
        let end = response.rfind("```").unwrap_or(response.len());
        response[start..end].trim().to_string()
    } else if response.contains("```") {
        let start = response.find("```").unwrap_or(0) + 3;
        let end = response.rfind("```").unwrap_or(response.len());
        response[start..end].trim().to_string()
    } else {
        response.trim().to_string()
    };

    if code.is_empty() {
        return Err(anyhow!("No Python code found in LLM response"));
    }

    Ok(code)
}

/// Parse LLM JSON response into Intent
fn parse_llm_response(json_str: &str) -> Result<Intent> {
    #[derive(Deserialize)]
    struct LlmIntent {
        intent_type: String,
        #[serde(default)]
        analysis_type: Option<String>,
        #[serde(default)]
        operation: Option<String>,
        #[serde(default)]
        parameters: Option<serde_json::Value>,
        target_scope: LlmTargetScope,
    }

    #[derive(Deserialize)]
    struct LlmTargetScope {
        #[serde(rename = "type")]
        scope_type: String,
        #[serde(default)]
        column_name: Option<String>,
        #[serde(default)]
        column_names: Option<Vec<String>>,
    }

    let llm_intent: LlmIntent = serde_json::from_str(json_str)
        .map_err(|e| anyhow!("Failed to parse LLM response as JSON: {}", e))?;

    let target_scope = match llm_intent.target_scope.scope_type.as_str() {
        "column" => {
            if let Some(name) = llm_intent.target_scope.column_name {
                TargetScope::Column { name }
            } else {
                TargetScope::AllData
            }
        }
        "columns" => {
            if let Some(names) = llm_intent.target_scope.column_names {
                TargetScope::Columns { names }
            } else {
                TargetScope::AllData
            }
        }
        _ => TargetScope::AllData,
    };

    let intent_type = match llm_intent.intent_type.as_str() {
        "analysis" => {
            let analysis_type = match llm_intent.analysis_type.as_deref() {
                Some("statistics") => AnalysisType::Statistics,
                Some("distribution") => AnalysisType::Distribution,
                Some("correlation") => AnalysisType::Correlation,
                Some("outliers") => AnalysisType::Outliers,
                Some("missing") => AnalysisType::Missing,
                Some("duplicates") => AnalysisType::Duplicates,
                Some("summary") => AnalysisType::Summary,
                _ => return Err(anyhow!("Unknown analysis type")),
            };
            IntentType::Analysis { analysis_type }
        }
        "transformation" => {
            let params = llm_intent.parameters.as_ref();
            let operation = match llm_intent.operation.as_deref() {
                Some("normalize") => TransformOperation::Normalize,
                Some("format_dates") => {
                    let target_format = params
                        .and_then(|p| p.get("target_format"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("YYYY-MM-DD")
                        .to_string();
                    TransformOperation::FormatDates { target_format }
                }
                Some("format_numbers") => {
                    let decimal_places = params
                        .and_then(|p| p.get("decimal_places"))
                        .and_then(|v| v.as_u64())
                        .unwrap_or(2) as usize;
                    TransformOperation::FormatNumbers { decimal_places }
                }
                Some("remove_duplicates") => TransformOperation::RemoveDuplicates,
                Some("fill_missing") => {
                    let strategy = params
                        .and_then(|p| p.get("strategy"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("mean")
                        .to_string();
                    TransformOperation::FillMissing { strategy }
                }
                Some("capitalize") => TransformOperation::Capitalize,
                Some("lowercase") => TransformOperation::Lowercase,
                Some("uppercase") => TransformOperation::Uppercase,
                Some("trim") => TransformOperation::Trim,
                Some("replace") => {
                    let from = params
                        .and_then(|p| p.get("from"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let to = params
                        .and_then(|p| p.get("to"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    TransformOperation::Replace { from, to }
                }
                _ => return Err(anyhow!("Unknown transformation operation")),
            };
            IntentType::Transformation { operation }
        }
        _ => return Err(anyhow!("Unknown intent type")),
    };

    Ok(Intent {
        intent_type,
        target_scope,
        confidence: 0.9, // LLM responses are generally high confidence
    })
}
