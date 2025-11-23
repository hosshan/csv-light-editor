# Tauri Commands Contract: AIチャット機能

**Date**: 2025-01-27  
**Feature**: AIチャット機能（スクリプト生成・実行型）  
**Plan Reference**: [../plan.md](../plan.md)  
**Data Model Reference**: [../data-model.md](../data-model.md)

## Overview

このドキュメントは、AIチャット機能で使用するTauriコマンドのインターフェースを定義します。フロントエンド（TypeScript/React）とバックエンド（Rust）間の通信契約です。

---

## Command: `generate_script`

スクリプトを生成します。

### Request

```typescript
interface GenerateScriptRequest {
  prompt: string;              // ユーザーの自然言語指示
  csvContext: ExecutionContext; // 実行コンテキスト
}
```

### Response

```typescript
interface GenerateScriptResponse {
  script: Script;             // 生成されたスクリプト
  scriptType: 'analysis' | 'transformation';
  requiresApproval: boolean;   // 承認が必要かどうか
}
```

### Rust Signature

```rust
#[tauri::command]
pub async fn generate_script(
    prompt: String,
    csv_context: ExecutionContext,
) -> Result<GenerateScriptResponse, String>
```

### Error Cases

- `"AI features are disabled"` - AI機能が無効
- `"Failed to generate script: {reason}"` - スクリプト生成失敗
- `"Invalid CSV context"` - 無効なコンテキスト

---

## Command: `execute_script`

スクリプトを実行します。

### Request

```typescript
interface ExecuteScriptRequest {
  script: Script;              // 実行するスクリプト
  approval: boolean;           // 承認済みかどうか（変更型の場合）
  csvData: {                   // CSVデータ
    headers: string[];
    rows: string[][];
  };
}
```

### Response

```typescript
interface ExecuteScriptResponse {
  executionId: string;         // 実行ID
  result: ResultPayload;        // 実行結果
  changes?: DataChange[];       // 変更内容（変更型の場合）
}
```

### Rust Signature

```rust
#[tauri::command]
pub async fn execute_script(
    script: Script,
    approval: bool,
    csv_data: CsvDataInput,
) -> Result<ExecuteScriptResponse, String>
```

### Error Cases

- `"Script execution requires approval"` - 承認が必要
- `"Script execution failed: {reason}"` - 実行失敗
- `"Security validation failed"` - セキュリティ検証失敗

---

## Command: `get_script_progress`

スクリプト実行の進捗を取得します。

### Request

```typescript
interface GetScriptProgressRequest {
  executionId: string;         // 実行ID
}
```

### Response

```typescript
interface GetScriptProgressResponse {
  progress: ExecutionProgress;  // 進捗情報
  isCompleted: boolean;         // 完了したかどうか
}
```

### Rust Signature

```rust
#[tauri::command]
pub async fn get_script_progress(
    execution_id: String,
) -> Result<GetScriptProgressResponse, String>
```

### Error Cases

- `"Execution not found"` - 実行IDが見つからない

---

## Command: `cancel_script_execution`

スクリプト実行をキャンセルします。

### Request

```typescript
interface CancelScriptExecutionRequest {
  executionId: string;         // 実行ID
}
```

### Response

```typescript
interface CancelScriptExecutionResponse {
  success: boolean;
  message: string;
}
```

### Rust Signature

```rust
#[tauri::command]
pub async fn cancel_script_execution(
    execution_id: String,
) -> Result<CancelScriptExecutionResponse, String>
```

---

## Command: `save_chat_history`

チャット履歴をメタデータに保存します。

### Request

```typescript
interface SaveChatHistoryRequest {
  csvPath: string;             // CSVファイルのパス
  history: ChatHistory;        // チャット履歴
}
```

### Response

```typescript
interface SaveChatHistoryResponse {
  success: boolean;
  message: string;
}
```

### Rust Signature

```rust
#[tauri::command]
pub async fn save_chat_history(
    csv_path: String,
    history: ChatHistory,
) -> Result<SaveChatHistoryResponse, String>
```

### Error Cases

- `"CSV file not found"` - CSVファイルが見つからない
- `"Failed to save chat history: {reason}"` - 保存失敗

---

## Command: `load_chat_history`

チャット履歴をメタデータから読み込みます。

### Request

```typescript
interface LoadChatHistoryRequest {
  csvPath: string;             // CSVファイルのパス
}
```

### Response

```typescript
interface LoadChatHistoryResponse {
  history: ChatHistory | null; // チャット履歴（存在しない場合はnull）
}
```

### Rust Signature

```rust
#[tauri::command]
pub async fn load_chat_history(
    csv_path: String,
) -> Result<LoadChatHistoryResponse, String>
```

### Error Cases

- `"CSV file not found"` - CSVファイルが見つからない
- `"Failed to load chat history: {reason}"` - 読み込み失敗

---

## Event: `script-progress`

スクリプト実行の進捗をリアルタイムで通知します。

### Event Name

`script-progress`

### Payload

```typescript
interface ScriptProgressEvent {
  executionId: string;
  progress: ExecutionProgress;
}
```

### Usage

```typescript
import { listen } from '@tauri-apps/api/event';

listen('script-progress', (event) => {
  const progress = event.payload as ScriptProgressEvent;
  // 進捗を更新
});
```

---

## Type Definitions

### ExecutionContext

```typescript
interface ExecutionContext {
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

### Script

```typescript
interface Script {
  id: string;
  content: string;
  scriptType: 'analysis' | 'transformation';
  generatedAt: string;
  userPrompt: string;
  executionState: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  executionResult?: ExecutionResult;
}
```

### ExecutionResult

```typescript
interface ExecutionResult {
  executionId: string;
  startedAt: string;
  completedAt?: string;
  result: ResultPayload;
  error?: string;
}
```

### ResultPayload

```typescript
type ResultPayload =
  | { type: 'analysis'; summary: string; details: any }
  | { type: 'transformation'; changes: DataChange[]; preview: ChangePreview[] }
  | { type: 'error'; message: string };
```

### ExecutionProgress

```typescript
interface ExecutionProgress {
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

### ChatHistory

```typescript
interface ChatHistory {
  csvPath: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}
```

### ChatMessage

```typescript
interface ChatMessage {
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

### DataChange

```typescript
interface DataChange {
  rowIndex: number;
  columnIndex: number;
  oldValue: string;
  newValue: string;
}
```

### ChangePreview

```typescript
interface ChangePreview {
  rowIndex: number;
  columnIndex: number;
  columnName: string;
  oldValue: string;
  newValue: string;
}
```

---

## Error Handling

すべてのコマンドは `Result<T, String>` を返します。エラー時は `Err(String)` を返し、エラーメッセージを含めます。

フロントエンド側では、エラーメッセージをユーザーに表示する必要があります。

---

## Async Operations

以下のコマンドは非同期操作です：

- `generate_script` - LLM API呼び出し
- `execute_script` - Pythonスクリプト実行
- `get_script_progress` - 進捗情報の取得

これらのコマンドは `async` 関数として実装され、`await` で呼び出す必要があります。

---

*Contract defined: 2025-01-27*

