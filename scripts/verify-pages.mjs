import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve('.output-showcase/public')
const base = '/beauhurst-ai-seo-blog-generator/'
const slug = 'company-funding-report-00000000-0000-4000-8000-000000000001'
const home = await readFile(resolve(root, 'index.html'), 'utf8')
const article = await readFile(
  resolve(root, 'blog', slug, 'index.html'),
  'utf8',
)
assert(home.includes('Open the report'), 'Demo entry point is missing')
assert(
  !home.includes('id="company-csv"'),
  'The hosted demo must not offer private uploads',
)
const body = article.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)?.[1] ?? ''
assert.equal(
  body.match(/<tr[ >]/g)?.length,
  100,
  'All source records must be prerendered',
)
assert(
  article.includes(`https://sherbini.uk${base}blog/${slug}`),
  'Canonical URL must include the repository base path',
)
assert(
  !/AIza[\w-]{30,}/.test(home + article),
  'Credential-shaped content found in static HTML',
)
for (const html of [home, article]) {
  for (const [, value] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (!value.startsWith(base)) continue
    const relative = value.slice(base.length).split(/[?#]/)[0]
    const file = resolve(root, relative)
    const info = await stat(file)
    if (info.isDirectory()) await stat(resolve(file, 'index.html'))
  }
}
for (const file of [
  'media/walkthrough.mp4',
  'media/walkthrough.gif',
  'media/walkthrough.vtt',
  'favicon.svg',
])
  assert((await stat(resolve(root, file))).size > 0)
console.log(
  'Pages artifact verified: prerendered report, repository paths, media and upload boundary.',
)
