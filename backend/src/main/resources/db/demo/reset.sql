-- デモ環境のリセット（DemoResetService が実行する。Flyway のマイグレーションではない）
-- 全部のリストとカードを消して id を 1 から振り直し、初期状態の 3 つのリスト（V1 と同じ）を入れる。
-- このあと db/testdata のサンプルのカードを入れる
TRUNCATE cards, lists RESTART IDENTITY;

INSERT INTO lists (title, position) VALUES
  ('やること', 0),
  ('作業中', 1),
  ('完了', 2);
