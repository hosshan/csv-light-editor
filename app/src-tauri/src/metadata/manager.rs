use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::collections::HashMap;
use anyhow::Result;
use chrono;
use crate::commands::csv::SortState;
use crate::chat::ChatHistory;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewState {
    #[serde(default)]
    pub column_widths: HashMap<usize, f64>,
    #[serde(default)]
    pub viewport_range: Option<ViewportRange>,
    #[serde(default)]
    pub default_column_width: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewportRange {
    pub start_row: usize,
    pub end_row: usize,
    pub start_column: usize,
    pub end_column: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CsvMetadata {
    pub filename: String,
    pub path: String,
    pub row_count: usize,
    pub column_count: usize,
    pub has_headers: bool,
    pub delimiter: String,
    pub encoding: String,
    pub file_size: u64,
    pub last_modified: String,
    #[serde(default)]
    pub sort_state: Option<SortState>,
    #[serde(default)]
    pub view_state: Option<ViewState>,
    #[serde(default)]
    pub chat_history: Option<ChatHistory>,
}

impl CsvMetadata {
    pub fn new(path: &Path) -> Result<Self> {
        let metadata = fs::metadata(path)?;
        let filename = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown.csv")
            .to_string();

        let last_modified = metadata
            .modified()
            .map(|t| format!("{:?}", t))
            .unwrap_or_else(|_| "Unknown".to_string());

        Ok(Self {
            filename,
            path: path.to_string_lossy().to_string(),
            row_count: 0,
            column_count: 0,
            has_headers: true,
            delimiter: ",".to_string(),
            encoding: "UTF-8".to_string(),
            file_size: metadata.len(),
            last_modified,
            sort_state: None,
            view_state: None,
            chat_history: None,
        })
    }

    pub fn update_counts(&mut self, row_count: usize, column_count: usize) {
        self.row_count = row_count;
        self.column_count = column_count;
    }

    pub fn from_pasted_data() -> Self {
        Self {
            filename: "Pasted Data".to_string(),
            path: "".to_string(),
            row_count: 0,
            column_count: 0,
            has_headers: true,
            delimiter: ",".to_string(),
            encoding: "UTF-8".to_string(),
            file_size: 0,
            last_modified: chrono::Local::now().to_rfc3339(),
            sort_state: None,
            view_state: None,
            chat_history: None,
        }
    }
}

pub struct MetadataManager {
    metadata_cache: Option<CsvMetadata>,
}

impl MetadataManager {
    pub fn new() -> Self {
        Self {
            metadata_cache: None,
        }
    }

    pub fn load_metadata(&mut self, csv_path: &Path) -> Result<CsvMetadata> {
        let meta_path = Self::get_metadata_path(csv_path);

        if meta_path.exists() {
            let content = fs::read_to_string(&meta_path)?;
            let mut metadata: CsvMetadata = serde_json::from_str(&content)?;
            
            // Migration: Ensure chat_history field exists (backward compatibility)
            // #[serde(default)] handles this automatically, but we can add explicit migration here if needed
            if metadata.chat_history.is_none() {
                // Field is already None by default, no action needed
                // This ensures backward compatibility with existing .csvmeta files
            }
            
            self.metadata_cache = Some(metadata.clone());
            Ok(metadata)
        } else {
            let metadata = CsvMetadata::new(csv_path)?;
            self.metadata_cache = Some(metadata.clone());
            Ok(metadata)
        }
    }

    pub fn save_metadata(&self, csv_path: &Path, metadata: &CsvMetadata) -> Result<()> {
        let meta_path = Self::get_metadata_path(csv_path);
        let content = serde_json::to_string_pretty(metadata)?;
        fs::write(meta_path, content)?;
        Ok(())
    }

    fn get_metadata_path(csv_path: &Path) -> std::path::PathBuf {
        let mut meta_path = csv_path.to_path_buf();
        let extension = format!("{}.csvmeta", csv_path.extension().unwrap_or_default().to_string_lossy());
        meta_path.set_extension(extension);
        meta_path
    }

    pub fn get_cached(&self) -> Option<&CsvMetadata> {
        self.metadata_cache.as_ref()
    }

    /// Save chat history to metadata
    pub fn save_chat_history(&mut self, csv_path: &Path, history: ChatHistory) -> Result<()> {
        // Load existing metadata or create new
        let mut metadata = self.load_metadata(csv_path)?;
        
        // Update chat history
        metadata.chat_history = Some(history);
        
        // Save updated metadata
        self.save_metadata(csv_path, &metadata)?;
        
        // Update cache
        self.metadata_cache = Some(metadata);
        
        Ok(())
    }

    /// Load chat history from metadata
    pub fn load_chat_history(&mut self, csv_path: &Path) -> Result<Option<ChatHistory>> {
        let metadata = self.load_metadata(csv_path)?;
        Ok(metadata.chat_history)
    }

    /// Add a message to chat history
    pub fn add_chat_message(&mut self, csv_path: &Path, message: crate::chat::message::ChatMessage) -> Result<()> {
        let mut metadata = self.load_metadata(csv_path)?;
        
        // Get or create chat history
        let mut history = metadata.chat_history
            .unwrap_or_else(|| ChatHistory::new(csv_path.to_string_lossy().to_string()));
        
        // Add message
        history.add_message(message);
        
        // Update metadata
        metadata.chat_history = Some(history);
        
        // Save updated metadata
        self.save_metadata(csv_path, &metadata)?;
        
        // Update cache
        self.metadata_cache = Some(metadata);
        
        Ok(())
    }
}