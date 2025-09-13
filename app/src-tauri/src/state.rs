use std::path::PathBuf;
use tokio::sync::Mutex;
use crate::metadata::MetadataManager;

pub struct AppStateInner {
    pub current_file: Option<PathBuf>,
    pub metadata_manager: MetadataManager,
}

pub type AppState = Mutex<AppStateInner>;

impl AppStateInner {
    pub fn new() -> Self {
        Self {
            current_file: None,
            metadata_manager: MetadataManager::new(),
        }
    }
}