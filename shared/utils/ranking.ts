import type { Company } from '../schemas/article'

export type SortField =
  | 'rank'
  | 'company'
  | 'region'
  | 'totalRaisedPence'
  | 'stage'
  | 'employees'
  | 'industries'
export type SortDirection = 'asc' | 'desc'
const collator = new Intl.Collator('en-GB', {
  numeric: true,
  sensitivity: 'base',
})

export function sortCompanies(
  companies: Company[],
  field: SortField,
  direction: SortDirection,
): Company[] {
  return [...companies].sort((a, b) => {
    const left =
      field === 'industries' ? a.industries.join('; ') || null : a[field]
    const right =
      field === 'industries' ? b.industries.join('; ') || null : b[field]
    // Missing values remain last in both directions.
    if (left === null || right === null)
      return left === right ? a.rank - b.rank : left === null ? 1 : -1
    const result =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : collator.compare(String(left), String(right))
    return result * (direction === 'asc' ? 1 : -1) || a.rank - b.rank
  })
}

export function companiesCsv(companies: Company[]): string {
  function cell(value: string | number | null) {
    let text = String(value ?? '')
    // Prevent spreadsheet formula execution without altering values in the article.
    if (/^[\s\uFEFF]*[=+\-@]/u.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  function funding(pence: number | null): string | null {
    if (pence === null) return null
    const exact = BigInt(pence)
    return `${exact / 100n}.${String(exact % 100n).padStart(2, '0')}`
  }
  const headers = [
    'Rank',
    'Company',
    'Region',
    'Total Raised',
    'Stage',
    'Employees',
    'Industries',
    'Description',
    'Website',
  ]
  return (
    '\uFEFF' +
    [
      headers.map(cell).join(','),
      ...companies.map((company) =>
        [
          company.rank,
          company.company,
          company.region,
          funding(company.totalRaisedPence),
          company.stage,
          company.employees,
          company.industries.join('; '),
          company.description,
          company.website,
        ]
          .map(cell)
          .join(','),
      ),
    ].join('\r\n')
  )
}
