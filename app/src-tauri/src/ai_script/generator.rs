// Script generation module
// Generates Python scripts from user prompts using LLM

use crate::ai_script::{Script, ScriptType, ExecutionContext};
use crate::ai::{LlmClient, AiConfig};
use anyhow::{Result, anyhow};
use chrono::Utc;

pub struct ScriptGenerator {
    llm_client: Option<Box<dyn LlmClient>>,
}

impl ScriptGenerator {
    pub fn new() -> Self {
        let config = AiConfig::from_env();
        let llm_client = Self::create_llm_client(&config);
        Self { llm_client }
    }

    fn create_llm_client(config: &AiConfig) -> Option<Box<dyn LlmClient>> {
        if let Some(api_key) = config.get_api_key() {
            let model_name = Some(config.model_name.clone());

            if config.model_name.starts_with("gpt") {
                Some(Box::new(crate::ai::llm_client::OpenAiClient::new(
                    api_key.to_string(),
                    model_name,
                )) as Box<dyn LlmClient>)
            } else if config.model_name.starts_with("gemini") {
                Some(Box::new(crate::ai::llm_client::GeminiClient::new(
                    api_key.to_string(),
                    model_name,
                )) as Box<dyn LlmClient>)
            } else {
                None
            }
        } else {
            None
        }
    }

    pub async fn generate_script(
        &self,
        prompt: &str,
        context: &ExecutionContext,
    ) -> Result<Script> {
        // Detect script type first
        let script_type = Self::detect_script_type(prompt);

        // Generate Python code using LLM
        let generated_code = if let Some(llm_client) = &self.llm_client {
            llm_client.generate_script(prompt, context).await?
        } else {
            return Err(anyhow!("AI features are disabled. Please configure API key."));
        };

        // Wrap generated code in template
        let full_script = Self::wrap_in_template(&generated_code, prompt, &script_type);

        // Log generated script for debugging
        log::info!("[GENERATOR] Generated script length: {} chars", full_script.len());
        log::info!("[GENERATOR] Generated script (first 1000 chars):\n{}", 
            full_script.chars().take(1000).collect::<String>());
        if full_script.len() > 1000 {
            log::info!("[GENERATOR] ... (truncated, total {} chars)", full_script.len());
        }

        Ok(Script::new(full_script, script_type.clone(), prompt.to_string()))
    }

    /// Fix a script that failed execution by regenerating with error context
    pub async fn fix_script(
        &self,
        original_prompt: &str,
        original_script: &Script,
        error_message: &str,
        context: &ExecutionContext,
    ) -> Result<Script> {
        log::info!("[GENERATOR] Attempting to fix script with error: {}", error_message);

        // Create a fix prompt that includes the error (for LLM only, not for script header)
        let fix_prompt = format!(
            "{}\n\nIMPORTANT: The previous script failed with this error:\n{}\n\nPlease generate a corrected version that fixes this issue. Pay special attention to:\n- Date/time format matching (the actual data format may differ from what was assumed)\n- Column names and indices\n- Data types and conversions\n- Indentation and syntax",
            original_prompt,
            error_message
        );

        // Detect script type (should be the same as original)
        let script_type = &original_script.script_type;

        // Generate fixed Python code using LLM (use fix_prompt with error context)
        let generated_code = if let Some(llm_client) = &self.llm_client {
            llm_client.generate_script(&fix_prompt, context).await?
        } else {
            return Err(anyhow!("AI features are disabled. Please configure API key."));
        };

        // Wrap generated code in template (use original_prompt for clean header, not fix_prompt)
        let full_script = Self::wrap_in_template(&generated_code, original_prompt, script_type);

        log::info!("[GENERATOR] Fixed script generated, length: {} chars", full_script.len());

        Ok(Script::new(full_script, script_type.clone(), original_prompt.to_string()))
    }

    pub fn detect_script_type(prompt: &str) -> ScriptType {
        let prompt_lower = prompt.to_lowercase();
        
        // Keywords that indicate transformation (file modification)
        let transformation_keywords = [
            "変更", "変換", "修正", "更新", "置換", "追加", "削除",
            "change", "transform", "modify", "update", "replace", "add", "remove", "delete",
            "convert", "format", "edit", "fix", "correct",
        ];

        // Keywords that indicate analysis (read-only)
        let analysis_keywords = [
            "分析", "計算", "集計", "統計", "確認", "表示", "検索",
            "analyze", "calculate", "compute", "statistics", "summary", "show", "display",
            "find", "search", "count", "average", "mean", "median", "sum",
        ];

        // Check for transformation keywords
        if transformation_keywords.iter().any(|keyword| prompt_lower.contains(keyword)) {
            return ScriptType::Transformation;
        }

        // Check for analysis keywords
        if analysis_keywords.iter().any(|keyword| prompt_lower.contains(keyword)) {
            return ScriptType::Analysis;
        }

        // Default to analysis if unclear (safer - read-only)
        ScriptType::Analysis
    }

    fn wrap_in_template(code: &str, user_prompt: &str, script_type: &ScriptType) -> String {
        let script_type_str = match script_type {
            ScriptType::Analysis => "analysis",
            ScriptType::Transformation => "transformation",
        };

        let timestamp = Utc::now().to_rfc3339();

        // Normalize indentation of generated code
        // Remove common leading indentation and ensure proper indentation for template insertion
        let normalized_code = Self::normalize_code_indentation(code);

        format!(
            r#"# CSV Light Editor - Generated Script
# User Request: {}
# Generated: {}
# Script Type: {}

import sys
import json
import csv
from datetime import datetime
from typing import List, Dict, Any

def _read_json_input() -> Dict[str, Any]:
    raw = sys.stdin.readline()
    if not raw.strip():
        return {{}}
    return json.loads(raw)

def _safe_print(payload: Dict[str, Any]) -> None:
    try:
        print(json.dumps(payload))
    except Exception:
        print('{{"type": "error", "message": "Failed to serialize script result."}}')

def main():
    try:
        input_data = _read_json_input()
        headers = input_data.get('headers', [])
        rows = input_data.get('rows', [])
    except Exception as e:
        _safe_print({{
            'type': 'error',
            'message': f'Failed to parse input: {{e}}'
        }})
        return

    script_type = '{}'

    # User's requested operation:
{}
    try:
        if script_type == 'analysis':
            result = {{
                'type': 'analysis',
                'summary': summary,
                'details': details
            }}
        else:
            result = {{
                'type': 'transformation',
                'changes': changes,
                'preview': preview
            }}
        _safe_print(result)
    except Exception as e:
        _safe_print({{
            'type': 'error',
            'message': f'Execution error: {{e}}'
        }})

if __name__ == "__main__":
    main()
"#,
            user_prompt, timestamp, script_type_str, script_type_str, normalized_code
        )
    }

    /// Normalize indentation of generated code for template insertion
    /// Removes common leading indentation and adds proper indentation for the template context
    fn normalize_code_indentation(code: &str) -> String {
        let lines: Vec<&str> = code.lines().collect();
        
        // Find the minimum indentation (excluding empty lines)
        let min_indent = lines
            .iter()
            .filter(|line| !line.trim().is_empty())
            .map(|line| {
                line.chars()
                    .take_while(|c| c.is_whitespace())
                    .count()
            })
            .min()
            .unwrap_or(0);

        // Remove common indentation and add 4 spaces for template context
        let normalized_lines: Vec<String> = lines
            .iter()
            .map(|line| {
                if line.trim().is_empty() {
                    String::new()
                } else {
                    // Remove common indentation
                    let indent_removed = if line.chars().take(min_indent).all(|c| c.is_whitespace()) {
                        &line[min_indent..]
                    } else {
                        line
                    };
                    // Add 4 spaces for template context (inside main() function)
                    format!("    {}", indent_removed)
                }
            })
            .collect();

        normalized_lines.join("\n")
    }
}

