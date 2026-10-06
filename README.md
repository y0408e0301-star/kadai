# 課題

git と GitHub の練習用リポジトリです。

- [docs/要件定義書.md](docs/要件定義書.md)：タスク管理アプリの要件定義書
- [mock/kanban-mock.html](mock/kanban-mock.html)：画面のモック（ブラウザで開くと操作できる）
- [backend/](backend/)：API サーバー（Java 21 + Spring Boot）
- [frontend/](frontend/)：画面（React + TypeScript + Vite）
- [compose.yaml](compose.yaml)：開発用の PostgreSQL 17
- [CONTRIBUTING.md](CONTRIBUTING.md)：開発ルール（Issue → ブランチ → Pull Request）。作業前に必ず読む

## 起動方法

必要なもの：JDK 21、Node.js、Docker Desktop

ターミナルを 3 つ使い、それぞれ `kadai` フォルダから次を実行する。

1. データベース：`docker compose up -d`
2. API サーバー：`cd backend` → `.\mvnw.cmd spring-boot:run`（http://localhost:8080/api/health で `{"status":"ok"}` が返れば起動済み）
3. 画面：`cd frontend` → `npm install`（初回のみ）→ `npm run dev`

ブラウザで http://localhost:5173 を開く。画面から `/api` へのリクエストは API サーバーへ転送される。

API サーバーは起動時に Flyway で `backend/src/main/resources/db/migration` の SQL を DB に適用する（初回はテーブル作成と初期リスト 3 つの登録）。接続先は既定で開発用 DB（`localhost:5432/kanban`）。別の DB を使うときは環境変数 `DB_URL`・`DB_USERNAME`・`DB_PASSWORD` を設定する。

データベースを止めるときは `docker compose down`（データは残る）。

## テストデータを入れる

API サーバーを `dev` プロファイルで起動すると、`backend/src/main/resources/db/testdata` のテストデータ（カード 11 枚）も DB に入る。Flyway が 1 回だけ入れるので、2 回目以降の起動では増えない。今あるカードは消さず、「やること」「作業中」「完了」の末尾に追加する。

```
cd backend
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=dev"
```

## 画面でカードを検索する

ボードの上の検索フォームにタイトルの一部・リスト・優先順位・期限の範囲を入れて「検索」を押すと、条件に合うカードだけがボードに残る（該当 0 枚のリストも列は残る）。「クリア」で全カードの表示に戻る。条件は下の検索 API にそのまま渡している。

## カードを検索する API

`GET /api/cards` は条件に合うカードを、画面と同じ順（リストの順 → リストの中の順）で返す。条件はどれも省略でき、指定したものをすべて満たすカードを返す。

| パラメーター | 内容 | 例 |
| --- | --- | --- |
| `q` | タイトルの部分一致（大文字・小文字は区別しない） | `q=レポート` |
| `listId` | リストの id | `listId=1` |
| `priority` | 優先順位（`high`・`mid`・`low`） | `priority=high` |
| `dueFrom` / `dueTo` | 期限がこの日以降 / この日以前（両端を含む。期限なしのカードは出ない） | `dueTo=2026-10-31` |

`GET /api/cards/{id}` はカード 1 枚を返す。

PowerShell で試すときは `curl.exe` を使う（`Invoke-RestMethod` は日本語が文字化けする）。

```
[Console]::OutputEncoding = [Text.Encoding]::UTF8
curl.exe -s -G http://localhost:8080/api/cards --data-urlencode "q=レポート" -d priority=high
```

```json
{"cards":[{"id":1,"listId":1,"listTitle":"やること","title":"レポートを書く","priority":"high","due":"2026-10-10"}]}
```
