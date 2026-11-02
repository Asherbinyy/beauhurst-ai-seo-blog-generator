import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const fintech = fileURLToPath(
  new URL(
    '../../task-requirements/fintech_companies_seed.csv',
    import.meta.url,
  ),
)
const healthtech = fileURLToPath(
  new URL('../fixtures/companies-healthtech.csv', import.meta.url),
)
const invalid = fileURLToPath(
  new URL('../fixtures/invalid-companies.csv', import.meta.url),
)

test('fintech upload produces all rows, accurate facts, metadata and raw SSR content', async ({
  page,
  request,
  browser,
}, testInfo) => {
  const failures: string[] = []
  page.on('pageerror', (error) => failures.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'From company data to article.',
  )
  await page.getByLabel('Choose your company CSV').setInputFiles(fintech)
  await expect(
    page.getByText('fintech_companies_seed.csv', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Generate article' }).click()
  await expect(page).toHaveURL(/\/blog\//)
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Financial technology',
  )
  await expect(page.locator('table tbody tr')).toHaveCount(100)
  await expect(page.locator('table tbody tr').first()).toContainText('Nevis')
  await expect(page.locator('table tbody tr').last()).toContainText(
    'Ledger Rocket',
  )
  await expect(
    page.getByRole('definition').filter({ hasText: '£622,301,270' }),
  ).toBeVisible()
  await expect(
    page.getByRole('definition').filter({ hasText: '£4,146,786' }),
  ).toBeVisible()
  await expect(
    page.getByRole('definition').filter({ hasText: '33.0%' }),
  ).toBeVisible()
  await expect(
    page.locator('.region-panel li').filter({ hasText: 'London' }),
  ).toContainText('78')
  await expect(page).toHaveTitle(/Financial technology/)
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /Financial technology/i,
  )
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
    'content',
    'article',
  )
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    page.url(),
  )
  const jsonLd = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent()) ??
      '{}',
  )
  expect(jsonLd['@type']).toBe('BlogPosting')
  expect(jsonLd).not.toHaveProperty('author')
  expect(jsonLd).not.toHaveProperty('datePublished')
  const html = await (await request.get(page.url())).text()
  const tbody = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)?.[1] ?? ''
  expect(tbody.match(/<tr[ >]/g)).toHaveLength(100)
  expect(html).toMatch(/<h1[^>]*>Financial technology/)
  expect(tbody).toContain('Ledger Rocket')
  expect(html).not.toContain('e2e-placeholder-never-public')
  const noJs = await browser.newContext({ javaScriptEnabled: false })
  const rendered = await noJs.newPage()
  await rendered.goto(page.url())
  await expect(rendered.locator('table tbody tr')).toHaveCount(100)
  await noJs.close()
  await page.reload()
  await expect(page.locator('table tbody tr')).toHaveCount(100)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  if (testInfo.project.name === 'mobile') {
    const table = page.getByRole('region', { name: /Company ranking table/ })
    expect(
      await table.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      ),
    ).toBe(true)
    await table.evaluate((element) => {
      element.scrollLeft = element.scrollWidth
    })
    expect(
      await table.evaluate((element) => element.scrollLeft),
    ).toBeGreaterThan(0)
  }
  await page.screenshot({
    path: testInfo.outputPath('article.png'),
    fullPage: false,
  })
  expect(failures).toEqual([])
})

test('non-fintech CSV without Rank works with a different record count', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByLabel('Choose your company CSV').setInputFiles(healthtech)
  await page.getByRole('button', { name: 'Generate article' }).click()
  await expect(page).toHaveURL(/\/blog\//)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Healthtech',
  )
  await expect(page).toHaveTitle(/Healthtech/)
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /healthtech/i,
  )
  await expect(page.locator('table tbody tr')).toHaveCount(4)
  await expect(page.locator('table tbody tr').first()).toContainText(
    'Pulse Works',
  )
  await expect(page.locator('table tbody tr').last()).toContainText(
    'Clinic Field',
  )
  await expect(
    page.getByRole('definition').filter({ hasText: '£6,000,000' }),
  ).toBeVisible()
  await expect(page.locator('.methodology')).toContainText(
    'Ranks are calculated',
  )
  await page.reload()
  await expect(page.locator('table tbody tr')).toHaveCount(4)
})

test('invalid CSV has actionable errors and can be replaced', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByLabel('Choose your company CSV').setInputFiles(invalid)
  await page.getByRole('button', { name: 'Generate article' }).click()
  await expect(page.getByRole('alert')).toContainText('Total Raised')
  await expect(page.getByRole('alert')).toBeFocused()
  await expect(
    page.getByRole('button', { name: 'Generate article' }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Remove selected file' }).click()
  await expect(
    page.getByRole('button', { name: 'Generate article' }),
  ).toBeDisabled()
})

test('file selection and generation are keyboard accessible', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('link', { name: 'Skip to content' }),
  ).toBeFocused()
  const input = page.getByLabel(/Choose (your company|a different) CSV/)
  await input.setInputFiles(healthtech)
  await input.focus()
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('button', { name: 'Remove selected file' }),
  ).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('button', { name: 'Generate article' }),
  ).toBeFocused()
  await page.screenshot({
    path: testInfo.outputPath('generator.png'),
    fullPage: true,
  })
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/blog\//)
})

test('unknown articles return an actual 404', async ({ page, request }) => {
  expect((await request.get('/blog/not-an-article')).status()).toBe(404)
  await page.goto('/blog/not-an-article')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'couldn’t find',
  )
})

test('provider failure preserves the file and lets the user retry', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  await page.getByLabel('Choose your company CSV').setInputFiles(healthtech)
  await page.route(
    '**/api/articles',
    async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            message:
              'Google denied access to Gemini. Check the API key, project permissions and free-tier access in Google AI Studio.',
          },
        }),
      })
    },
    { times: 1 },
  )
  await page.getByRole('button', { name: 'Generate article' }).click()
  await expect(page.getByRole('alert')).toContainText('project permissions')
  await expect(page.getByRole('alert')).toBeFocused()
  await expect(
    page.getByText('companies-healthtech.csv', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Generate article' }),
  ).toBeEnabled()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: testInfo.outputPath('provider-error.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Generate article' }).click()
  await expect(page).toHaveURL(/\/blog\//)
  await expect(page.locator('table tbody tr')).toHaveCount(4)
})
