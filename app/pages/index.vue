<script setup lang="ts">
import { DEMO_ARTICLE_SLUG } from '#shared/constants'
const config = useRuntimeConfig()

useSeoMeta({
  title: 'Fieldnotes — Turn company data into an article',
  description:
    'Create a data-led company article from a CSV, with a complete ranking, fundraising insights and clear source context.',
  ogTitle: 'Fieldnotes — Company research',
  ogDescription: 'A clearer picture of your company dataset.',
  ogType: 'website',
})
</script>

<template>
  <main id="main" class="generator-page">
    <div v-reveal class="generator-heading">
      <div>
        <p class="eyebrow"><span class="small-rule" /> COMPANY RESEARCH</p>
        <h1>From company data <br />to <em>article.</em></h1>
      </div>
      <p>
        Upload a CSV to create an article with funding insights and a complete
        company ranking.
      </p>
    </div>
    <section
      v-if="config.public.showcase"
      v-reveal
      class="showcase-panel"
      aria-labelledby="showcase-title"
    >
      <div>
        <p class="eyebrow">INTERACTIVE DEMO</p>
        <h2 id="showcase-title">Explore a complete company report.</h2>
        <p>
          100 companies. Sort every column, filter the ranking and save the
          results.
        </p>
        <NuxtLink :to="`/blog/${DEMO_ARTICLE_SLUG}`" class="primary-button"
          >Open the report <span aria-hidden="true">↗</span></NuxtLink
        ><a
          class="template-link"
          href="https://github.com/Asherbinyy/beauhurst-ai-seo-blog-generator#run-locally"
          >Run the private toolbox</a
        >
        <p class="small-copy">
          This hosted demo uses a prepared report. CSV generation runs in the
          local application.
        </p>
      </div>
      <video
        id="walkthrough"
        controls
        playsinline
        preload="metadata"
        :poster="`${config.app.baseURL}media/walkthrough-poster.jpg`"
        aria-label="Fieldnotes upload, report and export walkthrough"
      >
        <source
          :src="`${config.app.baseURL}media/walkthrough.mp4`"
          type="video/mp4"
        />
        <track
          kind="captions"
          :src="`${config.app.baseURL}media/walkthrough.vtt`"
          srclang="en"
          label="English"
          default
        />
      </video>
    </section>
    <div v-else class="generator-grid">
      <CsvUploadForm v-reveal="70" />
      <aside v-reveal="140" class="guide-panel" aria-labelledby="guide-title">
        <p class="eyebrow">BEFORE YOU UPLOAD</p>
        <h2 id="guide-title">What’s in your CSV?</h2>
        <dl class="csv-requirements">
          <div>
            <dt>Start with</dt>
            <dd>
              <code>Company</code
              ><span class="field-hint">Company Name or Name also works.</span>
            </dd>
          </div>
          <div>
            <dt>Optional context</dt>
            <dd>
              Total Raised, Rank, Region, Stage, Employees, Description, Website
              and Industries.
            </dd>
          </div>
          <div>
            <dt>Format</dt>
            <dd>
              CSV with commas, semicolons or tabs. GBP funding amounts, when
              available. Common header names are recognised automatically.
            </dd>
          </div>
        </dl>
        <p class="guide-note">
          Missing details appear as “—”. Funding statistics use recorded amounts
          only; blank amounts stay unknown.
        </p>
        <a
          class="template-link"
          :href="`${config.app.baseURL}company-template.csv`"
          download
          >Download a sample CSV <span aria-hidden="true">↓</span></a
        >
        <p class="small-copy">
          Four fictional companies. A ready-to-use starting point.
        </p>
      </aside>
    </div>
    <ol v-reveal class="workflow" aria-label="How it works">
      <li>
        <span>01</span>
        <div>
          <strong>Upload a CSV</strong>
          <p>Company data from any industry.</p>
        </div>
      </li>
      <li>
        <span>02</span>
        <div>
          <strong>Generate the article</strong>
          <p>Copy, calculated figures and a complete ranking.</p>
        </div>
      </li>
      <li>
        <span>03</span>
        <div>
          <strong>Sort and export</strong>
          <p>Filter the ranking or save a PDF, image or CSV.</p>
        </div>
      </li>
    </ol>
  </main>
</template>
