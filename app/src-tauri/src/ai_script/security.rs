// Script security validation module
// Validates Python scripts for dangerous operations

use anyhow::{Result, anyhow};
use regex::Regex;

pub struct SecurityValidator {
    dangerous_patterns: Vec<Regex>,
}

impl SecurityValidator {
    pub fn new() -> Self {
        // Compile dangerous patterns once
        let patterns = vec![
            // File system operations
            r"import\s+os",
            r"from\s+os\s+import",
            r"import\s+shutil",
            r"from\s+shutil\s+import",
            r"open\s*\(",
            r"file\s*\(",
            // Process execution
            r"import\s+subprocess",
            r"from\s+subprocess\s+import",
            r"os\.system\s*\(",
            r"os\.popen\s*\(",
            r"os\.exec\s*\(",
            // Dynamic code execution
            r"__import__\s*\(",
            r"eval\s*\(",
            r"exec\s*\(",
            r"compile\s*\(",
            // Network operations
            r"import\s+urllib",
            r"import\s+requests",
            r"import\s+http",
            r"import\s+socket",
            r"from\s+urllib\s+import",
            r"from\s+requests\s+import",
            r"from\s+http\s+import",
            r"from\s+socket\s+import",
            // System operations
            r"import\s+sys",
            r"sys\.exit\s*\(",
            r"sys\.modules",
            // Other dangerous operations
            r"import\s+ctypes",
            r"import\s+multiprocessing",
            r"\.__getattr__\s*\(",
            r"\.__setattr__\s*\(",
        ];

        let compiled_patterns: Result<Vec<Regex>, regex::Error> = patterns
            .iter()
            .map(|pattern| Regex::new(pattern))
            .collect();

        Self {
            dangerous_patterns: compiled_patterns.unwrap_or_else(|_| Vec::new()),
        }
    }

    pub fn validate_script(&self, script: &str) -> Result<()> {
        for pattern in &self.dangerous_patterns {
            if pattern.is_match(script) {
                return Err(anyhow!(
                    "Security validation failed: Dangerous operation detected: {}",
                    pattern.as_str()
                ));
            }
        }
        Ok(())
    }

    pub fn is_dangerous_operation(&self, script: &str) -> bool {
        self.dangerous_patterns.iter().any(|pattern| pattern.is_match(script))
    }
}

impl Default for SecurityValidator {
    fn default() -> Self {
        Self::new()
    }
}

