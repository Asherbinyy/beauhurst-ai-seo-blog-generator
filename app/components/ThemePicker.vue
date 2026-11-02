<script setup lang="ts">
type Theme = 'system' | 'light' | 'dark'
const preference = useCookie<string>('fieldnotes-theme', {
  default: () => 'system',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
  path: '/',
})
const theme = computed<Theme>(() =>
  preference.value === 'light' || preference.value === 'dark'
    ? preference.value
    : 'system',
)
useHead(() => ({ htmlAttrs: { 'data-theme': theme.value } }))
const options: { value: Theme; label: string; path: string }[] = [
  {
    value: 'light',
    label: 'Light',
    path: 'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  },
  { value: 'system', label: 'System', path: 'M4 4h16v12H4zM8 20h8m-4-4v4' },
  {
    value: 'dark',
    label: 'Dark',
    path: 'M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10Z',
  },
]
function selectTheme(value: Theme) {
  preference.value = value
}
</script>

<template>
  <div class="theme-picker" role="group" aria-label="Colour theme">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :aria-label="`${option.label} theme`"
      :title="`${option.label} theme`"
      :aria-pressed="theme === option.value"
      @click="selectTheme(option.value)"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path :d="option.path" />
      </svg>
    </button>
  </div>
</template>
