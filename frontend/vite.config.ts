/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // /api へのリクエストは Spring Boot（backend）へ転送する
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  // ユニットテスト（npm test）。e2e/ は Playwright のテストなので含めない
  test: {
    include: ['src/**/*.test.ts'],
  },
})
