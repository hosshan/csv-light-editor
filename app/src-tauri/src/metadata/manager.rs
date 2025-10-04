use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use anyhow::Result;
use crate::commands::csv::{SortState, SortColumn};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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
        })
    }

    pub fn update_counts(&mut self, row_count: usize, column_count: usize) {
        self.row_count = row_count;
        self.column_count = column_count;
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
            let metadata: CsvMetadata = serde_json::from_str(&content)?;
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
}