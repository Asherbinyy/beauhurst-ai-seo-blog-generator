<script setup lang="ts">
import type { Article } from '#shared/schemas/article'
import { formatDate } from '#shared/utils/format'
const route = useRoute()
const { data: article, error } = await useFetch<Article>(
  `/api/articles/${encodeURIComponent(String(route.params.slug))}`,
)
if (error.value || !article.value)
  throw createError({
    statusCode: error.value?.statusCode ?? 404,
    statusMessage:
      error.value?.statusCode === 500
        ? 'Article could not be read'
        : 'Article not found',
    fatal: true,
  })
const config = useRuntimeConfig()
const canonical = computed(() => {
  try {
    const origin = new URL(config.public.siteUrl)
    return ['http:', 'https:'].includes(origin.protocol)
      ? new URL(
          `${config.app.baseURL}blog/${article.value!.slug}`,
          origin.origin,
        ).href
      : undefined
  } catch {
    return undefined
  }
})
useSeoMeta({
  title: () => article.value!.copy.title,
  description: () => article.value!.copy.metaDescription,
  ogTitle: () => article.value!.copy.title,
  ogDescription: () => article.value!.copy.metaDescription,
  ogType: 'article',
  ogUrl: () => canonical.value,
  twitterCard: 'summary',
})
useHead(() => ({
  link: canonical.value ? [{ rel: 'canonical', href: canonical.value }] : [],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: article.value!.copy.title,
        description: article.value!.copy.metaDescription,
        dateCreated: article.value!.createdAt,
        inLanguage: 'en-GB',
        ...(canonical.value
          ? { url: canonical.value, mainEntityOfPage: canonical.value }
          : {}),
      }).replace(/</g, '\u003c'),
    },
  ],
}))
</script>

<template>
  <main v-if="article" id="main" class="article-page">
    <p v-if="config.public.showcase" class="demo-note">
      Example report · Sorting, filters and downloads are available below.
    </p>
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <NuxtLink to="/">Research desk</NuxtLink><span aria-hidden="true">/</span
      ><span>Dataset report</span>
    </nav>
    <article>
      <header v-reveal class="article-header">
        <div class="eyebrow"><span class="small-rule" /> COMPANY INSIGHTS</div>
        <h1>{{ article.copy.title }}</h1>
        <div class="article-context">
          <span>Source: {{ article.sourceFilename }}</span
          ><span
            >Article generated
            <time :datetime="article.createdAt">{{
              formatDate(article.createdAt)
            }}</time></span
          >
        </div>
        <p class="article-introduction">{{ article.copy.introduction }}</p>
      </header>
      <ArticleActions v-reveal="70" :article="article" />
      <nav class="article-navigation" aria-label="In this article">
        <span>IN THIS ARTICLE</span><a href="#overview">At a glance</a
        ><a href="#insights">Insights</a
        ><a href="#ranking-title">Company ranking</a
        ><a href="#methodology-title">Source notes</a>
      </nav>
      <ArticleStats id="overview" v-reveal :analytics="article.analytics" />
      <div id="insights" v-reveal class="insights-layout">
        <div class="insight-prose">
          <section
            v-for="(section, index) in article.copy.sections"
            :key="index"
          >
            <h2>{{ section.heading }}</h2>
            <p>{{ section.body }}</p>
          </section>
        </div>
        <aside class="region-panel" aria-labelledby="regions-title">
          <p class="eyebrow">GEOGRAPHIC CONTEXT</p>
          <h2 id="regions-title">Where companies are based</h2>
          <template v-if="article.analytics.regions.length"
            ><ul>
              <li
                v-for="region in article.analytics.regions"
                :key="region.name"
              >
                <div>
                  <span>{{ region.name }}</span
                  ><strong>{{ region.count }}</strong>
                </div>
                <span class="region-track" aria-hidden="true"
                  ><span
                    :style="{
                      width: `${(region.count / article.analytics.count) * 100}%`,
                    }"
                /></span>
              </li>
            </ul>
            <p class="small-copy">
              Region recorded for {{ article.analytics.regionKnownCount }} of
              {{ article.analytics.count }} companies. Counts describe this
              dataset.
            </p></template
          >
          <p v-else class="small-copy">
            No regional information was provided in this dataset.
          </p>
        </aside>
      </div>
      <section v-reveal class="ranking-section" aria-labelledby="ranking-title">
        <div class="section-heading">
          <div>
            <p class="eyebrow">THE COMPLETE PICTURE</p>
            <h2 id="ranking-title">Company ranking</h2>
          </div>
          <span class="count-pill"
            >{{ article.analytics.count }} companies</span
          >
        </div>
        <p class="ranking-help">
          Select a column heading to sort. Search or filter the list, then
          download your selection.
        </p>
        <CompanyRankingTable :companies="article.companies" />
      </section>
      <section v-reveal class="methodology" aria-labelledby="methodology-title">
        <h2 id="methodology-title">About this dataset</h2>
        <div>
          <p>
            This article describes the records supplied in
            <strong>{{ article.sourceFilename }}</strong
            >. It does not establish complete coverage of an industry or market.
            The article generation date is not the date of the underlying data.
          </p>
          <p>
            Funding is recorded for
            {{ article.analytics.fundingKnownCount ?? article.analytics.count }}
            of {{ article.analytics.count }} companies. Fundraising figures use
            GBP. Totals, median and concentration use recorded amounts only;
            percentages are rounded to one decimal place and median amounts to
            the nearest penny.
            {{
              article.rankingSource === 'supplied'
                ? 'Ranks follow the validated source ranking.'
                : 'Ranks are calculated from recorded fundraising, with missing amounts last and original row order breaking ties.'
            }}
            Missing information is shown as “—” and is never treated as zero.
            Employee bands are preserved, with no estimated headcount.
          </p>
          <ul
            v-if="article.importNotes.length"
            class="import-notes"
            aria-label="Import adjustments"
          >
            <li v-for="note in article.importNotes" :key="note">{{ note }}</li>
          </ul>
        </div>
      </section>
      <div class="article-end">
        <a href="#main" class="text-button">Back to top ↑</a>
        <NuxtLink to="/" class="secondary-button"
          >{{
            config.public.showcase ? 'Back to demo' : 'Create another article'
          }}
          <span aria-hidden="true">↗</span></NuxtLink
        >
      </div>
    </article>
  </main>
</template>
