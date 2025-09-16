use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportExportSettings {
    pub default_encoding: String,
    pub default_delimiter: String,
    pub auto_detect_types: bool,
    pub trim_whitespace: bool,
    pub skip_empty_rows: bool,
    pub quote_character: String,
    pub escape_character: String,
    pub date_format: String,
    pub datetime_format: String,
    pub decimal_separator: String,
    pub thousands_separator: String,
    pub null_value_representation: String,
    pub max_preview_rows: usize,
    pub create_backup_on_save: bool,
    pub backup_directory: Option<String>,
}

impl Default for ImportExportSettings {
    fn default() -> Self {
        Self {
            default_encoding: "UTF-8".to_string(),
            default_delimiter: ",".to_string(),
            auto_detect_types: true,
            trim_whitespace: false,
            skip_empty_rows: false,
            quote_character: "\"".to_string(),
            escape_character: "\\".to_string(),
            date_format: "%Y-%m-%d".to_string(),
            datetime_format: "%Y-%m-%d %H:%M:%S".to_string(),
            decimal_separator: ".".to_string(),
            thousands_separator: ",".to_string(),
            null_value_representation: "".to_string(),
            max_preview_rows: 100,
            create_backup_on_save: false,
            backup_directory: None,
        }
    }
}

pub struct SettingsManager {
    settings_path: PathBuf,
    settings: ImportExportSettings,
}

impl SettingsManager {
    pub fn new() -> Self {
        let config_dir = dirs::config_dir()
            .expect("Could not find config directory")
            .join("csv-light-editor");

        if !config_dir.exists() {
            fs::create_dir_all(&config_dir).expect("Could not create config directory");
        }

        let settings_path = config_dir.join("settings.json");
        let settings = Self::load_settings(&settings_path);

        Self {
            settings_path,
            settings,
        }
    }

    fn load_settings(path: &Path) -> ImportExportSettings {
        if path.exists() {
            let contents = fs::read_to_string(path).unwrap_or_default();
            serde_json::from_str(&contents).unwrap_or_default()
        } else {
            ImportExportSettings::default()
        }
    }

    pub fn save_settings(&mut self) -> Result<(), String> {
        let json = serde_json::to_string_pretty(&self.settings)
            .map_err(|e| format!("Failed to serialize settings: {}", e))?;

        fs::write(&self.settings_path, json)
            .map_err(|e| format!("Failed to write settings file: {}", e))?;

        Ok(())
    }

    pub fn get_settings(&self) -> &ImportExportSettings {
        &self.settings
    }

    pub fn update_settings(&mut self, new_settings: ImportExportSettings) -> Result<(), String> {
        self.settings = new_settings;
        self.save_settings()
    }

    pub fn reset_to_defaults(&mut self) -> Result<(), String> {
        self.settings = ImportExportSettings::default();
        self.save_settings()
    }
}