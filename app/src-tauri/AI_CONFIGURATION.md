# AI機能 設定ガイド

Cleaの AI機能は環境変数で設定できます。

## 設定方法

1. `.env.example` を `.env` にコピー
   ```bash
   cd app/src-tauri
   cp .env.example .env
   ```

2. `.env` ファイルを編集して設定を変更

3. アプリケーションを再起動

## 環境変数一覧

### 基本設定

| 変数名 | デフォルト | 説明 |
|--------|-----------|------|
| `AI_ENABLED` | `true` | AI機能の有効/無効 |
| `AI_MAX_ROWS_PER_OPERATION` | `10000` | 1回の操作で処理する最大行数 |
| `AI_MAX_CONTEXT_SIZE` | `100000` | AI分析の最大コンテキストサイズ（文字数） |
| `AI_CONFIDENCE_THRESHOLD` | `0.7` | 意図検出の信頼度閾値（0.0-1.0） |
| `AI_DEBUG_MODE` | `false` | デバッグモード（詳細ログ出力） |
| `AI_OPERATION_TIMEOUT_SECS` | `30` | AI操作のタイムアウト（秒） |

### モデル設定

| 変数名 | デフォルト | 説明 |
|--------|-----------|------|
| `AI_MODEL_NAME` | `local` | 使用するAIモデル名<br/>• `local`: パターンマッチング（APIキー不要）<br/>• `gpt-4o-mini`: OpenAI（高速・安価）<br/>• `gpt-4o`: OpenAI（高精度）<br/>• `gemini-1.5-flash`: Google Gemini（高速）<br/>• `gemini-1.5-pro`: Google Gemini（高精度） |

### 外部APIサービス設定（オプション）

| 変数名 | デフォルト | 説明 |
|--------|-----------|------|
| `AI_API_KEY` | - | 外部AIサービスのAPIキー<br/>• OpenAI: `sk-proj-...`<br/>• Gemini: `AIzaSy...` |
| `AI_API_ENDPOINT` | 自動検出 | APIエンドポイント（通常は設定不要） |

### 機能フラグ

| 変数名 | デフォルト | 説明 |
|--------|-----------|------|
| `AI_ENABLE_ADVANCED_ANALYTICS` | `false` | 高度な分析機能（相関分析、外れ値検出など） |
| `AI_ENABLE_TRANSFORMATIONS` | `true` | データ変換機能 |

## 設定例

### 例1: OpenAI (GPT-4o-mini) を使用

```bash
# .env
AI_ENABLED=true
AI_MODEL_NAME=gpt-4o-mini
AI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxx

# オプション: デバッグモードで動作確認
AI_DEBUG_MODE=true
```

**取得方法:**
1. https://platform.openai.com/api-keys にアクセス
2. "Create new secret key" でAPIキーを作成
3. 生成されたキーを `AI_API_KEY` に設定

**料金:** GPT-4o-miniは非常に安価（入力$0.15/1M tokens）

### 例2: Google Gemini を使用

```bash
# .env
AI_ENABLED=true
AI_MODEL_NAME=gemini-1.5-flash
AI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxx
```

**取得方法:**
1. https://makersuite.google.com/app/apikey にアクセス
2. "Create API key" でキーを作成
3. 生成されたキーを `AI_API_KEY` に設定

**料金:** Gemini 1.5 Flashは無料枠あり（月1500リクエスト）

### 例3: ローカル処理のみ（デフォルト）

```bash
# .env
AI_ENABLED=true
AI_MODEL_NAME=local
# AI_API_KEY は不要
```

パターンマッチングで動作。APIキー不要、完全無料。

### 例4: デバッグモード有効化

```bash
# .env
AI_ENABLED=true
AI_DEBUG_MODE=true
```

起動時にAI設定の詳細が表示されます。

### 例5: 大規模データセット対応

```bash
# .env
AI_ENABLED=true
AI_MAX_ROWS_PER_OPERATION=50000
AI_MAX_CONTEXT_SIZE=500000
AI_OPERATION_TIMEOUT_SECS=60
```

より多くの行を一度に処理し、タイムアウトを延長します。

### 例6: 基本機能のみ

```bash
# .env
AI_ENABLED=true
AI_ENABLE_ADVANCED_ANALYTICS=false
AI_ENABLE_TRANSFORMATIONS=true
```

高度な分析は無効化し、基本的な統計とデータ変換のみ使用します。

### 例7: 完全無効化

```bash
# .env
AI_ENABLED=false
```

AI機能を完全に無効化します。

## トラブルシューティング

### 設定が反映されない

1. `.env` ファイルが正しい場所（`app/src-tauri/`）にあるか確認
2. アプリケーションを完全に再起動
3. デバッグモードで起動して設定値を確認

```bash
# デバッグモードで起動
AI_DEBUG_MODE=true cargo run
```

### AI機能が動作しない

1. `AI_ENABLED=true` になっているか確認
2. ログファイルでエラーメッセージを確認
3. 設定値が有効範囲内か確認
   - `AI_CONFIDENCE_THRESHOLD`: 0.0 - 1.0
   - `AI_MAX_ROWS_PER_OPERATION`: > 0
   - `AI_OPERATION_TIMEOUT_SECS`: > 0

### パフォーマンス問題

メモリ不足や処理が遅い場合:

```bash
# .env
AI_MAX_ROWS_PER_OPERATION=5000  # 処理行数を減らす
AI_OPERATION_TIMEOUT_SECS=60    # タイムアウトを延長
```

## セキュリティ注意事項

⚠️ **重要**: `.env` ファイルはバージョン管理（Git）にコミットしないでください。

- `.env` はすでに `.gitignore` に追加されています
- APIキーなどの機密情報は `.env` に保存してください
- `.env.example` は設定例として保存し、実際の値は含めないでください

## 開発環境での使用

開発中は環境変数を直接設定することもできます:

```bash
# macOS/Linux
export AI_DEBUG_MODE=true
export AI_MAX_ROWS_PER_OPERATION=1000
cargo run

# Windows PowerShell
$env:AI_DEBUG_MODE="true"
$env:AI_MAX_ROWS_PER_OPERATION="1000"
cargo run
```

## ログレベル設定

AI操作の詳細ログを表示:

```bash
RUST_LOG=clea::ai=debug cargo run
```

全モジュールのデバッグログ:

```bash
RUST_LOG=debug cargo run
```
