import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCopyGenerator } from '../../server/lib/gemini'
import { createCopyGenerator as fake } from '../helpers/fake-llm'
import { buildCopyContext } from '../../server/lib/copy'
import { parseCompanies } from '../../server/lib/parse-companies'
import { analyseCompanies } from '../../server/lib/analyse-companies'

// Exercise the installed SDK, including its wire format and error classes.
// Only the HTTP transport is replaced; no test can contact Google.
const transport = vi.fn<typeof fetch>()
const dataset = parseCompanies('Company,Total Raised\nExample,123')
const context = buildCopyContext(
  dataset,
  analyseCompanies(dataset.companies),
  'example.csv',
)
const generate = () =>
  createCopyGenerator({ apiKey: 'test-secret', model: 'gemini-3.8-flash' })(
    context,
  )
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
function completed(text: string) {
  return {
    id: 'test-interaction',
    model: 'gemini-3.8-flash',
    status: 'completed',
    steps: [{ type: 'model_output', content: [{ type: 'text', text }] }],
  }
}
beforeEach(() => {
  transport.mockReset()
  vi.stubGlobal('fetch', transport)
})
afterEach(() => vi.unstubAllGlobals())

describe('official Gemini SDK over a fake HTTP transport', () => {
  it('sends structured JSON and consumes the real SDK response envelope', async () => {
    const copy = await fake()(context)
    transport.mockResolvedValue(response(completed(JSON.stringify(copy))))
    expect(await generate()).toEqual(copy)
    expect(transport).toHaveBeenCalledTimes(1)
    const [input, init] = transport.mock.calls[0]!
    const request = input instanceof Request ? input : new Request(input, init)
    expect(request.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/interactions',
    )
    expect(request.headers.get('x-goog-api-key')).toBe('test-secret')
    const body = await request.json()
    expect(body.model).toBe('gemini-3.8-flash')
    expect(body.response_format).toMatchObject({
      type: 'text',
      mime_type: 'application/json',
      schema: { type: 'object' },
    })
    expect(body.store).toBe(false)
    expect(body.generation_config.max_output_tokens).toBe(2400)
    expect(body.input).not.toContain('test-secret')
  })
  it('requires server configuration without making a request', async () => {
    await expect(
      createCopyGenerator({ apiKey: '', model: 'm' })(context),
    ).rejects.toMatchObject({ statusCode: 503 })
    expect(transport).not.toHaveBeenCalled()
  })
  it.each([
    [completed('not JSON'), 'unreadable article'],
    [completed('{}'), 'invalid article'],
    [{ status: 'failed', steps: [] }, 'complete article'],
    [{ status: 'requires_continuation', steps: [] }, 'complete article'],
  ])(
    'rejects invalid/incomplete output without retrying',
    async (body, message) => {
      transport.mockResolvedValue(response(body))
      await expect(generate()).rejects.toThrow(message as string)
      expect(transport).toHaveBeenCalledTimes(1)
    },
  )
  it.each([
    [400, 'invalid_argument', 502, 'rejected'],
    [401, 'authentication', 503, 'denied access'],
    [402, 'payment_required', 503, 'free-tier access'],
    [403, 'permission_denied', 503, 'project permissions'],
    [404, 'not_found', 503, 'NUXT_GEMINI_MODEL'],
    [429, 'resource_exhausted', 503, 'quota'],
    [500, 'internal', 503, 'temporarily busy'],
    [503, 'unavailable', 503, 'temporarily busy'],
    [504, 'deadline_exceeded', 504, 'too long'],
  ])(
    'explains HTTP %i safely and makes only one attempt',
    async (status, code, statusCode, message) => {
      transport.mockImplementation(async () =>
        response({ error: { code, message: 'private secret' } }, status),
      )
      const error = await generate().catch((error: unknown) => error)
      expect(error).toMatchObject({
        statusCode,
        message: expect.stringContaining(message),
      })
      expect(String(error)).not.toContain('private secret')
      expect(transport).toHaveBeenCalledTimes(1)
    },
  )
  it('bounds a hanging request and explains timeouts', async () => {
    vi.useFakeTimers()
    // Node's native AbortSignal timer is outside Vitest's fake clock.
    const deadline = vi
      .spyOn(AbortSignal, 'timeout')
      .mockImplementation((ms) => {
        const controller = new AbortController()
        setTimeout(
          () => controller.abort(new DOMException('Timed out', 'TimeoutError')),
          ms,
        )
        return controller.signal
      })
    transport.mockImplementation(
      (input, init) =>
        new Promise((_resolve, reject) => {
          const signal = input instanceof Request ? input.signal : init?.signal
          signal?.addEventListener(
            'abort',
            () => reject(new DOMException('private secret', 'AbortError')),
            { once: true },
          )
        }),
    )
    try {
      const assertion = expect(generate()).rejects.toMatchObject({
        statusCode: 504,
      })
      await vi.advanceTimersByTimeAsync(45001)
      await assertion
      expect(transport).toHaveBeenCalledTimes(1)
      expect(deadline).toHaveBeenCalledWith(45000)
    } finally {
      vi.useRealTimers()
    }
  })
  it('sanitises network errors', async () => {
    transport.mockRejectedValue(new Error('private secret'))
    const error = await generate().catch((error: unknown) => error)
    expect(error).toMatchObject({
      statusCode: 502,
      message: expect.stringContaining('connect to Gemini'),
    })
    expect(String(error)).not.toContain('private secret')
    expect(transport).toHaveBeenCalledTimes(1)
  })
})
