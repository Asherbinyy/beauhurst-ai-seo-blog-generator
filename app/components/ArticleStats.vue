<script setup lang="ts">
import type { Analytics } from '#shared/schemas/article'
import { formatMoney, formatPercent } from '#shared/utils/format'
const props = defineProps<{ analytics: Analytics }>()
const fundingCount = computed(
  () => props.analytics.fundingKnownCount ?? props.analytics.count,
)
</script>
<template>
  <dl class="stats-grid" aria-label="Dataset statistics">
    <div>
      <dt>Companies in this dataset</dt>
      <dd>{{ analytics.count }}<span>Every company included below</span></dd>
    </div>
    <div>
      <dt>Total recorded fundraising</dt>
      <dd class="money-stat">
        {{
          analytics.totalRaisedPence === null
            ? '—'
            : formatMoney(analytics.totalRaisedPence)
        }}<span
          >Recorded for {{ fundingCount }} of
          {{ analytics.count }} companies</span
        >
      </dd>
    </div>
    <div>
      <dt>Median fundraising</dt>
      <dd class="money-stat">
        {{
          analytics.medianRaisedPence === null
            ? '—'
            : formatMoney(analytics.medianRaisedPence)
        }}<span>Middle of the recorded amounts</span>
      </dd>
    </div>
    <div>
      <dt>
        {{
          analytics.topCount
            ? `Top ${analytics.topCount} funding share`
            : 'Funding share'
        }}
      </dt>
      <dd>
        {{
          analytics.topShare === null ? '—' : formatPercent(analytics.topShare)
        }}
        <span>{{
          analytics.topShare === null
            ? 'No positive recorded funding'
            : 'Share of total recorded fundraising'
        }}</span>
      </dd>
    </div>
  </dl>
</template>
