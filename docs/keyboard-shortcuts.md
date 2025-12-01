# キーボードショートカット一覧

## Clea 実装済みショートカット

### ファイル操作

| アクション | Clea | Google SpreadSheet | Excel |
|------------|------------------|-------------------|-------|
| 保存 | `Cmd/Ctrl + S` | `Cmd/Ctrl + S` | `Cmd/Ctrl + S` |
| 名前を付けて保存 | `Cmd/Ctrl + Shift + S` | `Cmd/Ctrl + Shift + S` | `Cmd/Ctrl + Shift + S` |
| ファイルを開く | `Cmd/Ctrl + O` | `Cmd/Ctrl + O` | `Cmd/Ctrl + O` |
| 新規ファイル | `Cmd/Ctrl + N` | `Cmd/Ctrl + N` | `Cmd/Ctrl + N` |

### 編集操作

| アクション | Clea | Google SpreadSheet | Excel |
|------------|------------------|-------------------|-------|
| コピー | `Cmd/Ctrl + C` | `Cmd/Ctrl + C` | `Cmd/Ctrl + C` |
| カット | `Cmd/Ctrl + X` | `Cmd/Ctrl + X` | `Cmd/Ctrl + X` |
| ペースト | `Cmd/Ctrl + V` | `Cmd/Ctrl + V` | `Cmd/Ctrl + V` |
| 元に戻す | `Cmd/Ctrl + Z` | `Cmd/Ctrl + Z` | `Cmd/Ctrl + Z` |
| やり直し | `Cmd/Ctrl + Shift + Z` | `Cmd/Ctrl + Y` または `Cmd/Ctrl + Shift + Z` | `Cmd/Ctrl + Y` |
| 削除 | `Delete` / `Backspace` | `Delete` / `Backspace` | `Delete` / `Backspace` |
| 全選択 | `Cmd/Ctrl + A` | `Cmd/Ctrl + A` | `Cmd/Ctrl + A` |

### セル操作・ナビゲーション

| アクション | Clea | Google SpreadSheet | Excel |
|------------|------------------|-------------------|-------|
| セル編集を開始 | `Enter` / `F2` | `Enter` / `F2` | `F2` |
| セル編集を確定（次の行へ） | `Enter` | `Enter` | `Enter` |
| セル編集を確定（次の列へ） | `Tab` | `Tab` | `Tab` |
| セル編集をキャンセル | `Escape` | `Escape` | `Escape` |
| セル移動（上） | `↑` | `↑` | `↑` |
| セル移動（下） | `↓` | `↓` | `↓` |
| セル移動（左） | `←` | `←` | `←` |
| セル移動（右） | `→` | `→` | `→` |
| 範囲選択拡張（上） | `Shift + ↑` | `Shift + ↑` | `Shift + ↑` |
| 範囲選択拡張（下） | `Shift + ↓` | `Shift + ↓` | `Shift + ↓` |
| 範囲選択拡張（左） | `Shift + ←` | `Shift + ←` | `Shift + ←` |
| 範囲選択拡張（右） | `Shift + →` | `Shift + →` | `Shift + →` |
| 最初の行へ移動 | `Cmd/Ctrl + ↑` | `Cmd/Ctrl + ↑` | `Cmd/Ctrl + ↑` |
| 最後の行へ移動 | `Cmd/Ctrl + ↓` | `Cmd/Ctrl + ↓` | `Cmd/Ctrl + ↓` |
| 最初の列へ移動 | `Cmd/Ctrl + ←` | `Cmd/Ctrl + ←` | `Cmd/Ctrl + ←` |
| 最後の列へ移動 | `Cmd/Ctrl + →` | `Cmd/Ctrl + →` | `Cmd/Ctrl + →` |

### 行操作

| アクション | Clea | Google SpreadSheet | Excel |
|------------|------------------|-------------------|-------|
| 行を挿入 | `Cmd/Ctrl + Shift + I` | `Cmd/Ctrl + Shift + +` | `Cmd/Ctrl + Shift + +` |
| 行を削除 | （コンテキストメニュー） | `Cmd/Ctrl + -` | `Cmd/Ctrl + -` |
| 行を複製 | （コンテキストメニュー） | （なし） | （なし） |

### 列操作

| アクション | Clea | Google SpreadSheet | Excel |
|------------|------------------|-------------------|-------|
| 列を追加 | （コンテキストメニュー） | `Cmd/Ctrl + Shift + +` | `Cmd/Ctrl + Shift + +` |
| 列を削除 | （コンテキストメニュー） | `Cmd/Ctrl + -` | `Cmd/Ctrl + -` |
| 列名を変更 | （コンテキストメニュー） | （ダブルクリック） | （ダブルクリック） |

### 検索・置換

| アクション | Clea | Google SpreadSheet | Excel |
|------------|------------------|-------------------|-------|
| 検索 | `Cmd/Ctrl + F` | `Cmd/Ctrl + F` | `Cmd/Ctrl + F` |
| 置換 | `Cmd/Ctrl + R` | `Cmd/Ctrl + H` | `Cmd/Ctrl + H` |
| 次の検索結果 | `Enter`（検索中） | `Enter`（検索中） | `Enter`（検索中） |
| 前の検索結果 | `Shift + Enter`（検索中） | `Shift + Enter`（検索中） | `Shift + Enter`（検索中） |
| 検索を閉じる | `Escape`（検索中） | `Escape`（検索中） | `Escape`（検索中） |

### その他

| アクション | Clea | Google SpreadSheet | Excel |
|------------|------------------|-------------------|-------|
| セルをダブルクリックで編集 | 対応 | 対応 | 対応 |
| 範囲選択（Shift+クリック） | 対応 | 対応 | 対応 |
| 行選択（ヘッダークリック） | 対応 | 対応 | 対応 |
| 列選択（ヘッダークリック） | 対応 | 対応 | 対応 |

## 未実装の機能（将来実装予定）

以下のショートカットは、Google SpreadSheetやExcelで利用可能ですが、現在Cleaでは未実装です：

- セルの書式設定（`Cmd/Ctrl + 1`）
- 太字（`Cmd/Ctrl + B`）
- 斜体（`Cmd/Ctrl + I`）
- 下線（`Cmd/Ctrl + U`）
- セルの結合
- コメント機能
- 数式入力（`=`キー）
- オートフィル（`Cmd/Ctrl + D`）
- 行/列の非表示
- 列幅の自動調整（`Cmd/Ctrl + Shift + 0`）

## 注意事項

- Macでは `Cmd` キー、Windows/Linuxでは `Ctrl` キーを使用します
- Cleaは、Mac向けに最適化されているため、主に `Cmd` キーでの操作を想定しています
- 一部の機能はコンテキストメニュー（右クリック）からもアクセス可能です

