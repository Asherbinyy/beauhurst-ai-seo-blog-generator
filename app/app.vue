<template>
  <div>
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header">
      <NuxtLink to="/" class="wordmark"
        ><span class="brand-mark" aria-hidden="true">f.</span> fieldnotes<span
          class="wordmark-detail"
          >COMPANY RESEARCH</span
        ><span class="sr-only"> home</span></NuxtLink
      >
      <nav class="header-nav" aria-label="Main navigation">
        <NuxtLink to="/" class="header-link"
          >Research desk <span aria-hidden="true">↗</span></NuxtLink
        >
        <ThemePicker />
      </nav>
    </header>
    <NuxtRouteAnnouncer />
    <NuxtPage />
    <footer class="site-footer">
      <span>Fieldnotes</span><NuxtLink to="/">Research desk</NuxtLink>
    </footer>
  </div>
</template>
