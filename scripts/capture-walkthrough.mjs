import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { setTimeout } from 'node:timers/promises'
import { spawnSync } from 'node:child_process'
import { expect } from '@playwright/test'

export async function captureWalkthrough(browser, origin) {
  const directory = resolve('docs/media')
  await mkdir(directory, { recursive: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    recordVideo: {
      dir: resolve('.data/media-capture'),
      size: { width: 1440, height: 1000 },
    },
  })
  await context.addInitScript(() => {
    addEventListener('pointermove', (event) => {
      let cursor = document.getElementById('capture-pointer')
      if (!cursor) {
        cursor = document.createElement('div')
        cursor.id = 'capture-pointer'
        cursor.style.cssText =
          'position:fixed;z-index:9999;pointer-events:none;width:16px;height:16px;border:2px solid #53645e;background:#ddedb7;border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 1px 6px #0002'
        document.body.append(cursor)
      }
      cursor.style.left = `${event.clientX}px`
      cursor.style.top = `${event.clientY}px`
      const file = document.getElementById('capture-file')
      if (file) {
        file.style.left = `${event.clientX + 18}px`
        file.style.top = `${event.clientY + 18}px`
      }
    })
  })
  const page = await context.newPage()
  const video = page.video()
  const started = Date.now()
  const steps = []
  async function step(text) {
    steps.push({ at: (Date.now() - started) / 1000, text })
    await page.evaluate((text) => {
      let label = document.getElementById('capture-step')
      if (!label) {
        label = document.createElement('div')
        label.id = 'capture-step'
        label.style.cssText =
          'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9998;background:#19342e;color:#fffefa;border:1px solid #53645e;border-radius:40px;padding:15px 26px;font:500 15px -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 6px 24px #0002;pointer-events:none'
        document.body.append(label)
      }
      label.textContent = text
    }, text)
  }
  await page.goto(origin)
  await step('01 / Drag a CSV into the research desk')
  await page.mouse.move(1090, 350)
  await setTimeout(900)
  const csv = await readFile(
    'task-requirements/fintech_companies_seed.csv',
    'utf8',
  )
  const transfer = await page.evaluateHandle((csv) => {
    const data = new DataTransfer()
    data.items.add(new File([csv], 'company-data.csv', { type: 'text/csv' }))
    return data
  }, csv)
  const zone = page.locator('.file-picker')
  const bounds = await zone.boundingBox()
  await page.evaluate(() => {
    const file = document.createElement('div')
    file.id = 'capture-file'
    file.textContent = 'company-data.csv'
    file.style.cssText =
      'position:fixed;z-index:10000;pointer-events:none;background:#fffefa;color:#19342e;border:1px solid #9ba99c;border-radius:7px;padding:12px 18px;font:13px sans-serif;box-shadow:0 6px 20px #0002'
    document.body.append(file)
  })
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
    { steps: 35 },
  )
  await zone.dispatchEvent('dragenter', { dataTransfer: transfer })
  await setTimeout(750)
  await zone.dispatchEvent('dragleave', { dataTransfer: transfer })
  await page.mouse.move(bounds.x + bounds.width + 35, bounds.y + 10, {
    steps: 20,
  })
  await setTimeout(450)
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
    { steps: 25 },
  )
  await zone.dispatchEvent('dragenter', { dataTransfer: transfer })
  await setTimeout(600)
  await zone.dispatchEvent('drop', { dataTransfer: transfer })
  await page.evaluate(() => document.getElementById('capture-file')?.remove())
  await setTimeout(1000)
  await page.route(
    '**/api/articles',
    async (route) => {
      await setTimeout(1800)
      await route.continue()
    },
    { times: 1 },
  )
  await step('02 / Generate the article')
  const generate = page.getByRole('button', { name: 'Generate article' })
  await generate.hover()
  await generate.click()
  await page.waitForURL('**/blog/**')
  await step('03 / Review the article and calculated figures')
  await page.mouse.move(1330, 220, { steps: 20 })
  await setTimeout(2200)
  await step('04 / Sort, search and export the company ranking')
  await page.evaluate(() =>
    document
      .getElementById('ranking-title')
      .scrollIntoView({ behavior: 'smooth', block: 'start' }),
  )
  await setTimeout(1000)
  const company = page.getByRole('button', { name: 'Company', exact: true })
  await company.click()
  await setTimeout(850)
  await company.click()
  await setTimeout(850)
  await page
    .getByLabel('Find a company')
    .pressSequentially('Nevis', { delay: 120 })
  await setTimeout(850)
  const csvDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download CSV' }).click()
  await csvDownload
  await setTimeout(700)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await setTimeout(850)
  await step('05 / Save a shareable image of the key figures')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save summary image' }).click()
  const image = await download
  const imagePath = resolve('.data/media-capture/exported-summary.png')
  await image.saveAs(imagePath)
  await setTimeout(900)
  await page.goto(pathToFileURL(imagePath).href)
  await step('Saved / A source-labelled brief, ready to share')
  await page.evaluate(() => {
    document.body.style.cssText =
      'margin:0;background:#e8ede3;display:grid;place-items:center;min-height:100vh'
    document.querySelector('img').style.cssText =
      'width:auto;max-width:95vw;max-height:88vh;object-fit:contain;box-shadow:0 12px 45px #0002'
  })
  await setTimeout(2000)
  const end = (Date.now() - started) / 1000
  await context.close()
  const recorded = await video.path()
  function ffmpeg(args) {
    const result = spawnSync(
      'ffmpeg',
      ['-hide_banner', '-loglevel', 'error', '-y', ...args],
      { stdio: 'inherit' },
    )
    if (result.status !== 0)
      throw new Error('Install ffmpeg to refresh the walkthrough media.')
  }
  ffmpeg([
    '-i',
    recorded,
    '-an',
    '-c:v',
    'libx264',
    '-crf',
    '24',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    resolve(directory, 'walkthrough.mp4'),
  ])
  ffmpeg([
    '-i',
    recorded,
    '-filter_complex',
    'fps=8,scale=800:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96:stats_mode=diff[p];[s1][p]paletteuse=dither=none:diff_mode=rectangle',
    '-loop',
    '0',
    resolve(directory, 'walkthrough.gif'),
  ])
  ffmpeg([
    '-ss',
    '0.8',
    '-i',
    recorded,
    '-frames:v',
    '1',
    '-q:v',
    '3',
    resolve(directory, 'walkthrough-poster.jpg'),
  ])
  function timestamp(seconds) {
    return new Date(seconds * 1000).toISOString().slice(11, 23)
  }
  await writeFile(
    resolve(directory, 'walkthrough.vtt'),
    'WEBVTT\n\n' +
      steps
        .map(
          (step, index) =>
            `${timestamp(step.at)} --> ${timestamp(steps[index + 1]?.at ?? end)}\n${step.text}\n`,
        )
        .join('\n'),
  )
  await expect
    .poll(async () =>
      readFile(resolve(directory, 'walkthrough.mp4')).then(
        (buffer) => buffer.length,
      ),
    )
    .toBeGreaterThan(10000)
}
