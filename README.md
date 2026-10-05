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
