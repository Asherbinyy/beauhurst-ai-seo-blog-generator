import { fileURLToPath } from 'node:url'
import { DEMO_ARTICLE_SLUG } from './shared/constants'

// Test doubles are selected at build time, never by a browser request.
const testing = process.env.NUXT_TEST_MODE === '1'
const showcase = process.env.NUXT_SHOWCASE === '1'
const baseURL = showcase ? '/beauhurst-ai-seo-blog-generator/' : '/'
export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  debug: false,
  devtools: { enabled: false },
  modules: ['@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  typescript: { strict: true },
  buildDir: testing ? '.nuxt-test' : '.nuxt',
  $production: {
    buildDir: showcase
      ? '.nuxt-showcase'
      : testing
        ? '.nuxt-test'
        : '.nuxt-production',
  },
  alias: {
    '#copy-generator': fileURLToPath(
      new URL(
        testing ? './tests/helpers/fake-llm.ts' : './server/lib/gemini.ts',
        import.meta.url,
      ),
    ),
  },
  nitro: {
    preset: showcase ? 'static' : 'node-server',
    esbuild: { options: { target: 'es2022' } },
    output: {
      dir: showcase ? '.output-showcase' : testing ? '.output-test' : '.output',
    },
    publicAssets: [
      {
        dir: fileURLToPath(new URL('./docs/media', import.meta.url)),
        baseURL: '/media',
      },
    ],
    prerender: {
      crawlLinks: false,
      routes: showcase ? ['/', `/blog/${DEMO_ARTICLE_SLUG}`] : [],
    },
  },
  runtimeConfig: {
    geminiApiKey: '',
    geminiModel: 'gemini-3.8-flash',
    articleDataDir: showcase
      ? fileURLToPath(new URL('./showcase', import.meta.url))
      : '.data/articles',
    public: {
      siteUrl: showcase ? 'https://sherbini.uk' : '',
      showcase,
    },
  },
  app: {
    baseURL,
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      htmlAttrs: { lang: 'en-GB' },
      link: [
        { rel: 'icon', href: `${baseURL}favicon.svg`, type: 'image/svg+xml' },
      ],
    },
  },
})
