import { defineConfig } from '@playwright/test';

/** End-to-end tests run against a locally running stack (backend on :8080 with the dev profile, frontend on :5173). */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [['list']],
  use: { baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5173', viewport: { width: 1366, height: 900 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
