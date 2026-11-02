import withNuxt from './.nuxt/eslint.config.mjs'
export default withNuxt({
  rules: {
    'vue/html-self-closing': [
      'warn',
      {
        html: { void: 'always', normal: 'always', component: 'always' },
        svg: 'always',
        math: 'always',
      },
    ],
  },
  ignores: [
    '.output-test/**',
    '.nuxt-test/**',
    '.nuxt-production/**',
    '.nuxt-showcase/**',
    '.output-showcase/**',
    'playwright-report/**',
    'test-results/**',
  ],
})
