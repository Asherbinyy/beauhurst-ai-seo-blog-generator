import { mkdir, writeFile, readFile, link, unlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  articleSchema,
  slugSchema,
  type Article,
} from '../../shared/schemas/article'

export interface ArticleStore {
  save(article: Article): Promise<void>
  get(slug: string): Promise<Article | null>
}
export function createArticleStore(directory: string): ArticleStore {
  const root = resolve(directory)
  return {
    async save(value) {
      const article = articleSchema.parse(value)
      await mkdir(root, { recursive: true, mode: 0o700 })
      const temporary = join(root, `.${randomUUID()}.tmp`)
      try {
        await writeFile(temporary, JSON.stringify(article), {
          encoding: 'utf8',
          flag: 'wx',
          mode: 0o600,
        })
        // Publish the complete file atomically, without replacing an existing article.
        await link(temporary, join(root, `${article.slug}.json`))
      } finally {
        await unlink(temporary).catch((error) => {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        })
      }
    },
    async get(slug) {
      if (!slugSchema.safeParse(slug).success) return null
      try {
        const article = articleSchema.parse(
          JSON.parse(await readFile(join(root, `${slug}.json`), 'utf8')),
        )
        if (article.slug !== slug)
          throw new Error('Stored article slug mismatch')
        return article
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
        throw error
      }
    },
  }
}
