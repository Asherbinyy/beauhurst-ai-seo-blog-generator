<script setup lang="ts">
import { MAX_FILE_BYTES } from '#shared/constants'

const selectedFile = ref<File | null>(null)
const pending = ref(false)
const errorMessage = ref('')
const errorBox = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const dragDepth = ref(0)
const selectionVersion = ref(0)
const isDragging = computed(() => dragDepth.value > 0 && !pending.value)
const fileSize = computed(() =>
  selectedFile.value
    ? `${Math.max(1, Math.ceil(selectedFile.value.size / 1024))} KB`
    : '',
)
async function showError(message: string) {
  errorMessage.value = message
  await nextTick()
  errorBox.value?.focus()
}
function acceptFiles(files: File[]) {
  if (pending.value) return
  errorMessage.value = ''
  if (!files.length) return
  selectedFile.value = null
  if (files.length !== 1) {
    void showError('Choose one CSV at a time.')
    return
  }
  const file = files[0]!
  if (!/\.csv$/i.test(file.name)) {
    void showError('Choose a file ending in .csv.')
    return
  }
  if (file.size > MAX_FILE_BYTES) {
    void showError('Choose a CSV no larger than 1 MiB.')
    return
  }
  if (file.size === 0) {
    void showError(
      'This file is empty. Choose a CSV containing company records.',
    )
    return
  }
  selectedFile.value = file
  selectionVersion.value++
}
function selectFile(event: Event) {
  const input = event.target as HTMLInputElement
  acceptFiles(Array.from(input.files ?? []))
  // Let the same file be picked again after a validation error.
  input.value = ''
}
function dragEnter(event: DragEvent) {
  if (!pending.value && event.dataTransfer?.types.includes('Files'))
    dragDepth.value++
}
function dragOver(event: DragEvent) {
  if (event.dataTransfer)
    event.dataTransfer.dropEffect = pending.value ? 'none' : 'copy'
}
function dropFile(event: DragEvent) {
  dragDepth.value = 0
  acceptFiles(Array.from(event.dataTransfer?.files ?? []))
}
function removeFile() {
  selectedFile.value = null
  errorMessage.value = ''
  if (fileInput.value) {
    fileInput.value.value = ''
    fileInput.value.focus()
  }
}
async function generate() {
  if (!selectedFile.value || pending.value) return
  pending.value = true
  errorMessage.value = ''
  try {
    const body = new FormData()
    body.set('file', selectedFile.value)
    const result = await $fetch<{ url: string }>('/api/articles', {
      method: 'POST',
      body,
      timeout: 60000,
      retry: 0,
    })
    await navigateTo(result.url)
  } catch (error: unknown) {
    const failure = error as {
      data?: {
        data?: { message?: string }
        message?: string
        statusMessage?: string
      }
    }
    await showError(
      failure.data?.data?.message ||
        failure.data?.message ||
        failure.data?.statusMessage ||
        'The article could not be generated. Check your connection and try again.',
    )
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <form class="upload-panel" :aria-busy="pending" @submit.prevent="generate">
    <div class="panel-heading">
      <span class="eyebrow">NEW ARTICLE</span
      ><span class="file-badge">CSV</span>
    </div>
    <h2>Upload your dataset</h2>

    <div
      class="file-picker"
      :class="{
        'has-file': selectedFile,
        'is-dragging': isDragging,
        'is-pending': pending,
      }"
      @dragenter.prevent="dragEnter"
      @dragover.prevent="dragOver"
      @dragleave.prevent="dragDepth = Math.max(0, dragDepth - 1)"
      @drop.prevent="dropFile"
    >
      <div :key="selectionVersion" class="document-stack" aria-hidden="true">
        <span class="document-shadow" />
        <svg
          class="document-icon"
          viewBox="0 0 48 56"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M9 2h21l12 12v40H9z"
            stroke="currentColor"
            stroke-width="1.5"
          />
          <path
            d="M30 2v13h12M17 25h17M17 33h17M17 41h10"
            stroke="currentColor"
            stroke-width="1.5"
          />
        </svg>
        <span v-if="selectedFile" class="file-check">✓</span>
      </div>
      <p class="drop-title">
        {{
          isDragging
            ? 'Release to add your dataset'
            : selectedFile
              ? 'Your dataset is ready.'
              : 'Drop your dataset here'
        }}
      </p>
      <label for="company-csv">{{
        selectedFile ? 'Choose a different CSV' : 'Choose your company CSV'
      }}</label>
      <input
        id="company-csv"
        ref="fileInput"
        name="file"
        type="file"
        accept=".csv,text/csv"
        :disabled="pending"
        :aria-describedby="
          errorMessage ? 'file-guidance upload-error' : 'file-guidance'
        "
        :aria-invalid="Boolean(errorMessage)"
        @change="selectFile"
      />
      <p id="file-guidance">CSV format · Up to 1 MiB · Up to 1,000 companies</p>
    </div>
    <div
      class="selection-slot"
      :class="{ 'is-open': selectedFile }"
      :inert="!selectedFile"
      :aria-hidden="!selectedFile"
    >
      <div class="selection-inner">
        <div class="selected-file">
          <div>
            <span class="selected-label">SELECTED FILE</span
            ><strong>{{ selectedFile?.name }}</strong
            ><span>{{ fileSize }}</span>
          </div>
          <button
            type="button"
            class="text-button"
            :disabled="pending"
            aria-label="Remove selected file"
            @click="removeFile"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
    <Transition name="reveal">
      <div
        v-if="errorMessage"
        id="upload-error"
        ref="errorBox"
        class="error-message"
        role="alert"
        tabindex="-1"
      >
        <strong>We couldn’t create the article.</strong>
        <p>{{ errorMessage }}</p>
      </div>
    </Transition>
    <button
      class="primary-button"
      type="submit"
      :disabled="!selectedFile || pending"
    >
      <span>{{ pending ? 'Creating your article…' : 'Generate article' }}</span
      ><span v-if="pending" class="spinner" aria-hidden="true" /><span
        v-else
        aria-hidden="true"
        >↗</span
      >
    </button>
    <div v-if="pending" class="generation-progress" aria-hidden="true">
      <span />
    </div>
    <p class="upload-status" role="status" aria-live="polite">
      {{
        pending
          ? 'Checking the data and writing your article. This may take up to a minute.'
          : ''
      }}
    </p>
  </form>
</template>
