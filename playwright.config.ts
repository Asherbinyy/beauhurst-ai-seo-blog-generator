import { defineConfig, devices } from '@playwright/test'
import { resolve } from 'node:path'
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  expect: { timeout: 10000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
  ],
  webServer: {
    command: 'node .output-test/server/index.mjs',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    env: {
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: '3100',
      NUXT_ARTICLE_DATA_DIR: resolve('.data/e2e-articles'),
      NUXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3100',
      NUXT_GEMINI_API_KEY: 'e2e-placeholder-never-public',
    },
    timeout: 30000,
  },
})
