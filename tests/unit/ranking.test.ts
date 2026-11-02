import { describe, expect, it } from 'vitest'
import { parseCompanies } from '../../server/lib/parse-companies'
import {
  sortCompanies,
  companiesCsv,
  type SortField,
} from '../../shared/utils/ranking'
import Papa from 'papaparse'

const rows = parseCompanies(
  'Company,Total Raised,Region,Employees,Industries\nZeta,10,London,10-24,Payments\nAlpha,20,North West,2-5,Healthtech\nBeta,,London,,',
).companies

describe('report sorting and export', () => {
  it('keeps the final penny at the supported monetary limit in CSV exports', () => {
    const csv = companiesCsv([
      { ...rows[0]!, totalRaisedPence: Number.MAX_SAFE_INTEGER },
    ])
    expect(csv).toContain('90071992547409.91')
  })
  it('sorts money numerically, names alphabetically, and keeps missing amounts last both ways', () => {
    expect(sortCompanies(rows, 'company', 'asc').map((c) => c.company)).toEqual(
      ['Alpha', 'Beta', 'Zeta'],
    )
    expect(
      sortCompanies(rows, 'company', 'desc').map((c) => c.company),
    ).toEqual(['Zeta', 'Beta', 'Alpha'])
    expect(
      sortCompanies(rows, 'totalRaisedPence', 'asc').map((c) => c.company),
    ).toEqual(['Zeta', 'Alpha', 'Beta'])
    expect(
      sortCompanies(rows, 'totalRaisedPence', 'desc').map((c) => c.company),
    ).toEqual(['Alpha', 'Zeta', 'Beta'])
    expect(rows.map((c) => c.company)).toEqual(['Alpha', 'Zeta', 'Beta'])
  })
  it.each<SortField>([
    'rank',
    'company',
    'region',
    'totalRaisedPence',
    'stage',
    'employees',
    'industries',
  ])('sorts %s stably without changing source ranks', (field) => {
    const sorted = sortCompanies(rows, field, 'desc')
    expect(sorted.map((c) => c.rank).sort()).toEqual([1, 2, 3])
    expect(sortCompanies(rows, field, 'desc')).toEqual(sorted)
  })
  it('uses natural text ordering for employee bands without estimating headcount', () => {
    expect(
      sortCompanies(rows, 'employees', 'asc').map((c) => c.employees),
    ).toEqual(['2-5', '10-24', null])
  })
  it('exports exact amounts, source text and blanks as readable CSV, neutralising formulas', () => {
    const source = [
      {
        ...rows[0]!,
        company: '=HYPERLINK("https://example.com")',
        description: 'A, B\nC',
        totalRaisedPence: 123,
      },
      { ...rows[2]!, company: '@malicious' },
    ]
    const csv = companiesCsv(source)
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true })
    expect(parsed.data[0]?.Company).toBe('\'=HYPERLINK("https://example.com")')
    expect(parsed.data[0]?.Description).toBe('A, B\nC')
    expect(parsed.data[0]?.['Total Raised']).toBe('1.23')
    expect(parsed.data[1]?.['Total Raised']).toBe('')
    expect(parsed.data[1]?.Company).toBe("'@malicious")
  })
})
