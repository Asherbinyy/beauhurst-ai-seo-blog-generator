<script setup lang="ts">
import type { Company } from '#shared/schemas/article'
import { formatMoney } from '#shared/utils/format'
import {
  sortCompanies,
  companiesCsv,
  type SortField,
  type SortDirection,
} from '#shared/utils/ranking'
import { downloadBlob } from '~/utils/download'
const props = defineProps<{ companies: Company[] }>()
const query = ref('')
const region = ref('')
const sortField = ref<SortField>('rank')
const direction = ref<SortDirection>('asc')
const showDescriptions = ref(true)
const downloadStatus = ref('')
const columns: { field: SortField; label: string; class?: string }[] = [
  { field: 'rank', label: 'Rank', class: 'rank-cell' },
  { field: 'company', label: 'Company', class: 'company-cell' },
  { field: 'region', label: 'Region' },
  { field: 'totalRaisedPence', label: 'Total raised', class: 'funding-cell' },
  { field: 'stage', label: 'Stage' },
  { field: 'employees', label: 'Employees' },
  { field: 'industries', label: 'Industries', class: 'industries-cell' },
]
const ordered = computed(() =>
  sortCompanies(props.companies, sortField.value, direction.value),
)
function sort(field: SortField) {
  direction.value =
    sortField.value === field && direction.value === 'asc' ? 'desc' : 'asc'
  sortField.value = field
}
function exportCsv() {
  const rows = ordered.value.filter((company) =>
    matches.value.has(company.rank),
  )
  downloadBlob(
    new Blob([companiesCsv(rows)], { type: 'text/csv;charset=utf-8' }),
    'fieldnotes-companies.csv',
  )
  downloadStatus.value = `${rows.length} companies downloaded in the current sort order.`
}
const regions = computed(() =>
  [
    ...new Set(
      props.companies.flatMap((company) =>
        company.region ? [company.region] : [],
      ),
    ),
  ].sort(),
)
const matches = computed(
  () =>
    new Set(
      props.companies
        .filter((company) => {
          const text = [
            company.company,
            company.description,
            ...company.industries,
          ]
            .join(' ')
            .toLocaleLowerCase('en-GB')
          return (
            (!region.value || company.region === region.value) &&
            text.includes(query.value.trim().toLocaleLowerCase('en-GB'))
          )
        })
        .map((company) => company.rank),
    ),
)
function resetOrder() {
  sortField.value = 'rank'
  direction.value = 'asc'
}
function clearFilters() {
  query.value = ''
  region.value = ''
}
</script>
<template>
  <div class="ranking-explorer" :class="{ 'is-compact': !showDescriptions }">
    <div class="ranking-controls">
      <label class="search-field"
        >Find a company<input
          v-model="query"
          type="search"
          placeholder="Search names, descriptions or industries"
      /></label>
      <label
        >Region<select v-model="region">
          <option value="">All regions</option>
          <option v-for="name in regions" :key="name" :value="name">
            {{ name }}
          </option>
        </select></label
      >
      <button
        class="text-button"
        type="button"
        :disabled="!query && !region"
        @click="clearFilters"
      >
        Clear filters
      </button>
      <div class="table-view-actions">
        <label class="checkbox-label"
          ><input v-model="showDescriptions" type="checkbox" /> Show
          descriptions</label
        >
        <button
          class="text-button"
          type="button"
          :disabled="sortField === 'rank' && direction === 'asc'"
          @click="resetOrder"
        >
          Reset order
        </button>
        <button
          class="secondary-button"
          type="button"
          :disabled="!matches.size"
          @click="exportCsv"
        >
          Download CSV <span aria-hidden="true">↓</span>
        </button>
      </div>
      <p id="sort-guidance" class="sr-only">
        Select a column heading to sort ascending, then select it again to sort
        descending. Original ranks stay unchanged. Missing values sort last.
      </p>
      <p class="download-status" role="status">{{ downloadStatus }}</p>
      <p role="status">
        Showing {{ matches.size }} of {{ companies.length }} companies
      </p>
    </div>
    <div
      class="ranking-scroll"
      role="region"
      aria-label="Company ranking table; scroll horizontally for all columns"
      tabindex="0"
    >
      <table class="ranking-table">
        <caption class="sr-only">
          Complete company ranking with recorded fundraising and available
          source information
        </caption>
        <thead>
          <tr>
            <th
              v-for="column in columns"
              :key="column.field"
              scope="col"
              :class="column.class"
              :aria-sort="
                sortField === column.field
                  ? direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : undefined
              "
            >
              <button
                type="button"
                class="sort-button"
                aria-describedby="sort-guidance"
                @click="sort(column.field)"
              >
                {{ column.label }}
                <span
                  aria-hidden="true"
                  :class="{ active: sortField === column.field }"
                  >{{
                    sortField === column.field
                      ? direction === 'asc'
                        ? '↑'
                        : '↓'
                      : '↕'
                  }}</span
                >
              </button>
            </th>
          </tr>
        </thead>
        <TransitionGroup tag="tbody" name="table-row">
          <tr
            v-for="company in ordered"
            :key="company.rank"
            :class="{ 'filtered-out': !matches.has(company.rank) }"
          >
            <td class="rank-cell">{{ company.rank }}</td>
            <th scope="row" class="company-cell">
              <a
                v-if="company.website"
                :href="company.website"
                target="_blank"
                rel="noopener noreferrer"
                :aria-label="`${company.company} website (opens in a new tab)`"
                >{{ company.company }} <span aria-hidden="true">↗</span></a
              ><span v-else>{{ company.company }}</span>
              <p v-if="company.description">{{ company.description }}</p>
            </th>
            <td>{{ company.region ?? '—' }}</td>
            <td class="funding-cell">
              {{
                company.totalRaisedPence === null
                  ? '—'
                  : formatMoney(company.totalRaisedPence)
              }}
            </td>
            <td>{{ company.stage ?? '—' }}</td>
            <td>{{ company.employees ?? '—' }}</td>
            <td class="industries-cell">
              {{ company.industries.join('; ') || '—' }}
            </td>
          </tr>
        </TransitionGroup>
      </table>
    </div>
    <div v-if="!matches.size" class="empty-results">
      <h3>No matching companies</h3>
      <p>
        Try a different search or clear the filters to see the complete ranking.
      </p>
      <button type="button" class="secondary-button" @click="clearFilters">
        Show all companies
      </button>
    </div>
  </div>
</template>
