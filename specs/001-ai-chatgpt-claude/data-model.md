# Data Model: AIチャット機能（スクリプト生成・実行型）

**Date**: 2025-01-27  
**Feature**: AIチャット機能（スクリプト生成・実行型）  
**Plan Reference**: [plan.md](./plan.md)  
**Research Reference**: [research.md](./research.md)

## Overview

このドキュメントは、AIチャット機能で使用するデータモデルを定義します。既存のメタデータ構造を拡張し、チャット履歴、スクリプト、実行結果を管理します。

---

## Core Entities

### 1. Script (スクリプト)

ユーザーの意図を実行可能なPythonスクリプトに変換したもの。

#### Rust Structure

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Script {
    pub id: String,                    // UUID
    pub content: String,                // Pythonスクリプトの内容
    pub script_type: ScriptType,       // analysis or transformation
    pub generated_at: DateTime<Utc>,   // 生成日時
    pub user_prompt: String,           // ユーザーの元の指示
    pub execution_state: ExecutionState, // pending, running, completed, failed
    pub execution_result: Option<ExecutionResult>, // 実行結果
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ScriptType {
    Analysis,      // 分析型: 結果を表示するのみ
    Transformation, // 変更型: CSVファイルを変更
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExecutionState {
    Pending,       // 生成済み、未実行
    Running,       // 実行中
    Completed,     // 実行完了
    Failed,        // 実行失敗
    Cancelled,     // キャンセル
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub execution_id: String,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub result: ResultPayload,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ResultPayload {
    Analysis {
        summary: String,
        details: serde_json::Value,
    },
    Transformation {
        changes: Vec<DataChange>,
        preview: Vec<ChangePreview>,
    },
    Error {
        message: String,
    },
}
```

#### TypeScript Interface

```typescript
export interface Script {
  id: string;
  content: string;
  scriptType: 'analysis' | 'transformation';
  generatedAt: string;
  userPrompt: string;
  executionState: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  executionResult?: ExecutionResult;
}

export interface ExecutionResult {
  executionId: string;
  startedAt: string;
  completedAt?: string;
  result: ResultPayload;
  error?: string;
}

export type ResultPayload =
  | { type: 'analysis'; summary: string; details: any }
  | { type: 'transformation'; changes: DataChange[]; preview: ChangePreview[] }
  | { type: 'error'; message: string };
```

---

### 2. ChatMessage (チャットメッセージ)

ユーザーとシステム間の対話記録。

#### Rust Structure

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,                    // UUID
    pub role: MessageRole,             // user or assistant
    pub content: String,               // メッセージ内容
    pub timestamp: DateTime<Utc>,       // 送信日時
    pub script: Option<Script>,        // 関連するスクリプト（assistantの場合）
    pub metadata: MessageMetadata,     // 追加メタデータ
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MessageRole {
    User,
    Assistant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageMetadata {
    pub message_type: Option<MessageType>,
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MessageType {
    Analysis,           // 分析結果の表示
    Transformation,     // 変換操作の提案
    Error,              // エラーメッセージ
    Progress,           // 進捗情報
}
```

#### TypeScript Interface

```typescript
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  script?: Script;
  metadata?: {
    messageType?: 'analysis' | 'transformation' | 'error' | 'progress';
    data?: any;
  };
}
```

---

### 3. ChatHistory (チャット履歴)

CSVファイルに関連するすべてのチャット操作の記録。

#### Rust Structure

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatHistory {
    pub csv_path: String,              // 関連するCSVファイルのパス
    pub messages: Vec<ChatMessage>,    // メッセージのリスト
    pub created_at: DateTime<Utc>,     // 履歴作成日時
    pub updated_at: DateTime<Utc>,     // 最終更新日時
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

    pub fn get_latest_script(&self) -> Option<&Script> {
        self.messages
            .iter()
            .rev()
            .find_map(|msg| msg.script.as_ref())
    }
}
```

#### TypeScript Interface

```typescript
export interface ChatHistory {
  csvPath: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}
```

---

### 4. ExecutionProgress (実行進捗)

スクリプト実行中の処理状況を示す情報。

#### Rust Structure

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionProgress {
    pub execution_id: String,         // 実行ID
    pub processed_rows: usize,         // 処理済み行数
    pub total_rows: usize,             // 総行数
    pub current_step: String,          // 現在の処理ステップ
    pub progress_percentage: f64,      // 進捗率 (0.0-100.0)
    pub estimated_remaining_seconds: Option<u64>, // 残り時間の目安（秒）
    pub started_at: DateTime<Utc>,     // 開始日時
    pub last_updated: DateTime<Utc>,   // 最終更新日時
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
```

#### TypeScript Interface

```typescript
export interface ExecutionProgress {
  executionId: string;
  processedRows: number;
  totalRows: number;
  currentStep: string;
  progressPercentage: number;
  estimatedRemainingSeconds?: number;
  startedAt: string;
  lastUpdated: string;
}
```

---

### 5. ChangePreview (変更プレビュー)

変更型スクリプト実行前に表示される変更内容の詳細。

#### Rust Structure

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangePreview {
    pub row_index: usize,              // 変更される行のインデックス
    pub column_index: usize,           // 変更される列のインデックス
    pub column_name: String,           // 列名
    pub old_value: String,             // 変更前の値
    pub new_value: String,             // 変更後の値
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataChange {
    pub row_index: usize,
    pub column_index: usize,
    pub old_value: String,
    pub new_value: String,
}
```

#### TypeScript Interface

```typescript
export interface ChangePreview {
  rowIndex: number;
  columnIndex: number;
  columnName: string;
  oldValue: string;
  newValue: string;
}

export interface DataChange {
  rowIndex: number;
  columnIndex: number;
  oldValue: string;
  newValue: string;
}
```

---

### 6. ExecutionContext (実行コンテキスト)

スクリプト実行時の環境情報。

#### Rust Structure

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionContext {
    pub csv_path: Option<String>,      // CSVファイルのパス（開いている場合）
    pub headers: Vec<String>,          // 列ヘッダー
    pub row_count: usize,               // 行数
    pub selected_range: Option<SelectionRange>, // 選択範囲
    pub filter_state: Option<FilterState>,     // フィルター状態
    pub sort_state: Option<SortState>,         // ソート状態
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectionRange {
    pub start_row: usize,
    pub end_row: usize,
    pub start_column: usize,
    pub end_column: usize,
}
```

#### TypeScript Interface

```typescript
export interface ExecutionContext {
  csvPath?: string;
  headers: string[];
  rowCount: number;
  selectedRange?: {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
  };
  filterState?: any;
  sortState?: any;
}
```

---

## Extended Metadata Structure

既存の `CsvMetadata` にチャット履歴を追加。

### Rust Structure

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CsvMetadata {
    // ... 既存フィールド
    pub filename: String,
    pub path: String,
    pub row_count: usize,
    pub column_count: usize,
    // ... その他の既存フィールド
    
    // 新規追加
    #[serde(default)]
    pub chat_history: Option<ChatHistory>,
}
```

### JSON Schema

```json
{
  "version": "1.0.0",
  "csvPath": "data.csv",
  "encoding": "UTF-8",
  "delimiter": ",",
  "columns": { ... },
  "viewState": { ... },
  "chatHistory": {
    "csvPath": "data.csv",
    "messages": [
      {
        "id": "uuid",
        "role": "user",
        "content": "売上の平均値を計算して",
        "timestamp": "2025-01-27T10:00:00Z"
      },
      {
        "id": "uuid",
        "role": "assistant",
        "content": "売上の平均値は 1,234,567 円です。",
        "timestamp": "2025-01-27T10:00:01Z",
        "script": {
          "id": "uuid",
          "content": "generated python code...",
          "scriptType": "analysis",
          "generatedAt": "2025-01-27T10:00:01Z",
          "userPrompt": "売上の平均値を計算して",
          "executionState": "completed",
          "executionResult": {
            "executionId": "uuid",
            "startedAt": "2025-01-27T10:00:01Z",
            "completedAt": "2025-01-27T10:00:02Z",
            "result": {
              "type": "analysis",
              "summary": "売上の平均値は 1,234,567 円です。",
              "details": { ... }
            }
          }
        },
        "metadata": {
          "messageType": "analysis"
        }
      }
    ],
    "createdAt": "2025-01-27T10:00:00Z",
    "updatedAt": "2025-01-27T10:00:02Z"
  }
}
```

---

## Validation Rules

### Script Validation

- `content` は空文字列であってはならない
- `script_type` は `Analysis` または `Transformation` でなければならない
- `user_prompt` は空文字列であってはならない
- `id` は有効なUUIDでなければならない

### ChatMessage Validation

- `content` は空文字列であってはならない
- `role` は `User` または `Assistant` でなければならない
- `timestamp` は未来の日時であってはならない
- `script` が存在する場合、`role` は `Assistant` でなければならない

### ExecutionProgress Validation

- `processed_rows` は `total_rows` 以下でなければならない
- `progress_percentage` は 0.0 から 100.0 の範囲でなければならない
- `execution_id` は空文字列であってはならない

---

## State Transitions

### Script Execution State

```
Pending → Running → Completed
              ↓
           Failed
              ↓
         Cancelled
```

### ChatHistory Lifecycle

```
Empty → Messages Added → Updated → Saved to Metadata
```

---

## Relationships

- `ChatHistory` contains multiple `ChatMessage`
- `ChatMessage` may have one `Script`
- `Script` has one `ExecutionResult`
- `ExecutionResult` has one `ResultPayload`
- `ResultPayload` (Transformation) contains multiple `DataChange` and `ChangePreview`
- `CsvMetadata` has one optional `ChatHistory`

---

## Data Persistence

### Storage Location

- チャット履歴は `.csvmeta` ファイルに保存される
- CSVファイルと同じディレクトリに配置される
- ファイル名: `{csv_filename}.csvmeta`

### Serialization Format

- JSON形式（既存のメタデータ形式と統一）
- UTF-8エンコーディング
- 日時は ISO 8601 形式（UTC）

### Migration Strategy

- 既存の `.csvmeta` ファイルには `chatHistory` フィールドが存在しない可能性がある
- `#[serde(default)]` により、存在しない場合は `None` として扱う
- 後方互換性を維持

---

*Data model defined: 2025-01-27*

