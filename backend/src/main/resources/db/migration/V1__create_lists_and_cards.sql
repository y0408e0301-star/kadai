-- 要件定義書 6. データ構造
CREATE TABLE lists (
  id         BIGSERIAL    PRIMARY KEY,
  title      VARCHAR(100) NOT NULL,
  position   INTEGER      NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE TABLE cards (
  id         BIGSERIAL    PRIMARY KEY,
  list_id    BIGINT       NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  title      VARCHAR(200) NOT NULL,
  position   INTEGER      NOT NULL,
  priority   VARCHAR(4)   NOT NULL DEFAULT 'mid'
             CHECK (priority IN ('high', 'mid', 'low')),
  due        DATE,
  created_at TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX cards_list_id_idx ON cards (list_id);

-- 初期状態の 3 つのリスト（F-01）
INSERT INTO lists (title, position) VALUES
  ('やること', 0),
  ('作業中', 1),
  ('完了', 2);
