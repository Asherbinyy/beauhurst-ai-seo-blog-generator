import { randomUUID } from 'node:crypto'
import { articleSchema, type Article } from '../../shared/schemas/article'
import { parseCompanies } from './parse-companies'
import { analyseCompanies } from './analyse-companies'
import { buildCopyContext, resolveCopy, type CopyGenerator } from './copy'
import type { ArticleStore } from './article-store'

export function safeFilename(filename: string): string {
  return (
    (filename.split(/[\\/]/).at(-1) ?? 'dataset.csv')
      .replace(/\p{Cc}/gu, '')
      .slice(0, 200) || 'dataset.csv'
  )
}

export async function generateArticle(
  csv: string,
  filename: string,
  dependencies: { generateCopy: CopyGenerator; store: ArticleStore },
): Promise<Article> {
  const dataset = parseCompanies(csv)
  const analytics = analyseCompanies(dataset.companies)
  const sourceFilename = safeFilename(filename)
  const context = buildCopyContext(dataset, analytics, sourceFilename)
  const copy = resolveCopy(
    await dependencies.generateCopy(context),
    context.facts,
  )
  const id = randomUUID()
  const prefix =
    copy.title
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 70)
      .replace(/-$/, '') || 'company-ranking'
  const article = articleSchema.parse({
    schemaVersion: 1,
    id,
    slug: `${prefix}-${id}`,
    createdAt: new Date().toISOString(),
    sourceFilename,
    rankingSource: dataset.rankingSource,
    importNotes: dataset.importNotes,
    companies: dataset.companies,
    analytics,
    copy,
  })
  await dependencies.store.save(article)
  return article
}
