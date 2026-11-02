import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateArticle } from '../../server/lib/generate-article'
import { createArticleStore } from '../../server/lib/article-store'
import { createCopyGenerator } from '../helpers/fake-llm'
import { buildCopyContext, resolveCopy } from '../../server/lib/copy'
import { parseCompanies } from '../../server/lib/parse-companies'
import { analyseCompanies } from '../../server/lib/analyse-companies'

let directory: string
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'beauhurst-test-'))
})
afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})
const csv =
  'Company,Total Raised,Industries\nCare,1500000,Health technology\nPulse,3000000,Medical devices'

describe('complete generation and persistence', () => {
  it('persists a validated article, resolves facts and reloads with a fresh store', async () => {
    const article = await generateArticle(csv, '../../healthtech.csv', {
      generateCopy: createCopyGenerator(),
      store: createArticleStore(directory),
    })
    expect(article.copy.title).toContain('Healthtech')
    expect(article.copy.introduction).toContain('£4,500,000')
    expect(JSON.stringify(article.copy)).not.toContain('{{')
    expect(article.sourceFilename).toBe('healthtech.csv')
    expect(article.companies.map((c) => c.company)).toEqual(['Pulse', 'Care'])
    expect(await createArticleStore(directory).get(article.slug)).toEqual(
      article,
    )
    expect(await readdir(directory)).toEqual([`${article.slug}.json`])
    expect(
      await createArticleStore(directory).get('../../etc/passwd'),
    ).toBeNull()
    expect(
      await createArticleStore(directory).get(`missing-${article.id}`),
    ).toBeNull()
  })
  it('does not overwrite an existing article or leave temporary files', async () => {
    const store = createArticleStore(directory)
    const article = await generateArticle(csv, 'a.csv', {
      generateCopy: createCopyGenerator(),
      store,
    })
    await expect(store.save(article)).rejects.toThrow()
    expect(await readdir(directory)).toHaveLength(1)
    expect(await store.get(article.slug)).toEqual(article)
  })
  it('rejects corrupted stored data', async () => {
    const store = createArticleStore(directory)
    const article = await generateArticle(csv, 'a.csv', {
      generateCopy: createCopyGenerator(),
      store,
    })
    await writeFile(join(directory, `${article.slug}.json`), '{}')
    await expect(store.get(article.slug)).rejects.toThrow()
  })
  it.each(['failure', 'schema', 'numbers', 'unknown-fact', 'markup'])(
    'does not save when generation fails: %s',
    async (kind) => {
      const good = await createCopyGenerator()(
        buildCopyContext(
          parseCompanies(csv),
          analyseCompanies(parseCompanies(csv).companies),
          'a.csv',
        ),
      )
      const generateCopy = vi.fn(async () => {
        if (kind === 'failure') throw new Error('Provider down')
        if (kind === 'schema') return { title: 'Missing fields' }
        const value = good as Record<string, unknown>
        return {
          ...value,
          introduction:
            kind === 'numbers'
              ? 'These companies raised £9999999999 across the entire national market.'
              : kind === 'unknown-fact'
                ? 'The dataset has {{imaginary}} companies working in medical technology.'
                : '<script>alert(1)</script> This content should never be accepted as article copy.',
        }
      })
      await expect(
        generateArticle(csv, 'a.csv', {
          generateCopy,
          store: createArticleStore(directory),
        }),
      ).rejects.toThrow()
      expect(await readdir(directory)).toEqual([])
    },
  )
  it('validates CSV before calling the provider', async () => {
    const generateCopy = vi.fn()
    await expect(
      generateArticle('bad', 'a.csv', {
        generateCopy,
        store: createArticleStore(directory),
      }),
    ).rejects.toThrow()
    expect(generateCopy).not.toHaveBeenCalled()
  })
  it('generates the original complete dataset through the same pipeline', async () => {
    const source = await readFile(
      new URL(
        '../../task-requirements/fintech_companies_seed.csv',
        import.meta.url,
      ),
      'utf8',
    )
    const article = await generateArticle(source, 'fintech.csv', {
      generateCopy: createCopyGenerator(),
      store: createArticleStore(directory),
    })
    expect(article.companies).toHaveLength(100)
    expect(article.analytics.totalRaisedPence).toBe(62230127000)
  })
})

it('bounds contextual data and rejects malformed/unavailable fact references', async () => {
  const dataset = parseCompanies(csv)
  const context = buildCopyContext(
    dataset,
    analyseCompanies(dataset.companies),
    'a.csv',
  )
  expect(context.companies.length).toBeLessThanOrEqual(20)
  expect(context.facts).not.toHaveProperty('leadingRegion')
  const good = (await createCopyGenerator()(context)) as Record<string, unknown>
  expect(() =>
    resolveCopy(
      { ...good, title: 'Companies in {{leadingRegion}}' },
      context.facts,
    ),
  ).toThrow(/unavailable/)
  expect(() =>
    resolveCopy(
      { ...good, title: 'Companies worth five million pounds' },
      context.facts,
    ),
  ).toThrow(/unsupported/)
})
