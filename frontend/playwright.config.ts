import { defineConfig } from '@playwright/test'

// 画面を操作して、DB（API）の中身が正しく変わるかを確かめる E2E テスト。
// サーバー（DB 5432・API 8080・画面 5173）は起動しておく（README「起動方法」）。
// テストは自分用のリストを作って操作し、終わったら消すので、もとのデータは残る
export default defineConfig({
  testDir: './e2e',
  // 同じ DB を使うので 1 つずつ順に動かす
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    // パソコンに入っている Microsoft Edge を使う（ブラウザのダウンロードは要らない）
    channel: 'msedge',
    viewport: { width: 1600, height: 900 },
    trace: 'retain-on-failure',
  },
})
