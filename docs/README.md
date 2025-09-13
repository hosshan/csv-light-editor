# CSV Light Editor ドキュメント

## 📁 ドキュメント構成

このディレクトリには、CSV Light Editorプロジェクトの設計・開発に関する全てのドキュメントが含まれています。

### 📋 ドキュメント一覧

1. **[requirements.md](./requirements.md)**
   - プロジェクトの要件定義書
   - 機能要件、非機能要件、品質基準
   - ユーザーストーリーと受け入れ基準

2. **[implementation-tasks.md](./implementation-tasks.md)**
   - 実装タスクの詳細一覧
   - 12週間の開発スケジュール
   - 各フェーズごとのチェックリスト
   - テストタスクとリリース基準

3. **[technical-architecture.md](./technical-architecture.md)**
   - システムアーキテクチャ設計
   - コンポーネント詳細設計
   - データフロー設計
   - パフォーマンス最適化戦略

## 🎯 プロジェクト概要

CSV Light Editorは、Mac向けの高速かつ軽量なCSV編集アプリケーションです。

### 主な特徴
- ✨ **高速処理**: 100万行以上のCSVファイルもスムーズに処理
- 🚀 **軽量動作**: メモリ効率的なストリーミング処理
- 🎨 **直感的UI**: Numbersライクな操作性
- 🤖 **AI支援**: データクリーニングと補完機能
- 📊 **計算機能**: Excel互換の関数サポート

### 技術スタック
- **Backend**: Rust + Tauri v2
- **Frontend**: React + TypeScript
- **UI**: TanStack Virtual + Radix UI
- **AI**: Candle (ローカル推論)

## 📅 開発スケジュール

| フェーズ | 期間 | 内容 |
|---------|------|------|
| Phase 1 | Week 1-2 | プロジェクト基盤構築 |
| Phase 2 | Week 3-4 | コア機能実装 |
| Phase 3 | Week 5-6 | 編集機能実装 |
| Phase 4 | Week 7-8 | 計算機能実装 |
| Phase 5 | Week 9-10 | AI機能実装 |
| Phase 6 | Week 11 | エクスポート機能 |
| Phase 7 | Week 12 | 最適化と配布 |

## 🚀 クイックスタート

### 開発環境のセットアップ

1. **必要な依存関係のインストール**
   ```bash
   # Rustのインストール
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   
   # Node.jsのインストール（v18以上）
   brew install node
   
   # Tauri CLIのインストール
   cargo install tauri-cli
   ```

2. **プロジェクトの初期化**
   ```bash
   # プロジェクトのクローン
   git clone <repository-url>
   cd csv-light-editor
   
   # 依存関係のインストール
   npm install
   
   # 開発サーバーの起動
   npm run tauri dev
   ```

3. **ビルド**
   ```bash
   # リリースビルド
   npm run tauri build
   ```

## 📖 ドキュメントの読み方

### 開発者向け

1. まず[requirements.md](./requirements.md)で全体要件を把握
2. [technical-architecture.md](./technical-architecture.md)でシステム設計を理解
3. [implementation-tasks.md](./implementation-tasks.md)で実装タスクを確認

### プロジェクトマネージャー向け

1. [requirements.md](./requirements.md)でビジネス要件を確認
2. [implementation-tasks.md](./implementation-tasks.md)で進捗管理

## 🤝 コントリビューション

プロジェクトへの貢献を歓迎します。以下のガイドラインに従ってください：

1. **コーディング規約**
   - Rust: `cargo fmt` と `cargo clippy` を実行
   - TypeScript: ESLint と Prettier を使用

2. **コミットメッセージ**
   - feat: 新機能
   - fix: バグ修正
   - docs: ドキュメント更新
   - refactor: リファクタリング
   - test: テスト追加
   - perf: パフォーマンス改善

3. **プルリクエスト**
   - 機能ごとにブランチを作成
   - テストを必ず追加
   - ドキュメントを更新

## 📝 ライセンス

このプロジェクトは個人使用を目的としています。商用利用については別途ご相談ください。

## 📧 お問い合わせ

質問や提案がある場合は、Issueを作成してください。

## 🔄 更新履歴

| 日付 | バージョン | 内容 |
|------|-----------|------|
| 2025-01-13 | 0.0.1 | 初期ドキュメント作成 |

---

**注記**: このドキュメントは開発の進行に応じて更新されます。最新の情報については、定期的に確認してください。