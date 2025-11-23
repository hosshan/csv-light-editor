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

        Ok(Script::new(full_script, script_type.clone(), prompt.to_string()))
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

        format!(
            r#"# CSV Light Editor - Generated Script
# User Request: {}
# Generated: {}
# Script Type: {}

import sys
import json
import csv
from typing import List, Dict, Any

# Input: CSV data from stdin (JSON format)
try:
    input_data = json.load(sys.stdin)
    headers = input_data['headers']
    rows = input_data['rows']
except Exception as e:
    print(json.dumps({{
        'type': 'error',
        'message': f'Failed to parse input: {{e}}'
    }}))
    sys.exit(1)

script_type = '{}'

# User's requested operation:
{}

# Output: Results to stdout (JSON format)
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
    
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({{
        'type': 'error',
        'message': f'Execution error: {{e}}'
    }}))
    sys.exit(1)
"#,
            user_prompt, timestamp, script_type_str, script_type_str, code
        )
    }
}

