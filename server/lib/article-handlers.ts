import {
  createError,
  defineEventHandler,
  getHeader,
  getRouterParam,
  setResponseStatus,
  type H3Event,
} from 'h3'
import { MAX_FILE_BYTES } from '../../shared/schemas/article'
import type { ArticleStore } from './article-store'
import type { CopyGenerator } from './copy'
import { generateArticle } from './generate-article'
import { GenerationError, InputError } from './errors'

function publicError(statusCode: number, message: string) {
  return createError({
    statusCode,
    statusMessage: 'Article request failed',
    data: { message },
  })
}

async function readCsvUpload(
  event: H3Event,
): Promise<{ csv: string; filename: string }> {
  const contentType = getHeader(event, 'content-type') ?? ''
  if (!/^multipart\/form-data;.*boundary=/i.test(contentType))
    throw publicError(415, 'Choose a CSV file using the upload form.')
  const limit = MAX_FILE_BYTES + 16 * 1024
  const length = Number(getHeader(event, 'content-length'))
  if (Number.isFinite(length) && length > limit)
    throw publicError(413, 'The CSV must be no larger than 1 MiB.')
  const chunks: Buffer[] = []
  let size = 0
  // Bound memory even for chunked requests without Content-Length.
  for await (const part of event.node.req.iterator({
    destroyOnReturn: false,
  })) {
    const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part)
    size += chunk.length
    if (size > limit) {
      event.node.req.resume()
      throw publicError(413, 'The CSV must be no larger than 1 MiB.')
    }
    chunks.push(chunk)
  }
  let form: FormData
  try {
    form = await new Response(Buffer.concat(chunks), {
      headers: { 'Content-Type': contentType },
    }).formData()
  } catch {
    throw new InputError('The upload could not be read. Select the CSV again.')
  }
  const files = form.getAll('file')
  if (
    files.length !== 1 ||
    !(files[0] instanceof File) ||
    [...form.keys()].some((key) => key !== 'file')
  )
    throw new InputError('Upload exactly one CSV file.')
  const file = files[0]
  if (!/\.csv$/i.test(file.name))
    throw new InputError('Choose a file ending in .csv.')
  if (file.size > MAX_FILE_BYTES)
    throw publicError(413, 'The CSV must be no larger than 1 MiB.')
  let csv: string
  try {
    csv = new TextDecoder('utf-8', { fatal: true }).decode(
      await file.arrayBuffer(),
    )
  } catch {
    throw new InputError('Save the CSV with UTF-8 encoding and try again.')
  }
  return { csv, filename: file.name }
}

export function createArticleHandler(dependencies: {
  store: ArticleStore
  generateCopy: CopyGenerator
}) {
  return defineEventHandler(async (event) => {
    try {
      const { csv, filename } = await readCsvUpload(event)
      const article = await generateArticle(csv, filename, dependencies)
      setResponseStatus(event, 201)
      return { slug: article.slug, url: `/blog/${article.slug}` }
    } catch (error) {
      if (error instanceof InputError) throw publicError(400, error.message)
      if (error instanceof GenerationError)
        throw publicError(error.statusCode, error.message)
      if (
        error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        [413, 415].includes(Number(error.statusCode))
      )
        throw error
      throw publicError(
        500,
        'The article could not be saved. Please check server storage and try again.',
      )
    }
  })
}

export function getArticleHandler(store: ArticleStore) {
  return defineEventHandler(async (event) => {
    let article
    try {
      article = await store.get(getRouterParam(event, 'slug') ?? '')
    } catch {
      throw publicError(500, 'This saved article could not be read.')
    }
    if (!article) throw publicError(404, 'Article not found.')
    return article
  })
}
