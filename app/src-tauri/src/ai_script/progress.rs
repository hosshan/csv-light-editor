// Execution progress tracking

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionProgress {
    pub execution_id: String,
    pub processed_rows: usize,
    pub total_rows: usize,
    pub current_step: String,
    pub progress_percentage: f64,
    pub estimated_remaining_seconds: Option<u64>,
    pub started_at: DateTime<Utc>,
    pub last_updated: DateTime<Utc>,
}

impl ExecutionProgress {
    pub fn new(execution_id: String, total_rows: usize) -> Self {
        let now = Utc::now();
        Self {
            execution_id,
            processed_rows: 0,
            total_rows,
            current_step: "Initializing".to_string(),
            progress_percentage: 0.0,
            estimated_remaining_seconds: None,
            started_at: now,
            last_updated: now,
        }
    }

    pub fn update(&mut self, processed: usize, step: String) {
        self.processed_rows = processed;
        self.current_step = step;
        self.progress_percentage = if self.total_rows > 0 {
            (processed as f64 / self.total_rows as f64) * 100.0
        } else {
            0.0
        };
        self.last_updated = Utc::now();
    }
}

