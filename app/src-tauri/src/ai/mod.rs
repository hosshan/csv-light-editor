use serde::{Deserialize, Serialize};
use anyhow::{Result, anyhow};
use std::collections::HashMap;

mod intent;
mod analyzer;
mod transformer;
mod config;

pub use intent::{Intent, IntentType, TargetScope, AnalysisType, TransformOperation};
pub use analyzer::DataAnalyzer;
pub use transformer::DataTransformer;
pub use config::AiConfig;

/// AI Assistant that processes user prompts in two stages:
/// 1. Intent Detection: Understand what the user wants to do
/// 2. Execution: Perform the analysis or transformation
#[derive(Debug)]
pub struct AiAssistant {
    analyzer: DataAnalyzer,
    transformer: DataTransformer,
    config: AiConfig,
}

impl AiAssistant {
    pub fn new() -> Self {
        Self::with_config(AiConfig::from_env())
    }

    pub fn with_config(config: AiConfig) -> Self {
        Self {
            analyzer: DataAnalyzer::new(),
            transformer: DataTransformer::new(),
            config,
        }
    }

    pub fn config(&self) -> &AiConfig {
        &self.config
    }

    pub fn is_enabled(&self) -> bool {
        self.config.is_enabled()
    }

    /// Stage 1: Detect intent from user prompt
    /// This determines what the user wants to do without loading all CSV data
    pub fn detect_intent(&self, prompt: &str) -> Result<Intent> {
        if !self.is_enabled() {
            return Err(anyhow!("AI features are disabled"));
        }
        intent::detect_intent(prompt)
    }

    /// Stage 2: Execute the detected intent with relevant CSV data
    pub fn execute_intent(
        &self,
        intent: &Intent,
        headers: &[String],
        rows: &[Vec<String>],
    ) -> Result<AiResponse> {
        if !self.is_enabled() {
            return Err(anyhow!("AI features are disabled"));
        }

        // Limit rows based on configuration
        let row_limit = self.config.max_rows_per_operation.min(rows.len());
        let limited_rows = &rows[..row_limit];

        if self.config.debug_mode {
            log::debug!("Processing {} rows (limit: {})", limited_rows.len(), self.config.max_rows_per_operation);
        }

        match &intent.intent_type {
            IntentType::Analysis { analysis_type } => {
                if !self.config.enable_advanced_analytics {
                    // Basic analytics only
                    match analysis_type {
                        AnalysisType::Statistics | AnalysisType::Summary | AnalysisType::Missing => {
                            // Allowed
                        }
                        _ => {
                            return Err(anyhow!("Advanced analytics are disabled. Enable AI_ENABLE_ADVANCED_ANALYTICS in configuration."));
                        }
                    }
                }

                let result = self.analyzer.analyze(analysis_type, headers, limited_rows, &intent.target_scope)?;
                Ok(AiResponse::Analysis {
                    summary: result.summary,
                    details: result.details,
                    visualizations: result.visualizations,
                })
            }
            IntentType::Transformation { operation } => {
                if !self.config.enable_transformations {
                    return Err(anyhow!("Data transformations are disabled. Enable AI_ENABLE_TRANSFORMATIONS in configuration."));
                }

                let changes = self.transformer.transform(operation, headers, limited_rows, &intent.target_scope)?;
                let preview = self.generate_preview(&changes);
                Ok(AiResponse::Transformation {
                    changes,
                    preview,
                })
            }
        }
    }

    fn generate_preview(&self, changes: &[DataChange]) -> Vec<ChangePreview> {
        changes.iter().take(10).map(|change| {
            ChangePreview {
                row_index: change.row_index,
                column_index: change.column_index,
                old_value: change.old_value.clone(),
                new_value: change.new_value.clone(),
            }
        }).collect()
    }
}

/// AI response types
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AiResponse {
    Analysis {
        summary: String,
        details: HashMap<String, serde_json::Value>,
        visualizations: Vec<Visualization>,
    },
    Transformation {
        changes: Vec<DataChange>,
        preview: Vec<ChangePreview>,
    },
}

/// Data change representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataChange {
    pub row_index: usize,
    pub column_index: usize,
    pub old_value: String,
    pub new_value: String,
}

/// Preview of changes for user confirmation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangePreview {
    pub row_index: usize,
    pub column_index: usize,
    pub old_value: String,
    pub new_value: String,
}

/// Visualization data for analysis results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Visualization {
    pub viz_type: String,
    pub title: String,
    pub data: serde_json::Value,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ai_assistant_creation() {
        let assistant = AiAssistant::new();
        assert!(true); // Basic instantiation test
    }

    #[test]
    fn test_detect_analysis_intent() {
        let assistant = AiAssistant::new();
        let result = assistant.detect_intent("Show me statistics for the price column");
        assert!(result.is_ok());
        let intent = result.unwrap();
        assert!(matches!(intent.intent_type, IntentType::Analysis { .. }));
    }

    #[test]
    fn test_detect_transformation_intent() {
        let assistant = AiAssistant::new();
        let result = assistant.detect_intent("Convert all dates to YYYY-MM-DD format");
        assert!(result.is_ok());
        let intent = result.unwrap();
        assert!(matches!(intent.intent_type, IntentType::Transformation { .. }));
    }
}
