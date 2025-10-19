use std::env;
use serde::{Deserialize, Serialize};

/// AI configuration loaded from environment variables
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    /// Enable AI features (default: true)
    pub enabled: bool,

    /// Maximum number of rows to process in a single operation (default: 10000)
    pub max_rows_per_operation: usize,

    /// Maximum context size for analysis (default: 100000)
    pub max_context_size: usize,

    /// Confidence threshold for intent detection (default: 0.7)
    pub confidence_threshold: f32,

    /// Enable debug logging for AI operations (default: false)
    pub debug_mode: bool,

    /// Timeout for AI operations in seconds (default: 30)
    pub operation_timeout_secs: u64,

    /// API key for external AI services (optional)
    pub api_key: Option<String>,

    /// API endpoint for external AI services (optional)
    pub api_endpoint: Option<String>,

    /// Model name to use (default: "local")
    pub model_name: String,

    /// Enable advanced analytics (default: false)
    pub enable_advanced_analytics: bool,

    /// Enable data transformations (default: true)
    pub enable_transformations: bool,
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            max_rows_per_operation: 10000,
            max_context_size: 100000,
            confidence_threshold: 0.7,
            debug_mode: false,
            operation_timeout_secs: 30,
            api_key: None,
            api_endpoint: None,
            model_name: "local".to_string(),
            enable_advanced_analytics: false,
            enable_transformations: true,
        }
    }
}

impl AiConfig {
    /// Load configuration from environment variables
    pub fn from_env() -> Self {
        let mut config = Self::default();

        // AI_ENABLED
        if let Ok(val) = env::var("AI_ENABLED") {
            config.enabled = val.to_lowercase() == "true" || val == "1";
        }

        // AI_MAX_ROWS_PER_OPERATION
        if let Ok(val) = env::var("AI_MAX_ROWS_PER_OPERATION") {
            if let Ok(num) = val.parse::<usize>() {
                config.max_rows_per_operation = num;
            }
        }

        // AI_MAX_CONTEXT_SIZE
        if let Ok(val) = env::var("AI_MAX_CONTEXT_SIZE") {
            if let Ok(num) = val.parse::<usize>() {
                config.max_context_size = num;
            }
        }

        // AI_CONFIDENCE_THRESHOLD
        if let Ok(val) = env::var("AI_CONFIDENCE_THRESHOLD") {
            if let Ok(num) = val.parse::<f32>() {
                config.confidence_threshold = num;
            }
        }

        // AI_DEBUG_MODE
        if let Ok(val) = env::var("AI_DEBUG_MODE") {
            config.debug_mode = val.to_lowercase() == "true" || val == "1";
        }

        // AI_OPERATION_TIMEOUT_SECS
        if let Ok(val) = env::var("AI_OPERATION_TIMEOUT_SECS") {
            if let Ok(num) = val.parse::<u64>() {
                config.operation_timeout_secs = num;
            }
        }

        // AI_API_KEY
        if let Ok(val) = env::var("AI_API_KEY") {
            if !val.is_empty() {
                config.api_key = Some(val);
            }
        }

        // AI_API_ENDPOINT
        if let Ok(val) = env::var("AI_API_ENDPOINT") {
            if !val.is_empty() {
                config.api_endpoint = Some(val);
            }
        }

        // AI_MODEL_NAME
        if let Ok(val) = env::var("AI_MODEL_NAME") {
            if !val.is_empty() {
                config.model_name = val;
            }
        }

        // AI_ENABLE_ADVANCED_ANALYTICS
        if let Ok(val) = env::var("AI_ENABLE_ADVANCED_ANALYTICS") {
            config.enable_advanced_analytics = val.to_lowercase() == "true" || val == "1";
        }

        // AI_ENABLE_TRANSFORMATIONS
        if let Ok(val) = env::var("AI_ENABLE_TRANSFORMATIONS") {
            config.enable_transformations = val.to_lowercase() == "true" || val == "1";
        }

        config
    }

    /// Validate the configuration
    pub fn validate(&self) -> Result<(), String> {
        if self.max_rows_per_operation == 0 {
            return Err("max_rows_per_operation must be greater than 0".to_string());
        }

        if self.max_context_size == 0 {
            return Err("max_context_size must be greater than 0".to_string());
        }

        if self.confidence_threshold < 0.0 || self.confidence_threshold > 1.0 {
            return Err("confidence_threshold must be between 0.0 and 1.0".to_string());
        }

        if self.operation_timeout_secs == 0 {
            return Err("operation_timeout_secs must be greater than 0".to_string());
        }

        Ok(())
    }

    /// Check if AI features are enabled
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    /// Check if external API is configured
    pub fn has_external_api(&self) -> bool {
        self.api_key.is_some() && self.api_endpoint.is_some()
    }

    /// Get API key if configured
    pub fn get_api_key(&self) -> Option<&str> {
        self.api_key.as_deref()
    }

    /// Get API endpoint if configured
    pub fn get_api_endpoint(&self) -> Option<&str> {
        self.api_endpoint.as_deref()
    }

    /// Print configuration (for debugging, hides sensitive data)
    pub fn print_summary(&self) {
        log::info!("AI Configuration:");
        log::info!("  Enabled: {}", self.enabled);
        log::info!("  Max rows per operation: {}", self.max_rows_per_operation);
        log::info!("  Max context size: {}", self.max_context_size);
        log::info!("  Confidence threshold: {}", self.confidence_threshold);
        log::info!("  Debug mode: {}", self.debug_mode);
        log::info!("  Operation timeout: {}s", self.operation_timeout_secs);
        log::info!("  Model name: {}", self.model_name);
        log::info!("  Advanced analytics: {}", self.enable_advanced_analytics);
        log::info!("  Transformations: {}", self.enable_transformations);
        log::info!("  External API configured: {}", self.has_external_api());

        if self.api_key.is_some() {
            log::info!("  API key: [CONFIGURED]");
        }
        if self.api_endpoint.is_some() {
            log::info!("  API endpoint: {}", self.api_endpoint.as_ref().unwrap());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = AiConfig::default();
        assert!(config.enabled);
        assert_eq!(config.max_rows_per_operation, 10000);
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_config_validation() {
        let mut config = AiConfig::default();

        config.max_rows_per_operation = 0;
        assert!(config.validate().is_err());

        config.max_rows_per_operation = 1000;
        config.confidence_threshold = 1.5;
        assert!(config.validate().is_err());

        config.confidence_threshold = 0.8;
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_external_api_check() {
        let mut config = AiConfig::default();
        assert!(!config.has_external_api());

        config.api_key = Some("test-key".to_string());
        assert!(!config.has_external_api());

        config.api_endpoint = Some("https://api.example.com".to_string());
        assert!(config.has_external_api());
    }
}
