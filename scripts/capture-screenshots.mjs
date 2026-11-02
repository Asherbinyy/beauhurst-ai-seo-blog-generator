import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { chromium, devices, expect } from '@playwright/test'
import { captureWalkthrough } from './capture-walkthrough.mjs'

// Run after build:test. This artifact uses the fake provider; no API key is read.
const origin = 'http://127.0.0.1:3101'
const output = resolve('docs/screenshots')
const server = spawn(process.execPath, ['.output-test/server/index.mjs'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: '3101',
    NUXT_ARTICLE_DATA_DIR: resolve('.data/screenshot-articles'),
    NUXT_PUBLIC_SITE_URL: origin,
    NUXT_GEMINI_API_KEY: '',
  },
})
let serverError = ''
server.on('error', (error) => {
  serverError = error.message
})
server.stderr.on('data', (chunk) => {
  serverError += chunk.toString()
})
let browser
try {
  let ready = false
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null || serverError.includes('EADDRINUSE'))
      throw new Error(serverError || 'Screenshot server exited.')
    try {
      ready = (await fetch(origin)).ok
    } catch {
      /* Wait for startup. */
    }
    if (ready) break
    await setTimeout(150)
  }
  if (!ready) throw new Error('Screenshot server did not start.')
  await mkdir(output, { recursive: true })
  browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  await page.goto(origin)
  await page.screenshot({
    path: resolve(output, 'research-desk-light.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Dark theme' }).click()
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
  await page.screenshot({
    path: resolve(output, 'research-desk-dark.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Light theme' }).click()
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
  await page
    .getByLabel('Choose your company CSV')
    .setInputFiles('task-requirements/fintech_companies_seed.csv')
  await page.getByRole('button', { name: 'Generate article' }).click()
  await page.waitForURL('**/blog/**')
  const article = await (
    await page.request.get(
      `${origin}/api/articles/${page.url().split('/').at(-1)}`,
    )
  ).json()
  const demoSlug = 'company-funding-report-00000000-0000-4000-8000-000000000001'
  await mkdir('showcase', { recursive: true })
  await writeFile(
    resolve('showcase', `${demoSlug}.json`),
    JSON.stringify(
      {
        ...article,
        id: '00000000-0000-4000-8000-000000000001',
        slug: demoSlug,
        createdAt: '2026-11-02T00:00:00.000Z',
      },
      null,
      2,
    ) + '\n',
  )
  await page.screenshot({ path: resolve(output, 'article-light.png') })
  await page.getByRole('button', { name: 'Dark theme' }).click()
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
  await page.screenshot({ path: resolve(output, 'article-dark.png') })
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save summary image' }).click()
  await (await download).saveAs(resolve(output, 'summary.png'))
  const mobile = await browser.newContext({
    ...devices['iPhone 13'],
    reducedMotion: 'reduce',
    colorScheme: 'light',
  })
  const mobilePage = await mobile.newPage()
  await mobilePage.setViewportSize({ width: 390, height: 1200 })
  await mobilePage.goto(page.url())
  await mobilePage.screenshot({
    path: resolve(output, 'article-mobile.png'),
    scale: 'css',
  })
  await captureWalkthrough(browser, origin)
  // Capture and inspect a real browser-generated PDF separately from committed images.
  await page.getByLabel('Find a company').fill('Nevis')
  await page.pdf({
    path: resolve('.data/screenshot-articles/article.pdf'),
    preferCSSPageSize: true,
    printBackground: true,
  })
  const signature = (
    await readFile(resolve('.data/screenshot-articles/article.pdf'))
  )
    .subarray(0, 5)
    .toString()
  if (signature !== '%PDF-') throw new Error('PDF export failed.')
  console.log(
    `Screenshots saved to ${output}. PDF saved under .data/screenshot-articles/.`,
  )
} finally {
  await browser?.close()
  server.kill('SIGTERM')
}
