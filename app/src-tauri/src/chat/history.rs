// Chat history management

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use crate::chat::message::ChatMessage;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatHistory {
    #[serde(alias = "csv_path")]
    pub csv_path: String,
    pub messages: Vec<ChatMessage>,
    #[serde(alias = "created_at")]
    pub created_at: DateTime<Utc>,
    #[serde(alias = "updated_at")]
    pub updated_at: DateTime<Utc>,
}

impl ChatHistory {
    pub fn new(csv_path: String) -> Self {
        let now = Utc::now();
        Self {
            csv_path,
            messages: Vec::new(),
            created_at: now,
            updated_at: now,
        }
    }

    pub fn add_message(&mut self, message: ChatMessage) {
        self.messages.push(message);
        self.updated_at = Utc::now();
    }

    pub fn get_latest_script(&self) -> Option<&crate::ai_script::Script> {
        self.messages
            .iter()
            .rev()
            .find_map(|msg| msg.script.as_ref())
    }
}

