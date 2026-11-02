import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

const healthtech = fileURLToPath(
  new URL('../fixtures/companies-healthtech.csv', import.meta.url),
)

test('theme follows the system and persists an explicit choice across navigation and reload', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error')
      errors.push(message.text())
  })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await expect(
    page.getByRole('button', { name: 'System theme' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
  await page.getByRole('button', { name: 'Light theme' }).click()
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByLabel('Choose your company CSV').setInputFiles(healthtech)
  await page.getByRole('button', { name: 'Generate article' }).click()
  await expect(page).toHaveURL(/\/blog\//)
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
  await page.getByRole('button', { name: 'Dark theme' }).click()
  await page.reload()
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
  await page.getByRole('button', { name: 'System theme' }).click()
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
  expect(errors).toEqual([])
})

test('drag enter, leave, invalid drops and a valid drop recover cleanly', async ({
  page,
}) => {
  await page.goto('/')
  const zone = page.locator('.file-picker')
  const csv = await readFile(healthtech, 'utf8')
  const transfer = await page.evaluateHandle((text) => {
    const data = new DataTransfer()
    data.items.add(new File([text], 'dropped.csv', { type: 'text/csv' }))
    return data
  }, csv)
  await zone.dispatchEvent('dragenter', { dataTransfer: transfer })
  await expect(page.getByText('Release to add your dataset')).toBeVisible()
  await zone.dispatchEvent('dragleave', { dataTransfer: transfer })
  await expect(page.getByText('Drop your dataset here')).toBeVisible()
  const invalid = await page.evaluateHandle(() => {
    const data = new DataTransfer()
    data.items.add(new File(['hello'], 'notes.txt'))
    return data
  })
  await zone.dispatchEvent('drop', { dataTransfer: invalid })
  await expect(page.getByRole('alert')).toContainText('ending in .csv')
  await expect(page.getByRole('alert')).toBeFocused()
  const multiple = await page.evaluateHandle(() => {
    const data = new DataTransfer()
    data.items.add(new File(['a'], 'a.csv'))
    data.items.add(new File(['b'], 'b.csv'))
    return data
  })
  await zone.dispatchEvent('drop', { dataTransfer: multiple })
  await expect(page.getByRole('alert')).toContainText('one CSV')
  await zone.dispatchEvent('dragenter', { dataTransfer: transfer })
  await zone.dispatchEvent('drop', { dataTransfer: transfer })
  await expect(page.getByText('Your dataset is ready.')).toBeVisible()
  await expect(page.getByText('dropped.csv', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByRole('button', { name: 'Generate article' }).click()
  await expect(page).toHaveURL(/\/blog\//)
  await expect(page.locator('table tbody tr')).toHaveCount(4)
})

test('search and region filters preserve original ranks and print the complete dataset', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByLabel('Choose your company CSV').setInputFiles(healthtech)
  await page.getByRole('button', { name: 'Generate article' }).click()
  await expect(page).toHaveURL(/\/blog\//)
  const rows = page.locator('table tbody tr:visible')
  await page.getByRole('link', { name: 'Company ranking', exact: true }).click()
  await page.getByLabel('Find a company').fill('pulse')
  await expect(rows).toHaveCount(1)
  await expect(rows).toContainText('Pulse Works')
  await page
    .getByRole('combobox', { name: 'Region', exact: true })
    .selectOption('South West')
  await expect(rows).toHaveCount(1)
  await page.getByLabel('Find a company').fill('nothing matches')
  await expect(
    page.getByRole('heading', { name: 'No matching companies' }),
  ).toBeVisible()
  await expect(rows).toHaveCount(0)
  await page.getByRole('button', { name: 'Show all companies' }).click()
  await expect(rows).toHaveCount(4)
  await page.getByLabel('Find a company').fill('clinic field')
  await expect(rows).toHaveCount(1)
  await expect(rows.locator('.rank-cell')).toHaveText('4')
  await page.getByRole('button', { name: 'Dark theme' }).click()
  await page.emulateMedia({ media: 'print' })
  await expect(rows).toHaveCount(4)
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
  await expect(page.locator('.ranking-controls')).toBeHidden()
  await expect(page.locator('.ranking-scroll')).toHaveCSS('overflow', 'visible')
  await page.emulateMedia({ media: 'screen' })
  await expect(rows).toHaveCount(1)
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printCalled = 'true'
    }
  })
  await page.getByRole('button', { name: 'Save as PDF' }).click()
  await expect(page.locator('body')).toHaveAttribute(
    'data-print-called',
    'true',
  )
})

test('summary downloads a valid PNG and copy link has a usable permissions fallback', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByLabel('Choose your company CSV').setInputFiles(healthtech)
  await page.getByRole('button', { name: 'Generate article' }).click()
  await expect(page).toHaveURL(/\/blog\//)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save summary image' }).click()
  const image = await download
  expect(image.suggestedFilename()).toMatch(/^fieldnotes-.*\.png$/)
  const buffer = await readFile((await image.path())!)
  expect(buffer.subarray(1, 4).toString()).toBe('PNG')
  expect(buffer.readUInt32BE(16)).toBe(1600)
  expect(buffer.length).toBeGreaterThan(10000)
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          document.body.dataset.copiedLink = value
        },
      },
    })
  })
  await page.getByRole('button', { name: 'Copy link' }).click()
  await expect(page.locator('body')).toHaveAttribute(
    'data-copied-link',
    page.url(),
  )
  await expect(page.getByText(/Article link copied/)).toBeVisible()
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('Permission denied')
        },
      },
    })
  })
  await page.getByRole('button', { name: 'Copy link' }).click()
  await expect(page.getByLabel('Article link', { exact: true })).toHaveValue(
    page.url(),
  )
  await expect(page.getByLabel('Article link', { exact: true })).toBeFocused()
})

test('reduced motion disables animations and the sample CSV is compatible', async ({
  page,
  request,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const sample = await request.get('/company-template.csv')
  expect(sample.ok()).toBe(true)
  await page.getByLabel('Choose your company CSV').setInputFiles({
    name: 'template.csv',
    mimeType: 'text/csv',
    buffer: await sample.body(),
  })
  await expect(page.locator('.document-stack')).toHaveCSS(
    'animation-name',
    'none',
  )
  await expect(page.locator('.file-picker')).toHaveCSS(
    'transition-duration',
    '0s',
  )
  await page.getByRole('button', { name: 'Generate article' }).click()
  await expect(page).toHaveURL(/\/blog\//)
  await expect(page.locator('table tbody tr')).toHaveCount(4)
  await expect(page.locator('.region-track > span').first()).toHaveCSS(
    'animation-name',
    'none',
  )
})

test('pending generation prevents file replacement and duplicate submission', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByLabel('Choose your company CSV').setInputFiles(healthtech)
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let requests = 0
  await page.route('**/api/articles', async (route) => {
    requests++
    await gate
    await route.continue()
  })
  await page.getByRole('button', { name: 'Generate article' }).click()
  try {
    await expect(
      page.getByRole('button', { name: 'Creating your article…' }),
    ).toBeDisabled()
    await expect(page.getByLabel('Choose a different CSV')).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Remove selected file' }),
    ).toBeDisabled()
    await expect(page.locator('.upload-status')).toContainText('up to a minute')
    const data = await page.evaluateHandle(() => {
      const transfer = new DataTransfer()
      transfer.items.add(
        new File(['Company,Total Raised\nOther,1'], 'other.csv'),
      )
      return transfer
    })
    await page
      .locator('.file-picker')
      .dispatchEvent('drop', { dataTransfer: data })
    await expect(
      page.getByText('companies-healthtech.csv', { exact: true }),
    ).toBeVisible()
  } finally {
    release()
  }
  await expect(page).toHaveURL(/\/blog\//)
  expect(requests).toBe(1)
})

test('every report column sorts, compact view preserves data and filtered CSV follows the current order', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByLabel('Choose your company CSV').setInputFiles(healthtech)
  await page.getByRole('button', { name: 'Generate article' }).click()
  await expect(page).toHaveURL(/\/blog\//)
  const rows = page.locator('table tbody tr:visible')
  await page.getByRole('button', { name: 'Company', exact: true }).click()
  await expect(rows.first()).toContainText('Care Orchard')
  await expect(
    page.getByRole('columnheader', { name: 'Company', exact: true }),
  ).toHaveAttribute('aria-sort', 'ascending')
  await page.getByRole('button', { name: 'Company', exact: true }).click()
  await expect(rows.first()).toContainText('Well Spring')
  await expect(rows.first().locator('.rank-cell')).toHaveText('3')
  for (const label of [
    'Region',
    'Total raised',
    'Stage',
    'Employees',
    'Industries',
    'Rank',
  ]) {
    const button = page.getByRole('button', { name: label, exact: true })
    await button.click()
    await expect(button.locator('..')).toHaveAttribute('aria-sort', 'ascending')
    await button.click()
    await expect(button.locator('..')).toHaveAttribute(
      'aria-sort',
      'descending',
    )
  }
  await page.getByRole('button', { name: 'Reset order' }).click()
  await expect(rows.first()).toContainText('Pulse Works')
  await page.getByLabel('Show descriptions').uncheck()
  await expect(rows.first().locator('.company-cell p')).toBeHidden()
  await page.getByLabel('Find a company').fill('health')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download CSV' }).click()
  const file = await download
  const contents = await readFile((await file.path())!, 'utf8')
  expect(contents).toContain('Care Orchard')
  expect(contents).toContain('Well Spring')
  expect(contents).not.toContain('Pulse Works')
  expect(contents).toContain('Develops remote patient monitoring software.')
  expect(contents).toContain('1500000.00')
})

test('incomplete CSVs create useful reports with unknowns and explicit funding coverage', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByLabel('Choose your company CSV').setInputFiles({
    name: 'partial.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'Company Name;Funding;Location;URL\nAlpha;100;London;example.com\nBeta;N/A;—;javascript:alert(1)\nGamma;0',
    ),
  })
  await page.getByRole('button', { name: 'Generate article' }).click()
  await expect(page).toHaveURL(/\/blog\//)
  await expect(page.locator('table tbody tr')).toHaveCount(3)
  await expect(page.locator('.stats-grid')).toContainText(
    'Recorded for 2 of 3 companies',
  )
  await expect(page.locator('.stats-grid')).toContainText('£100')
  await expect(page.locator('.methodology')).toContainText(
    '1 of 3 companies have no recorded funding',
  )
  await expect(page.locator('.methodology')).toContainText(
    'Unusable website links were omitted',
  )
  await expect(page.locator('table tbody tr').last()).toContainText('Beta')
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Total raised', exact: true }).click()
  await expect(page.locator('table tbody tr').first()).toContainText('Gamma')
  await expect(page.locator('table tbody tr').last()).toContainText('Beta')
  await page.goto('/')
  await page.getByLabel('Choose your company CSV').setInputFiles({
    name: 'names.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Name\nAlpha\nBeta'),
  })
  await page.getByRole('button', { name: 'Generate article' }).click()
  await expect(page).toHaveURL(/\/blog\//)
  await expect(page.locator('table tbody tr')).toHaveCount(2)
  await expect(page.locator('.stats-grid')).toContainText(
    'Recorded for 0 of 2 companies',
  )
  await expect(page.locator('.stats-grid')).not.toContainText('£0')
  await page.reload()
  await expect(page.locator('table tbody tr')).toHaveCount(2)
})

test('motion is connected to entry, drag feedback and selection while the UI stays provider-neutral', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await expect(page.locator('.generator-heading')).toHaveClass(/reveal-in/)
  await expect(page.locator('.generator-heading')).toHaveCSS(
    'animation-name',
    'content-arrive',
  )
  await expect(page.locator('main')).not.toContainText('Gemini')
  await expect(page.locator('footer')).not.toContainText('Made for')
  await page.getByLabel('Choose your company CSV').setInputFiles(healthtech)
  await expect(page.locator('.selection-slot')).toHaveClass(/is-open/)
  await expect(page.locator('.document-stack')).toHaveCSS(
    'animation-name',
    'file-land',
  )
  await expect(page.locator('.selection-slot')).toHaveCSS(
    'transition-duration',
    '0.38s, 0.28s',
  )
})
