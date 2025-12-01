# Technical Research: AIチャット機能（スクリプト生成・実行型）

**Date**: 2025-01-27  
**Feature**: AIチャット機能（スクリプト生成・実行型）  
**Plan Reference**: [plan.md](./plan.md)

## Overview

このドキュメントは、AIチャット機能の実装に必要な技術選択についての調査結果をまとめています。各技術選択について、決定事項、根拠、検討した代替案を記録します。

---

## 1. RustからPythonスクリプトを実行する方法

### Decision: `std::process::Command` (subprocess) を使用

### Rationale

1. **シンプルさ**: 追加の依存関係が不要で、標準ライブラリのみで実装可能
2. **柔軟性**: Pythonバージョンの違いや環境の違いに対応しやすい
3. **分離性**: Pythonプロセスが独立して実行されるため、クラッシュしてもRustプロセスに影響しない
4. **進捗表示**: 標準出力をストリーミングで読み取れる
5. **セキュリティ**: プロセス分離により、サンドボックス化が容易

### Alternatives Considered

#### Option A: `pyo3` クレート
- **メリット**: 
  - RustとPython間の直接的な統合
  - 型安全性が高い
  - パフォーマンスが良い（プロセス起動オーバーヘッドなし）
- **デメリット**:
  - ビルド時のPython依存（開発環境と本番環境で異なる可能性）
  - コンパイル時間の増加
  - Pythonバージョンの固定が必要
  - セキュリティサンドボックスの実装が複雑
- **結論**: 開発・配布の複雑さを考慮し、採用しない

#### Option B: `std::process::Command` (subprocess)
- **メリット**: 
  - 標準ライブラリのみで実装可能
  - 環境に依存しない（システムのPythonを使用）
  - プロセス分離による安全性
  - 進捗表示の実装が容易
- **デメリット**:
  - プロセス起動のオーバーヘッド（許容範囲内）
  - 型安全性が低い（JSONでデータ交換）
- **結論**: 採用

### Implementation Approach

```rust
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};

// Pythonスクリプトを実行し、進捗をストリーミング
let mut child = Command::new("python3")
    .arg("-u")  // バッファリング無効化
    .arg(&script_path)
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()?;

// 標準出力をストリーミングで読み取り
let stdout = child.stdout.take().unwrap();
let reader = BufReader::new(stdout);
for line in reader.lines() {
    // 進捗情報をパースしてUIに送信
}
```

---

## 2. LLM統合によるスクリプト生成

### Decision: 既存のLLMクライアントを拡張してスクリプト生成機能を追加

### Rationale

1. **既存実装の活用**: `app/src-tauri/src/ai/llm_client.rs` に既にOpenAI/Geminiクライアントが実装されている
2. **一貫性**: 既存のAI機能（意図検出）と同じLLMを使用
3. **設定の統一**: 既存の `AiConfig` を再利用

### Implementation Approach

既存の `LlmClient` トレイトを拡張：

```rust
#[async_trait]
pub trait LlmClient: Send + Sync {
    async fn detect_intent(&self, prompt: &str) -> Result<Intent>;
    // 新規追加
    async fn generate_script(
        &self,
        prompt: &str,
        csv_context: &CsvContext,
    ) -> Result<Script>;
}
```

### Script Generation Template

Pythonスクリプトのテンプレート構造：

```python
# Clea - Generated Script
# User Request: {user_prompt}
# Generated: {timestamp}

import sys
import json
import csv
from typing import List, Dict, Any

# Input: CSV data from stdin (JSON format)
input_data = json.load(sys.stdin)
headers = input_data['headers']
rows = input_data['rows']

# Script Type: {script_type}  # analysis or transformation

# User's requested operation:
{generated_code}

# Output: Results to stdout (JSON format)
if script_type == 'analysis':
    result = {
        'type': 'analysis',
        'summary': summary,
        'details': details
    }
else:
    result = {
        'type': 'transformation',
        'changes': changes,  # List of {row, col, old_value, new_value}
        'preview': preview
    }

print(json.dumps(result))
```

### Alternatives Considered

#### Option A: ローカルモデル（Candle等）
- **メリット**: プライバシー、オフライン動作
- **デメリット**: モデルサイズ、推論速度、実装複雑さ
- **結論**: 将来的な拡張として検討、初期実装ではAPIを使用

#### Option B: ルールベース生成
- **メリット**: 高速、予測可能
- **デメリット**: 柔軟性が低い、対応範囲が限定的
- **結論**: LLM生成のフォールバックとして使用

---

## 3. セキュリティサンドボックス

### Decision: プロセスレベルの制限 + スクリプト解析による検証

### Rationale

1. **多層防御**: プロセス制限とスクリプト解析の両方で安全性を確保
2. **実装の簡潔さ**: 複雑なサンドボックスライブラリは不要
3. **パフォーマンス**: オーバーヘッドが少ない

### Implementation Approach

#### レイヤー1: スクリプト解析による検証

```rust
// 危険な操作を検出
fn validate_script_security(script: &str) -> Result<(), SecurityError> {
    let dangerous_patterns = [
        r"import\s+os",
        r"import\s+subprocess",
        r"import\s+sys",
        r"open\s*\(",
        r"__import__",
        r"eval\s*\(",
        r"exec\s*\(",
    ];
    
    for pattern in dangerous_patterns {
        if regex::Regex::new(pattern)?.is_match(script) {
            return Err(SecurityError::DangerousOperation);
        }
    }
    Ok(())
}
```

#### レイヤー2: プロセス実行環境の制限

```rust
// 実行環境を制限
let mut cmd = Command::new("python3");
cmd.arg("-u")
   .arg(&script_path)
   .env("PYTHONPATH", "")  // 外部モジュールの読み込みを制限
   .env("PYTHONDONTWRITEBYTECODE", "1")
   .stdin(Stdio::piped())
   .stdout(Stdio::piped())
   .stderr(Stdio::piped());
```

#### レイヤー3: リソース制限（将来の拡張）

- CPU時間制限
- メモリ使用量制限
- 実行時間制限

### Alternatives Considered

#### Option A: Dockerコンテナ
- **メリット**: 完全な分離
- **デメリット**: Docker依存、オーバーヘッド、配布の複雑さ
- **結論**: 過剰な実装、採用しない

#### Option B: `rlimit` によるリソース制限
- **メリット**: 軽量
- **デメリット**: プラットフォーム依存（macOSでは制限あり）
- **結論**: 将来の拡張として検討

---

## 4. 進捗表示の実装

### Decision: 標準出力のストリーミング + Tauriイベントによるリアルタイム更新

### Rationale

1. **リアルタイム性**: 標準出力をストリーミングで読み取り、即座にUIに反映
2. **既存技術の活用**: Tauriのイベントシステムを使用
3. **シンプルさ**: 追加のライブラリ不要

### Implementation Approach

#### Rust側: 進捗情報のストリーミング

```rust
use tauri::Window;

async fn execute_script_with_progress(
    script_path: &Path,
    window: &Window,
    execution_id: &str,
) -> Result<()> {
    let mut child = Command::new("python3")
        .arg("-u")
        .arg(script_path)
        .stdout(Stdio::piped())
        .spawn()?;

    let stdout = child.stdout.take().unwrap();
    let reader = BufReader::new(stdout);
    
    let mut processed_rows = 0;
    for line in reader.lines() {
        let line = line?;
        
        // 進捗情報をパース（例: "PROGRESS: 100/1000 rows")
        if let Some(progress) = parse_progress(&line) {
            processed_rows = progress.current;
            
            // Tauriイベントでフロントエンドに送信
            window.emit("script-progress", json!({
                "execution_id": execution_id,
                "processed_rows": progress.current,
                "total_rows": progress.total,
                "step": progress.step,
            }))?;
        }
    }
    
    Ok(())
}
```

#### TypeScript側: イベントリスナー

```typescript
import { listen } from '@tauri-apps/api/event';

listen('script-progress', (event) => {
  const progress = event.payload as ProgressInfo;
  updateProgressBar(progress);
});
```

### Progress Format

Pythonスクリプトからの進捗出力形式：

```python
# 進捗情報を標準出力に出力（JSON形式）
print(json.dumps({
    'type': 'progress',
    'processed': 100,
    'total': 1000,
    'step': 'Processing rows'
}))
```

### Alternatives Considered

#### Option A: ファイルベースの進捗共有
- **メリット**: シンプル
- **デメリット**: ポーリングが必要、リアルタイム性が低い
- **結論**: 採用しない

#### Option B: WebSocket
- **メリット**: リアルタイム性が高い
- **デメリット**: 追加の実装複雑さ
- **結論**: Tauriイベントで十分、採用しない

---

## 5. スクリプト生成のテンプレート設計

### Decision: コンテキスト付きプロンプト + 構造化されたテンプレート

### Rationale

1. **一貫性**: 生成されるスクリプトの構造が統一される
2. **検証容易性**: 構造化により、セキュリティ検証が容易
3. **デバッグ容易性**: エラー時の原因特定が容易

### Template Structure

```python
# Clea - Generated Script
# ====================================
# User Request: {user_prompt}
# Generated: {timestamp}
# Script Type: {script_type}
# ====================================

import sys
import json
import csv
from typing import List, Dict, Any

# Input: CSV data from stdin (JSON format)
try:
    input_data = json.load(sys.stdin)
    headers = input_data['headers']
    rows = input_data['rows']
except Exception as e:
    print(json.dumps({
        'type': 'error',
        'message': f'Failed to parse input: {e}'
    }))
    sys.exit(1)

# ====================================
# Generated Code
# ====================================
{generated_code}

# ====================================
# Output: Results to stdout (JSON format)
# ====================================
try:
    if script_type == 'analysis':
        result = {
            'type': 'analysis',
            'summary': summary,
            'details': details
        }
    else:
        result = {
            'type': 'transformation',
            'changes': changes,
            'preview': preview
        }
    
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({
        'type': 'error',
        'message': f'Execution error: {e}'
    }))
    sys.exit(1)
```

### LLM Prompt Template

```
You are a Python script generator for CSV data manipulation.

User Request: {user_prompt}

CSV Context:
- Headers: {headers}
- Row Count: {row_count}
- Sample Data: {sample_rows}

Requirements:
1. Generate Python code that processes CSV data
2. Script type: {script_type} (analysis or transformation)
3. For analysis: Return summary and details as JSON
4. For transformation: Return list of changes with preview
5. Do NOT use: os, subprocess, sys (except stdin/stdout), file operations
6. Output must be valid JSON to stdout

Generate only the Python code for the {generated_code} section:
```

### Alternatives Considered

#### Option A: 完全に自由なスクリプト生成
- **メリット**: 柔軟性が高い
- **デメリット**: セキュリティ検証が困難、構造が不統一
- **結論**: テンプレートベースの方が安全で保守しやすい

---

## 6. チャット履歴のメタデータ統合

### Decision: 既存の `.csvmeta` ファイルに `chatHistory` フィールドを追加

### Rationale

1. **既存システムの活用**: メタデータ管理システムを再利用
2. **一貫性**: CSVファイルとチャット履歴が同じ場所に保存される
3. **シンプルさ**: 追加のストレージシステム不要

### Data Structure

```json
{
  "version": "1.0.0",
  "csvPath": "data.csv",
  "encoding": "UTF-8",
  "delimiter": ",",
  "columns": { ... },
  "viewState": { ... },
  "chatHistory": [
    {
      "id": "uuid",
      "timestamp": "2025-01-27T10:00:00Z",
      "userMessage": "売上の平均値を計算して",
      "script": {
        "content": "generated python code",
        "type": "analysis",
        "generatedAt": "2025-01-27T10:00:01Z"
      },
      "execution": {
        "status": "completed",
        "result": { ... },
        "executedAt": "2025-01-27T10:00:02Z"
      },
      "approval": {
        "required": false,
        "status": "auto-approved",
        "approvedAt": null
      }
    }
  ]
}
```

### Implementation Approach

既存の `CsvMetadata` 構造体を拡張：

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CsvMetadata {
    // ... 既存フィールド
    #[serde(default)]
    pub chat_history: Option<Vec<ChatHistoryEntry>>,
}
```

### Alternatives Considered

#### Option A: 別ファイル（`.csvchat`）に保存
- **メリット**: メタデータファイルの肥大化を防ぐ
- **デメリット**: ファイル管理が複雑、同期の問題
- **結論**: 統合管理の方がシンプル、採用しない

#### Option B: データベース
- **メリット**: クエリが容易、履歴検索が高速
- **デメリット**: 追加の依存関係、配布の複雑さ
- **結論**: 過剰な実装、採用しない

---

## 7. Undo/Redo機能との統合

### Decision: 既存のUndo/Redo履歴にスクリプト実行を統合

### Rationale

1. **一貫性**: ユーザーはすべての操作を同じ方法でUndoできる
2. **既存実装の活用**: 既存のUndo/Redoシステムを拡張

### Implementation Approach

スクリプト実行前の状態をスナップショットとして保存：

```rust
// スクリプト実行前の状態を保存
let snapshot = csv_data.clone();

// スクリプト実行
let result = execute_script(script, csv_data)?;

// Undo履歴に追加
history.push(HistoryAction::ScriptExecution {
    snapshot,
    script: script.clone(),
    changes: result.changes,
});
```

### Alternatives Considered

#### Option A: スクリプト専用のUndoシステム
- **メリット**: スクリプト固有の機能を追加しやすい
- **デメリット**: ユーザー体験の不統一
- **結論**: 統合の方が一貫性がある、採用しない

---

## Summary of Decisions

| 技術選択 | 決定 | 主な理由 |
|---------|------|---------|
| Python実行 | `std::process::Command` | シンプル、柔軟、分離性 |
| LLM統合 | 既存クライアント拡張 | 一貫性、設定の統一 |
| セキュリティ | 多層防御（検証+制限） | 実装の簡潔さ、効果的 |
| 進捗表示 | Tauriイベント | リアルタイム性、シンプル |
| スクリプト生成 | テンプレートベース | 安全性、保守性 |
| チャット履歴 | `.csvmeta`に統合 | 既存システムの活用 |
| Undo/Redo | 既存システムに統合 | 一貫性 |

---

## Next Steps

1. Phase 1: 設計ドキュメントの作成
   - `data-model.md`: エンティティ定義
   - `contracts/`: Tauriコマンドのインターフェース
   - `quickstart.md`: クイックスタートガイド

2. Phase 2: タスク分解
   - 実装タスクの詳細化
   - 依存関係の明確化

---

*Research completed: 2025-01-27*

