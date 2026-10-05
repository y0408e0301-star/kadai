-- 開発用のテストデータ（application-dev.properties で読み込む。本番の DB には入れない）
-- Flyway が 1 回だけ実行する。今あるカードは消さず、各リストの末尾に追加する。
-- 初期状態の 3 つのリスト（やること・作業中・完了）に入れるので、名前を変えたリストには入らない。
-- 期限は実行した日からの相対日付にして、期限が近い・過ぎたカードが常にあるようにする
WITH data (list_title, title, priority, due, ord) AS (VALUES
  ('やること', 'レポートを書く',           'high', CURRENT_DATE + 1,  1),
  ('やること', '資料を読む',               'mid',  NULL::DATE,        2),
  ('やること', '発表スライドを作る',       'high', CURRENT_DATE + 7,  3),
  ('やること', '参考文献リストを整理する', 'low',  CURRENT_DATE + 14, 4),
  ('やること', '教科書の第3章を読む',      'mid',  CURRENT_DATE - 2,  5),
  ('作業中',   'API の設計',               'high', CURRENT_DATE + 2,  1),
  ('作業中',   'データベースのテーブル設計', 'mid', CURRENT_DATE + 5,  2),
  ('作業中',   'Spring Boot の勉強',       'low',  NULL::DATE,        3),
  ('完了',     '開発環境の準備',           'mid',  CURRENT_DATE - 7,  1),
  ('完了',     '要件定義書を書く',         'high', CURRENT_DATE - 3,  2),
  ('完了',     'GitHub にリポジトリを作る', 'low', NULL::DATE,        3)
),
-- 同じ名前のリストが複数あるときは左にあるもの 1 つに入れる
target_lists AS (
  SELECT DISTINCT ON (title) id, title
  FROM lists
  ORDER BY title, position
)
INSERT INTO cards (list_id, title, priority, due, position)
SELECT l.id, d.title, d.priority, d.due,
       (SELECT coalesce(max(c.position), -1) FROM cards c WHERE c.list_id = l.id) + d.ord
FROM data d
JOIN target_lists l ON l.title = d.list_title;
