import { defineConfig } from '@playwright/test'

// 画面を操作して、DB（API）の中身が正しく変わるかを確かめる E2E テスト。
// サーバー（DB 5432・API 8080・画面 5173）は起動しておく（README「起動方法」）。
// テストは自分用のリストを作って操作し、終わったら消すので、もとのデータは残る。
// CI（.github/workflows/ci.yml の e2e ジョブ）でも、同じ 3 つのサーバーを起動して実行する
export default defineConfig({
  testDir: './e2e',
  // CI では test.only の消し忘れで一部のテストだけが通るのを防ぐ
  forbidOnly: !!process.env.CI,
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
