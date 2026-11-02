import { createServer, request as httpRequest, type Server } from 'node:http'
import { mkdtemp, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, createRouter, toNodeListener } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createArticleHandler,
  getArticleHandler,
} from '../../server/lib/article-handlers'
import { createArticleStore } from '../../server/lib/article-store'
import { createCopyGenerator } from '../helpers/fake-llm'
import { GenerationError } from '../../server/lib/errors'

let directory: string, origin: string, server: Server
const generateCopy = vi.fn(createCopyGenerator())
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'beauhurst-api-'))
  generateCopy.mockReset().mockImplementation(createCopyGenerator())
  const store = createArticleStore(directory)
  const router = createRouter()
    .post('/api/articles', createArticleHandler({ store, generateCopy }))
    .get('/api/articles/:slug', getArticleHandler(store))
  server = createServer(toNodeListener(createApp().use(router)))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('No test server address')
  origin = `http://127.0.0.1:${address.port}`
})
afterEach(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
  await rm(directory, { recursive: true, force: true })
})
function upload(
  content = 'Company,Total Raised\nCare,100',
  filename = 'healthtech.csv',
) {
  const form = new FormData()
  form.set('file', new File([content], filename, { type: 'text/csv' }))
  return fetch(`${origin}/api/articles`, { method: 'POST', body: form })
}

describe('real multipart HTTP boundary', () => {
  it('creates and retrieves an article with the real handlers and store', async () => {
    const response = await upload()
    expect(response.status).toBe(201)
    const { slug, url } = await response.json()
    expect(url).toBe(`/blog/${slug}`)
    const retrieved = await fetch(`${origin}/api/articles/${slug}`)
    expect(retrieved.status).toBe(200)
    const article = await retrieved.json()
    expect(article.companies[0].company).toBe('Care')
    expect(article.analytics.totalRaisedPence).toBe(10000)
  })
  it.each([
    ['bad', 'a.csv'],
    ['Company,Total Raised\nA,$1', 'a.csv'],
    ['Company,Total Raised\nA,1', 'a.txt'],
  ])(
    'rejects invalid upload without calling LLM',
    async (content, filename) => {
      expect((await upload(content, filename)).status).toBe(400)
      expect(generateCopy).not.toHaveBeenCalled()
      expect(await readdir(directory)).toEqual([])
    },
  )
  it('rejects malformed/duplicate multipart fields and invalid UTF-8', async () => {
    const form = new FormData()
    form.append('file', new File(['A'], 'a.csv'))
    form.append('file', new File(['B'], 'b.csv'))
    expect(
      (await fetch(`${origin}/api/articles`, { method: 'POST', body: form }))
        .status,
    ).toBe(400)
    const invalid = new FormData()
    invalid.set('file', new File([Uint8Array.from([0xff, 0xfe])], 'a.csv'))
    expect(
      (await fetch(`${origin}/api/articles`, { method: 'POST', body: invalid }))
        .status,
    ).toBe(400)
    expect(generateCopy).not.toHaveBeenCalled()
  })
  it('rejects unsupported requests and oversized files', async () => {
    expect(
      (
        await fetch(`${origin}/api/articles`, {
          method: 'POST',
          body: '{}',
          headers: { 'Content-Type': 'application/json' },
        })
      ).status,
    ).toBe(415)
    expect((await upload('x'.repeat(1024 * 1024 + 1))).status).toBe(413)
    expect((await upload('x'.repeat(2 * 1024 * 1024))).status).toBe(413)
    expect(generateCopy).not.toHaveBeenCalled()
  })

  it('bounds chunked multipart requests without a Content-Length header', async () => {
    const status = await new Promise<number>((resolve, reject) => {
      const request = httpRequest(
        `${origin}/api/articles`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'multipart/form-data; boundary=bounded-test',
            'Transfer-Encoding': 'chunked',
          },
        },
        (response) => {
          response.resume()
          response.on('end', () => resolve(response.statusCode ?? 0))
        },
      )
      request.on('error', reject)
      for (let i = 0; i < 18; i++) request.write(Buffer.alloc(65536, 'x'))
      request.end()
    })
    expect(status).toBe(413)
    expect(generateCopy).not.toHaveBeenCalled()
    expect(await readdir(directory)).toEqual([])
  })

  it('returns a safe provider failure and saves nothing', async () => {
    generateCopy.mockRejectedValueOnce(
      new GenerationError(
        'The writing service has reached its free-tier quota.',
        503,
      ),
    )
    const response = await upload()
    expect(response.status).toBe(503)
    expect((await response.json()).data.message).toContain('quota')
    expect(await readdir(directory)).toEqual([])
  })
  it('returns a real 404 for an unknown article', async () => {
    expect((await fetch(`${origin}/api/articles/not-a-slug`)).status).toBe(404)
  })
})
