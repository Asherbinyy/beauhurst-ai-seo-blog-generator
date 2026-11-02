<script setup lang="ts">
import type { NuxtError } from '#app'
defineProps<{ error: NuxtError }>()
</script>
<template>
  <main id="main" class="error-page">
    <p class="eyebrow">FIELDNOTES / {{ error.statusCode }}</p>
    <h1>
      {{
        error.statusCode === 404
          ? 'We couldn’t find that article.'
          : 'Something interrupted the page.'
      }}
    </h1>
    <p>
      {{
        error.statusCode === 404
          ? 'Check the link, or return to the research desk to create an article.'
          : 'Please try again. Saved articles remain on the server.'
      }}
    </p>
    <button class="primary-button" @click="clearError({ redirect: '/' })">
      Return to the research desk
    </button>
  </main>
</template>
