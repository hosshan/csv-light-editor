# Implementation Plan: AIチャット機能（スクリプト生成・実行型）

**Branch**: `001-ai-chatgpt-claude` | **Date**: 2025-01-27 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-ai-chatgpt-claude/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → ✓ Feature spec found at specs/001-ai-chatgpt-claude/spec.md
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type: Tauri desktop app (Rust backend + React frontend)
   → Set Structure Decision: Existing project structure (app/src-tauri/, app/src/)
3. Evaluate Constitution Check section below
   → Existing project integration required
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → Research Python execution from Rust, script generation, progress tracking
5. Execute Phase 1 → contracts, data-model.md, quickstart.md
6. Re-evaluate Constitution Check section
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

AIチャット機能により、ユーザーは自然言語でCSVデータ操作を指示し、システムがPythonスクリプトを生成・実行します。分析型スクリプトは即座に実行され、変更型スクリプトはプレビュー表示後に承認を求めてから実行されます。実行結果はUndo/Redo可能で、チャット履歴はメタ情報として保存されます。

**技術的アプローチ**:
- RustバックエンドからPythonスクリプトを実行
- LLM統合によるスクリプト生成
- 進捗表示とセキュリティサンドボックス
- 既存のメタデータ管理システムとの統合

## Technical Context
**Language/Version**: 
- Rust 1.75+ (Tauri v1)
- TypeScript 5.8+ / React 19
- Python 3.9+ (スクリプト実行環境)

**Primary Dependencies**: 
- Tauri (IPC通信)
- Python実行環境 (pyo3 または subprocess)
- LLM API (OpenAI/Anthropic API またはローカルモデル)
- 既存: csv, serde, tokio, anyhow

**Storage**: 
- メタデータファイル (.csvmeta) - 既存システムと統合
- チャット履歴をメタデータに追加

**Testing**: 
- Rust: cargo test (単体・統合テスト)
- TypeScript: Jest/Vitest (コンポーネントテスト)
- E2E: Tauriテストフレームワーク

**Target Platform**: 
- macOS 11.0+ (既存アプリケーションのターゲット)

**Project Type**: 
- Desktop application (Tauri) - 既存プロジェクト構造を維持

**Performance Goals**: 
- スクリプト生成: < 3秒
- スクリプト実行: 進捗表示あり（目標値なし、進捗可視化が重要）
- UI応答性: 60fps維持

**Constraints**: 
- 既存のプロジェクト構造（app/src-tauri/, app/src/）を維持
- 既存のメタデータ管理システム（.csvmeta）と統合
- 既存のUndo/Redo機能と統合
- ローカル実行のみ（セキュリティ要件）

**Scale/Scope**: 
- 100万行以上のCSVファイル対応（既存要件）
- チャット履歴の永続化
- 複数のスクリプト実行の管理

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (既存のTauriアプリケーションに統合)
- Using framework directly? ✓ Tauri、Reactを直接使用、ラッパークラスなし
- Single data model? ✓ 既存のCsvMetadataを拡張、DTO不要
- Avoiding patterns? ✓ Repository/UoWパターン不使用、既存パターンに従う

**Architecture**:
- EVERY feature as library? 
  - 既存プロジェクト構造を維持
  - 新規モジュール: `app/src-tauri/src/ai_script/` (スクリプト生成・実行)
  - 新規モジュール: `app/src-tauri/src/chat/` (チャット履歴管理)
  - 既存モジュール拡張: `app/src-tauri/src/metadata/` (チャット履歴保存)
- Libraries listed:
  - `ai_script`: スクリプト生成・実行エンジン
  - `chat`: チャット履歴管理
  - `metadata`: メタデータ管理（既存、拡張）
- CLI per library: N/A (Tauriコマンドとして実装)
- Library docs: llms.txt format planned? 検討中

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? ✓ テストを先に作成
- Git commits show tests before implementation? ✓ コミット戦略に含める
- Order: Contract→Integration→E2E→Unit strictly followed? ✓
- Real dependencies used? ✓ 実際のPython実行環境、実際のCSVファイル
- Integration tests for: 新規ライブラリ、コントラクト変更、共有スキーマ? ✓
- FORBIDDEN: Implementation before test, skipping RED phase ✓ 厳守

**Observability**:
- Structured logging included? ✓ 既存のlogクレートを使用
- Frontend logs → backend? ✓ Tauriのログシステムを活用
- Error context sufficient? ✓ エラーメッセージとスタックトレース

**Versioning**:
- Version number assigned? 既存アプリのバージョン管理に従う
- BUILD increments on every change? 既存のワークフローに従う
- Breaking changes handled? 既存のメタデータ形式との互換性維持

## Project Structure

### Documentation (this feature)
```
specs/001-ai-chatgpt-claude/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (existing project structure)
```
app/
├── src-tauri/src/
│   ├── commands/
│   │   ├── ai.rs              # 既存: AIコマンド（拡張予定）
│   │   └── csv.rs             # 既存: CSVコマンド
│   ├── ai_script/             # 新規: スクリプト生成・実行
│   │   ├── mod.rs
│   │   ├── generator.rs       # スクリプト生成
│   │   ├── executor.rs        # Python実行エンジン
│   │   ├── progress.rs        # 進捗管理
│   │   └── security.rs        # セキュリティサンドボックス
│   ├── chat/                   # 新規: チャット履歴管理
│   │   ├── mod.rs
│   │   ├── history.rs          # チャット履歴管理
│   │   └── message.rs          # メッセージエンティティ
│   ├── metadata/
│   │   └── manager.rs          # 既存: 拡張してチャット履歴保存
│   └── main.rs
│
└── src/
    ├── components/
    │   ├── chat/                # 新規: チャットUI
    │   │   ├── ChatPanel.tsx
    │   │   ├── MessageList.tsx
    │   │   ├── ScriptPreview.tsx
    │   │   └── ProgressIndicator.tsx
    │   └── ...                  # 既存コンポーネント
    ├── store/
    │   ├── csvStore.ts          # 既存: 拡張予定
    │   └── chatStore.ts         # 新規: チャット状態管理
    └── types/
        └── chat.ts              # 新規: チャット型定義
```

**Structure Decision**: 既存のTauri + Reactプロジェクト構造を維持し、新規モジュールを追加

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - Python実行環境の選択（pyo3 vs subprocess）
   - LLM統合方法（API vs ローカルモデル）
   - スクリプト生成のテンプレート設計
   - 進捗表示の実装方法
   - セキュリティサンドボックスの実装

2. **Generate and dispatch research tasks**:
   ```
   - Research: RustからPythonを実行する最適な方法（pyo3 vs subprocess）
   - Research: LLM API統合（OpenAI/Anthropic）のベストプラクティス
   - Research: Pythonスクリプトのセキュリティサンドボックス実装
   - Research: ストリーミング進捗表示の実装パターン
   - Research: スクリプト生成のテンプレート設計パターン
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Script (スクリプト): 内容、種類、生成日時、実行状態
   - ChatMessage (チャットメッセージ): ユーザー指示、システム応答
   - ChatHistory (チャット履歴): メッセージ配列、承認状態
   - ExecutionProgress (実行進捗): 処理済み行数、残り行数、ステップ名
   - ChangePreview (変更プレビュー): 変更前後の値、影響範囲

2. **Generate API contracts** from functional requirements:
   - Tauriコマンド定義:
     - `generate_script(prompt: String) -> Script`
     - `execute_script(script: Script, approval: bool) -> ExecutionResult`
     - `get_progress(execution_id: String) -> Progress`
     - `save_chat_history(csv_path: String, history: ChatHistory) -> Result<()>`
     - `load_chat_history(csv_path: String) -> ChatHistory`
   - Output TypeScript型定義とRust構造体を `/contracts/` に保存

3. **Generate contract tests** from contracts:
   - Tauriコマンドのテスト（Rust側）
   - TypeScript型の整合性テスト
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - 各Acceptance Scenario → 統合テストシナリオ
   - Quickstart test = 主要ユースケースの検証

5. **Update agent file incrementally**:
   - 新規技術スタックをエージェントコンテキストに追加
   - Python実行、LLM統合、進捗表示の情報を追加

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each Tauri command → contract test task [P]
- Each entity → model creation task [P] 
- Each user story → integration test task
- Implementation tasks to make tests pass

**Ordering Strategy**:
- TDD order: Tests before implementation 
- Dependency order: 
  1. データモデル定義
  2. メタデータ拡張（チャット履歴保存）
  3. スクリプト生成エンジン
  4. Python実行エンジン
  5. 進捗管理
  6. チャットUI
  7. 統合
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 30-40 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Python実行環境の追加 | スクリプト実行に必要 | Rustのみではスクリプト生成の柔軟性が不足 |
| LLM統合 | 自然言語からスクリプト生成に必要 | ルールベースでは対応範囲が限定的 |

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) - research.md created
- [x] Phase 1: Design complete (/plan command) - data-model.md, contracts/, quickstart.md created
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS (Phase 1完了)
- [x] All NEEDS CLARIFICATION resolved (Phase 0完了)
- [x] Complexity deviations documented

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*

