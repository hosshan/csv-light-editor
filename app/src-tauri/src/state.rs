use std::path::PathBuf;
use tokio::sync::Mutex;
use crate::metadata::MetadataManager;

#[derive(Clone)]
pub struct CsvData {
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

pub struct AppStateInner {
    pub current_file: Option<PathBuf>,
    pub metadata_manager: MetadataManager,
    pub csv_data: Option<CsvData>,
    pub has_unsaved_changes: bool,
}

// Keep the same type alias pattern for backwards compatibility
pub type AppState = Mutex<AppStateInner>;

impl AppStateInner {
    pub fn new() -> Self {
        Self {
            current_file: None,
            metadata_manager: MetadataManager::new(),
            csv_data: None,
            has_unsaved_changes: false,
        }
    }
}