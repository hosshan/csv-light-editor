use crate::settings::{ImportExportSettings, SettingsManager};
use crate::utils::AppError;
use tauri::State;
use tokio::sync::Mutex;

pub struct SettingsState(pub Mutex<SettingsManager>);

#[tauri::command]
pub async fn get_import_export_settings(
    state: State<'_, SettingsState>,
) -> Result<ImportExportSettings, AppError> {
    let settings = state.0.lock().await;
    Ok(settings.get_settings().clone())
}

#[tauri::command]
pub async fn update_import_export_settings(
    settings: ImportExportSettings,
    state: State<'_, SettingsState>,
) -> Result<(), AppError> {
    let mut manager = state.0.lock().await;
    manager.update_settings(settings)
        .map_err(|e| AppError::new(e, "SETTINGS_UPDATE_ERROR"))
}

#[tauri::command]
pub async fn reset_import_export_settings(
    state: State<'_, SettingsState>,
) -> Result<ImportExportSettings, AppError> {
    let mut manager = state.0.lock().await;
    manager.reset_to_defaults()
        .map_err(|e| AppError::new(e, "SETTINGS_RESET_ERROR"))?;
    Ok(manager.get_settings().clone())
}