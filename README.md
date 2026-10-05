# 課題

git と GitHub の練習用リポジトリです。

- [docs/要件定義書.md](docs/要件定義書.md)：タスク管理アプリの要件定義書
- [mock/kanban-mock.html](mock/kanban-mock.html)：画面のモック（ブラウザで開くと操作できる）
- [backend/](backend/)：API サーバー（Java 21 + Spring Boot）
- [frontend/](frontend/)：画面（React + TypeScript + Vite）
- [compose.yaml](compose.yaml)：開発用の PostgreSQL 17

## 起動方法

必要なもの：JDK 21、Node.js、Docker Desktop

ターミナルを 3 つ使い、それぞれ `kadai` フォルダから次を実行する。

1. データベース：`docker compose up -d`
2. API サーバー：`cd backend` → `.\mvnw.cmd spring-boot:run`（http://localhost:8080/api/health で `{"status":"ok"}` が返れば起動済み）
3. 画面：`cd frontend` → `npm install`（初回のみ）→ `npm run dev`

ブラウザで http://localhost:5173 を開く。画面から `/api` へのリクエストは API サーバーへ転送される。

データベースを止めるときは `docker compose down`（データは残る）。
