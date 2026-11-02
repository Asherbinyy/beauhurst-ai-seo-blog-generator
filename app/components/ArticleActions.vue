<script setup lang="ts">
import type { Article } from '#shared/schemas/article'

const props = defineProps<{ article: Article }>()
const status = ref('')
const exporting = ref(false)
const shareUrl = ref('')
const linkInput = ref<HTMLInputElement | null>(null)

async function copyLink() {
  shareUrl.value = ''
  try {
    await navigator.clipboard.writeText(window.location.href)
    status.value =
      'Article link copied. It works wherever this server is accessible.'
  } catch {
    shareUrl.value = window.location.href
    status.value = 'Select and copy the link below.'
    await nextTick()
    linkInput.value?.focus()
    linkInput.value?.select()
  }
}
function printArticle() {
  status.value =
    'Choose Save as PDF in the print dialog. The complete ranking is included.'
  window.print()
}
async function saveImage() {
  if (exporting.value) return
  exporting.value = true
  status.value = ''
  let url: string | undefined
  try {
    const { createSummaryImage } = await import('~/utils/summary-image')
    url = URL.createObjectURL(await createSummaryImage(props.article))
    const link = document.createElement('a')
    link.href = url
    link.download = `fieldnotes-${props.article.slug.slice(0, 70)}.png`
    document.body.append(link)
    link.click()
    link.remove()
    status.value =
      'Summary image downloaded with the title, key figures and source.'
  } catch {
    status.value =
      'The image could not be saved. Please try again or use Save as PDF.'
  } finally {
    // Keep the object URL alive long enough for browsers to start the download.
    if (url) setTimeout(() => URL.revokeObjectURL(url!), 1000)
    exporting.value = false
  }
}
</script>

<template>
  <div class="article-tools">
    <div
      class="action-buttons"
      role="group"
      aria-label="Save and share article"
    >
      <button class="secondary-button" type="button" @click="copyLink">
        Copy link <span aria-hidden="true">↗</span>
      </button>
      <button class="secondary-button" type="button" @click="printArticle">
        Save as PDF <span aria-hidden="true">↓</span>
      </button>
      <button
        class="secondary-button"
        type="button"
        :disabled="exporting"
        @click="saveImage"
      >
        {{ exporting ? 'Preparing image…' : 'Save summary image' }}
        <span aria-hidden="true">↓</span>
      </button>
    </div>
    <p class="action-status" role="status">{{ status }}</p>
    <label v-if="shareUrl" class="share-fallback"
      >Article link<input ref="linkInput" :value="shareUrl" readonly
    /></label>
  </div>
</template>
