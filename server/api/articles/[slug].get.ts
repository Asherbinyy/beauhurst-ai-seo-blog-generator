import { getArticleHandler } from '../../lib/article-handlers'
import { createArticleStore } from '../../lib/article-store'
import { resolve } from 'node:path'
export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  // Public prerendering reads only the explicit example, never private saved uploads.
  const directory = config.public.showcase
    ? resolve('showcase')
    : config.articleDataDir
  return getArticleHandler(createArticleStore(directory))(event)
})
