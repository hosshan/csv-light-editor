use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use async_trait::async_trait;

use super::{Intent, IntentType, TargetScope, AnalysisType, TransformOperation};

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
