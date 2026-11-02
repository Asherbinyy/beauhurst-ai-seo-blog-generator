import { createCopyGenerator } from '#copy-generator'
import { createArticleHandler } from '../../lib/article-handlers'
import { createArticleStore } from '../../lib/article-store'
export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  if (config.public.showcase)
    throw createError({
      statusCode: 405,
      statusMessage: 'Generation is available in the local toolbox.',
    })
  return createArticleHandler({
    store: createArticleStore(config.articleDataDir),
    generateCopy: createCopyGenerator({
      apiKey: config.geminiApiKey,
      model: config.geminiModel,
    }),
  })(event)
})
