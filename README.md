# タスク管理アプリ（kadai）

Trello 風のタスク管理アプリを作りながら、Java / Spring Boot / React / PostgreSQL での Web アプリ開発と、git / GitHub の使い方を学ぶための講義課題リポジトリです。

タスクを「カード」として「リスト」（やること・作業中・完了）に並べ、進み具合を管理します。詳しい仕様は [docs/要件定義書.md](docs/要件定義書.md) にあります。

## 目次

- [できること](#できること)
- [技術スタック](#技術スタック)
- [フォルダ構成](#フォルダ構成)
- [起動方法](#起動方法)
- [テストデータを入れる](#テストデータを入れる)
- [テストとコードチェック](#テストとコードチェック)
- [API](#api)
- [データベース](#データベース)
- [困ったとき](#困ったとき)
- [開発ルール](#開発ルール)

## できること

機能の番号（F-01 など）は要件定義書の「3. 機能要件」に対応しています。

| 機能 | API | 画面 |
| --- | --- | --- |
| ボード（リストとカード）の表示 | ✅ | ✅ |
| F-01 リストの追加・名前変更・削除 | ✅ | まだ |
| F-02 カードの追加・編集・削除 | ✅ | ✅ |
| F-03 カードの移動（ドラッグ＆ドロップ） | ✅ | ✅ |
| F-04 データの保存（PostgreSQL） | ✅ | ― |
| F-05 Web 公開 | ― | まだ（公開先は未定） |
| F-06 削除の確認 | ― | カードのみ（リストは画面での削除と一緒に付ける） |
| F-08 期限・優先順位 | ✅ | ✅ |
| F-09 期限順の並べ替え | ✅ | ✅ |
| F-10 カードの検索（タイトル・リスト・優先順位・期限） | ✅ | ✅ |

画面の完成イメージは [mock/kanban-mock.html](mock/kanban-mock.html) をブラウザで開くと操作できます（データはブラウザ内だけで動くモックです）。

## 技術スタック

| 部分 | 使っているもの |
| --- | --- |
| 画面 | React 19 + TypeScript + Vite、ドラッグ＆ドロップは dnd-kit、コードチェックは oxlint、E2E テストは Playwright |
| API サーバー | Java 21 + Spring Boot 4（Web MVC・Data JPA・Validation）、ビルドは Maven（`mvnw` 同梱）、コードチェックは spring-javaformat・SpotBugs |
| データベース | PostgreSQL 17（Docker）、テーブルは Flyway で作成 |

## フォルダ構成

```
kadai/
├── backend/                API サーバー（Spring Boot）
│   └── src/main/
│       ├── java/com/example/kanban/   コントローラー・サービス・エンティティ
│       └── resources/
│           ├── application.properties       DB の接続先など
│           ├── application-dev.properties   dev プロファイル用（テストデータを入れる）
│           └── db/
│               ├── migration/   テーブル作成と初期リスト（Flyway）
│               └── testdata/    開発用のテストデータ（dev のときだけ）
├── frontend/               画面（React + Vite）
│   ├── src/
│   │   ├── App.tsx             ボードの読み込み・検索・カードの追加と更新・保存状態の表示
│   │   ├── BoardView.tsx       リストの表示とドラッグ＆ドロップ
│   │   ├── CardView.tsx        カード 1 枚の表示と編集欄
│   │   ├── AddCardForm.tsx     カードの追加フォーム
│   │   ├── PriorityPicker.tsx  優先順位（高・中・低）のラジオボタン
│   │   ├── SearchForm.tsx      検索フォーム
│   │   └── api.ts              API の呼び出し
│   └── e2e/                画面を操作して DB の更新を確かめる E2E テスト（Playwright）
├── docs/要件定義書.md      アプリの要件
├── mock/kanban-mock.html   画面のモック
├── compose.yaml            開発用の PostgreSQL
├── .githooks/              main へのコミットなどを止める git フック
├── .github/workflows/      GitHub Actions（コードチェックとテストの自動実行）
├── CONTRIBUTING.md         開発ルール
└── CLAUDE.md               Claude Code への指示
```

## 起動方法

### 必要なもの

- JDK 21
- Node.js
- Docker Desktop

### 初回だけ

```
git clone https://github.com/y0408e0301-star/kadai.git
cd kadai
git config core.hooksPath .githooks
```

`git config core.hooksPath .githooks` は開発ルールを守らせる git フックを有効にする設定です（[CONTRIBUTING.md](CONTRIBUTING.md)）。

### 起動する

ターミナルを 3 つ使い、それぞれ `kadai` フォルダから次を実行します。

| 順番 | 起動するもの | コマンド | ポート |
| --- | --- | --- | --- |
| 1 | データベース | `docker compose up -d` | 5432 |
| 2 | API サーバー | `cd backend` → `.\mvnw.cmd spring-boot:run` | 8080 |
| 3 | 画面 | `cd frontend` → `npm install`（初回のみ）→ `npm run dev` | 5173 |

- API サーバーは http://localhost:8080/api/health で `{"status":"ok"}` が返れば起動済みです
- ブラウザで http://localhost:5173 を開きます。画面から `/api` へのリクエストは、[frontend/vite.config.ts](frontend/vite.config.ts) の proxy で API サーバー（8080）へ転送されます
- ポートは上の表のものだけを使います。使われていたら、そのポートを使っているプロセスを止めてから起動し直します（別のポートでは起動しません）

### 止める

- 画面・API サーバー：それぞれのターミナルで `Ctrl + C`
- データベース：`docker compose down`（データは残ります）

### 接続先の DB を変える

API サーバーの接続先は、既定で開発用 DB（`localhost:5432/kanban`、ユーザー・パスワードとも `kanban`）です。別の DB を使うときは環境変数 `DB_URL`・`DB_USERNAME`・`DB_PASSWORD` を設定します。

## テストデータを入れる

API サーバーを `dev` プロファイルで起動すると、[backend/src/main/resources/db/testdata](backend/src/main/resources/db/testdata) のテストデータ（カード 11 枚）も DB に入ります。

```
cd backend
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=dev"
```

- Flyway が 1 回だけ入れるので、2 回目以降の起動では増えません
- 今あるカードは消さず、「やること」「作業中」「完了」の末尾に追加します
- 期限は入れた日からの相対日付なので、期限が近いカード・過ぎたカードが必ず含まれます

## テストとコードチェック

| 対象 | コマンド（それぞれのフォルダで実行） | 内容 |
| --- | --- | --- |
| API サーバー | `.\mvnw.cmd test` | API を通して DB を読み書きするテスト。データベースを起動しておく。テストごとに巻き戻すので DB の中身は変わらない |
| API サーバー | `.\mvnw.cmd verify` | テストに加えて、書式チェック（spring-javaformat）と静的解析（SpotBugs）。書式は `.\mvnw.cmd spring-javaformat:apply` で直せる。SpotBugs で対象外にしたものは [backend/spotbugs-exclude.xml](backend/spotbugs-exclude.xml) |
| 画面 | `npm run lint` | oxlint でコードをチェック（設定は [frontend/.oxlintrc.json](frontend/.oxlintrc.json)）。警告が 1 つでもあれば失敗する |
| 画面 | `npm run build` | 型チェックと本番用のビルド（`dist/` に出力） |
| 画面 | `npm run test:e2e` | E2E テスト（下の「画面の操作が保存されるかを確かめる」） |

Pull Request を作ったときと main に push したときは、GitHub Actions（[.github/workflows/ci.yml](.github/workflows/ci.yml)）が `npm run lint`・`npm run build`・`mvnw verify` を自動で実行します（E2E テストは除く）。結果は PR の「Checks」で見られます。

### 画面の操作が保存されるかを確かめる（E2E テスト）

[frontend/e2e](frontend/e2e) のテストは、Playwright でブラウザ（パソコンに入っている Microsoft Edge）を動かし、画面でカードを操作したあとに次の 2 つを確かめます。

1. API（`GET /api/board`・`GET /api/cards/{id}`）で読んだ DB の中身が、操作どおりに変わっている
2. ページを読み直しても、同じ並び・内容で表示される

| 確かめる操作 | 確かめること |
| --- | --- |
| 同じリストの中でドラッグ | 並べ替えた順で保存される |
| 別のリスト（「完了」・空のリスト）へドラッグ | 移動先・移動元の両方の並びが保存される |
| カード上の「高・中・低」 | 優先順位が保存され、編集欄は開かない |
| カードの編集（タイトル・期限・優先順位） | 保存される。前後の空白は除かれる。期限が近いと黄色、過ぎると赤 |
| 期限を消す | 「期限なし」で保存される |
| 空のタイトル・Esc | 保存されない |
| カード右上の × → 確認の「削除する」 | 削除が保存される。× を押しても編集欄は開かず、確認が出る。検索結果の表示中も消せる |
| 確認の「キャンセル」・Esc | 削除されない。「キャンセル」で閉じると × にフォーカスが戻る |
| 保存の失敗 | 「保存できませんでした」と出て、表示が DB の状態に戻る |
| 「期限順に並べる」 | 期限順に並び、その順で保存される |

- 3 つのサーバー（DB・API・画面）を起動してから、`frontend` で `npm run test:e2e` を実行します
- テストは自分用のリスト（`E2E …`）を作って操作し、終わったら消します。「期限順に並べる」のテストはもとのカードの順を覚えておき、最後に戻します
- 失敗したときは `test-results/` に操作の記録（trace）が残ります。`npx playwright show-trace <trace.zip>` で見られます

## API

API サーバーは `http://localhost:8080` で動きます。リクエスト・レスポンスの本文はどれも JSON です。

### 一覧

| メソッド | パス | 内容 | 成功時 |
| --- | --- | --- | --- |
| GET | `/api/health` | 起動確認 | 200 `{"status":"ok"}` |
| GET | `/api/board` | ボード全体（リストとカード） | 200 |
| POST | `/api/lists` | リストを追加 | 201 |
| PATCH | `/api/lists/{id}` | リストの名前を変更 | 200 |
| DELETE | `/api/lists/{id}` | リストを削除（中のカードも消える） | 204 |
| GET | `/api/cards` | カードを検索 | 200 |
| GET | `/api/cards/{id}` | カードを 1 枚取得 | 200 |
| POST | `/api/lists/{listId}/cards` | カードを追加（リストの末尾） | 201 |
| PATCH | `/api/cards/{id}` | カードを編集 | 200 |
| DELETE | `/api/cards/{id}` | カードを削除 | 204 |
| PUT | `/api/cards/{id}/move` | カードを移動 | 204 |
| POST | `/api/board/sort-by-due` | 各リストのカードを期限順に並べ替える | 200（並べ替えたあとのボード） |

入力がおかしいとき（空のタイトル、長すぎるタイトル、`high`・`mid`・`low` 以外の優先順位など）は 400、指定した id のリスト・カードがないときは 404 を返します。

### ボード

`GET /api/board` はリストを左から順に、各リストのカードを上から順に返します。

```json
{
  "lists": [
    {
      "id": 1,
      "title": "やること",
      "cards": [
        { "id": 1, "title": "レポートを書く", "priority": "high", "due": "2026-10-10" }
      ]
    },
    { "id": 2, "title": "作業中", "cards": [] },
    { "id": 3, "title": "完了", "cards": [] }
  ]
}
```

### リスト

| 操作 | 送る JSON | 決まり |
| --- | --- | --- |
| 追加・名前変更 | `{"title": "やること"}` | タイトルは必須・100 文字まで。前後の空白は取り除く |

追加したリストは右端に入ります。

### カード

| 操作 | 送る JSON | 決まり |
| --- | --- | --- |
| 追加 | `{"title": "レポートを書く", "priority": "high", "due": "2026-10-10"}` | `title` は必須・200 文字まで。`priority` は省略すると `mid`、`due` は省略すると期限なし |
| 編集 | `{"priority": "low"}` など | 送った項目だけ変わる。`{"due": null}` で期限を消す |
| 移動 | `{"listId": 2, "position": 0}` | `position` は移動先リストでの 0 始まりの位置。同じリストの中の並べ替えにも使う |

`priority` は `high`（高）・`mid`（中）・`low`（低）、`due` は `YYYY-MM-DD` 形式です。

`POST /api/board/sort-by-due`（本文なし）は、各リストのカードを期限が近い順に並べて保存し、`GET /api/board` と同じ形でボードを返します。期限なしは最後、同じ期限なら優先順位の高い順、それも同じなら元の順のままです。

### カードの検索

`GET /api/cards` は条件に合うカードを、画面と同じ順（リストの順 → リストの中の順）で返します。条件はどれも省略でき、指定したものをすべて満たすカードを返します（何も指定しなければ全カード）。

| パラメーター | 内容 | 例 |
| --- | --- | --- |
| `q` | タイトルの部分一致（大文字・小文字は区別しない） | `q=レポート` |
| `listId` | リストの id | `listId=1` |
| `priority` | 優先順位（`high`・`mid`・`low`） | `priority=high` |
| `dueFrom` / `dueTo` | 期限がこの日以降 / この日以前（両端を含む。期限なしのカードは出ない） | `dueTo=2026-10-31` |

検索結果と `GET /api/cards/{id}` のカードには、入っているリストの `listId`・`listTitle` が付きます。

```json
{"cards":[{"id":1,"listId":1,"listTitle":"やること","title":"レポートを書く","priority":"high","due":"2026-10-10"}]}
```

画面では、ボードの上の検索フォームに条件を入れて「検索」を押すと、条件に合うカードだけがボードに残ります（該当 0 枚のリストも列は残ります）。「クリア」で全カードの表示に戻ります。

### 画面からカードを追加する

各リストの下の「＋ カードを追加」を押すと、タイトル・期限・優先順位の入力欄が開きます。「カードを追加」または Enter（Shift + Enter は改行）で `POST /api/lists/{listId}/cards` を呼び、リストの末尾に入ります。入力欄は開いたままなので続けて追加でき、Esc か「×」で閉じます。

- タイトルが空のときは送らずに「タイトルを入力してください」と出します
- 検索結果の表示中は「＋ カードを追加」を出しません（追加したカードが条件に合わず見えなくなるため）。「クリア」で戻すと出ます

### 画面からカードを更新する

画面での操作は、すぐに表示を変えてから API で保存します。ヘッダーの右に「保存中…」→「保存しました 12:34:56」と出ます。保存できなかったときは「保存できませんでした」と出し、ボードを DB から読み直して表示を DB の状態に戻します。

| 操作 | やり方 | 呼ぶ API |
| --- | --- | --- |
| 並べ替え・別のリストへ移動 | カードをドラッグする（キーボードでは、カードにフォーカスして Space でつかみ、矢印で動かし、Space で置く。Esc で取り消し）。「完了」へ動かすのが完了の操作 | `PUT /api/cards/{id}/move` |
| 優先順位の切り替え | カード上の「高・中・低」を押す | `PATCH /api/cards/{id}` |
| タイトル・期限・優先順位の編集 | カードをクリック（または Enter）して編集欄を開き、「保存」か Enter。Esc か「キャンセル」で取り消し。空のタイトルは保存しない | `PATCH /api/cards/{id}` |
| 削除 | カードにマウスを乗せる（またはフォーカスする）と右上に出る × を押し、カードの中に出る確認で「削除する」を押す。「キャンセル」か Esc でやめる | `DELETE /api/cards/{id}` |
| 期限順に並べる | ヘッダーの「期限順に並べる」 | `POST /api/board/sort-by-due` |

- 期限は 2 日以内なら黄色、過ぎていたら赤で出ます
- 検索結果の表示中は、編集・優先順位の切り替え・削除だけできます（ドラッグと「期限順に並べる」は「クリア」で戻すと使えます）

### PowerShell で試す

`Invoke-RestMethod` は日本語が文字化けするので、`curl.exe` を使います。

```
[Console]::OutputEncoding = [Text.Encoding]::UTF8

# 検索
curl.exe -s -G http://localhost:8080/api/cards --data-urlencode "q=レポート" -d priority=high

# 送る JSON は UTF-8（BOM なし）のファイルに書いて渡す。引数に直接書くと文字化けや " の欠けが起きる
function Save-Json($json, $file) { [IO.File]::WriteAllText("$PWD\$file", $json) }

# カードを「やること」（id 1）に追加
Save-Json '{"title":"レポートを書く","priority":"high","due":"2026-10-10"}' card.json
curl.exe -s -X POST http://localhost:8080/api/lists/1/cards -H "Content-Type: application/json" --data-binary "@card.json"

# カード（id 1）を「作業中」（id 2）の先頭へ移動
Save-Json '{"listId":2,"position":0}' move.json
curl.exe -s -X PUT http://localhost:8080/api/cards/1/move -H "Content-Type: application/json" --data-binary "@move.json"
```

## データベース

テーブルは [V1__create_lists_and_cards.sql](backend/src/main/resources/db/migration/V1__create_lists_and_cards.sql) で作ります。API サーバーの起動時に Flyway が `db/migration` の SQL を順に適用します（初回はテーブル作成と初期リスト 3 つの登録）。

| テーブル | 主な列 |
| --- | --- |
| `lists` | `id`、`title`（100 文字まで）、`position`（左からの順番） |
| `cards` | `id`、`list_id`、`title`（200 文字まで）、`position`（上からの順番）、`priority`（`high`・`mid`・`low`、既定 `mid`）、`due`（期限、なしも可） |

- リストを消すと、中のカードも一緒に消えます（`ON DELETE CASCADE`）
- テーブルを変えるときは、既存の SQL を書き換えず `V2__....sql` のように新しいファイルを足します

## 困ったとき

| 症状 | 原因と対処 |
| --- | --- |
| API サーバーが DB につながらずに止まる | データベースが起動していない。`docker compose up -d` を実行する（Docker Desktop が起動しているかも確認） |
| 「ポートが使われている」（`Port 8080 was already in use`、`EADDRINUSE` など） | 前に起動したサーバーが残っている。そのポートを使っているプロセスを止めてから起動し直す（PowerShell なら `Get-NetTCPConnection -LocalPort 8080` で PID を調べて `Stop-Process -Id <PID>`） |
| 新しく追加した API が 404 になる | 古い API サーバーが動き続けている。止めてから起動し直す |
| 画面に「ボードを読み込めませんでした」と出る | API サーバーが起動していない。http://localhost:8080/api/health を確認する |
| PowerShell で日本語が文字化けする | `[Console]::OutputEncoding = [Text.Encoding]::UTF8` を実行し、`curl.exe` を使う |
| テストデータが入らない | すでに 1 回入れている（Flyway は同じものを 2 回入れない）。入れ直すときは `docker compose down -v` で DB を消してから起動し直す（**全データが消える**） |
| コミットが「main への直接コミットは禁止」で止まる | 正常な動き。Issue を立ててブランチを切る（下の開発ルール） |

## 開発ルール

すべての変更は **Issue → ブランチ → Pull Request → squash マージ** の順で取り込みます。文書 1 行の修正でも同じです。作業前に [CONTRIBUTING.md](CONTRIBUTING.md) を必ず読んでください。

```
git switch main
git pull
git switch -c <種類>/<Issue 番号>-<短い説明>   # 例：feat/12-add-card-api
# 変更してコミット
git push -u origin <ブランチ名>
gh pr create                                   # 本文に Closes #<Issue 番号>
```

- main への直接コミット・push、force push、`--no-verify` は禁止です（git フックで止まります）
- Claude Code で作業するときの指示は [CLAUDE.md](CLAUDE.md) にあります
