import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCompanies, parseGbp } from '../../server/lib/parse-companies'
import { analyseCompanies } from '../../server/lib/analyse-companies'
import { formatMoney, formatPercent } from '../../shared/utils/format'

const source = readFileSync(
  new URL(
    '../../task-requirements/fintech_companies_seed.csv',
    import.meta.url,
  ),
  'utf8',
)
const csv = (body: string) => `Company,Total Raised\n${body}`

describe('GBP parsing', () => {
  it.each([
    ['£30,314,247', 3031424700],
    ['3000000', 300000000],
    ['12.34', 1234],
    ['£0', 0],
    ['  £ 1,200.5 ', 120050],
  ])('parses %s exactly', (value, expected) => {
    expect(parseGbp(value)).toBe(expected)
  })
  it.each([
    '',
    'N/A',
    '-1',
    '$2',
    '€3',
    '1,20',
    '1e3',
    '12.345',
    '12 pounds',
    'Infinity',
    '9007199254740992',
  ])('rejects %s', (value) => {
    expect(() => parseGbp(value)).toThrow()
  })
})

describe('CSV contract', () => {
  it('derives deterministic ranks with input-order ties and handles BOM/reordered/unknown columns', () => {
    const result = parseCompanies(
      '\uFEFF extra ,TOTAL RAISED, company ,Industries\r\na,100,Beta,"Medical devices; Care, services"\r\nb,200,Alpha,Healthtech\r\nc,100,Gamma,\r\n',
    )
    expect(result.companies.map((c) => [c.rank, c.company])).toEqual([
      [1, 'Alpha'],
      [2, 'Beta'],
      [3, 'Gamma'],
    ])
    expect(result.companies[1]?.industries).toEqual([
      'Medical devices',
      'Care, services',
    ])
    expect(result.companies[0]?.region).toBeNull()
    expect(result.rankingSource).toBe('derived')
  })
  it('preserves provided ranks and quoted multiline descriptions', () => {
    const result = parseCompanies(
      'Rank,Company,Total Raised,Description\n4,"A, Ltd",20,"First line\nSecond line"\n9,B,10,',
    )
    expect(result.companies.map((c) => c.rank)).toEqual([4, 9])
    expect(result.companies[0]?.description).toContain('\n')
    expect(result.rankingSource).toBe('supplied')
  })
  it.each([
    '',
    'Company,Total Raised,company\nA,1,B',
    csv('A,hello'),
    csv('A,1,extra'),
    csv('"unterminated,1'),
    csv(',1'),
  ])('rejects invalid CSV: %s', (input) => {
    expect(() => parseCompanies(input)).toThrow()
  })
  it('handles unknown optional values without turning them into zeros', () => {
    const { companies } = parseCompanies(
      'Company,Total Raised,Employees,Region\nA,0,N/A,',
    )
    expect(companies[0]?.employees).toBeNull()
    expect(companies[0]?.region).toBeNull()
  })
  it('limits records and bytes', () => {
    expect(() =>
      parseCompanies(
        csv(Array.from({ length: 1001 }, (_, i) => `A${i},1`).join('\n')),
      ),
    ).toThrow(/1,000/)
    expect(() => parseCompanies('x'.repeat(1024 * 1024 + 1))).toThrow(/1 MiB/)
  })
})

describe('deterministic analytics', () => {
  it('reproduces all original assessment oracles', () => {
    const { companies } = parseCompanies(source)
    const facts = analyseCompanies(companies)
    expect(companies).toHaveLength(100)
    expect(companies[0]?.company).toBe('Nevis')
    expect(companies.at(-1)?.company).toBe('Ledger Rocket')
    expect(facts.totalRaisedPence).toBe(62230127000)
    expect(facts.medianRaisedPence).toBe(414678600)
    expect(facts.regions.find((r) => r.name === 'London')?.count).toBe(78)
    expect(facts.topShare).toBeCloseTo(33.0039671942, 8)
    expect(companies.filter((c) => c.employees === null)).toHaveLength(3)
  })
  it('handles odd/even medians, zero totals and smaller datasets', () => {
    expect(
      analyseCompanies(parseCompanies(csv('A,1\nB,3\nC,2')).companies)
        .medianRaisedPence,
    ).toBe(200)
    const small = analyseCompanies(
      parseCompanies(csv('A,0.01\nB,0.02')).companies,
    )
    expect(small.medianRaisedPence).toBe(2)
    expect(small.topCount).toBe(2)
    expect(small.topShare).toBe(100)
    const emptyFunding = analyseCompanies(parseCompanies(csv('A,0')).companies)
    expect(emptyFunding.topShare).toBeNull()
    expect(emptyFunding.regions).toEqual([])
    expect(emptyFunding.regionKnownCount).toBe(0)
  })
  it('rejects unsafe aggregate amounts', () => {
    const { companies } = parseCompanies(
      csv('A,60000000000000\nB,60000000000000'),
    )
    expect(() => analyseCompanies(companies)).toThrow(/safe/i)
  })
})

describe('display formatting', () => {
  it('formats exact pounds, pence and percentage rounding', () => {
    expect(formatMoney(62230127000)).toBe('£622,301,270')
    expect(formatMoney(123)).toBe('£1.23')
    expect(formatMoney(Number.MAX_SAFE_INTEGER)).toBe('£90,071,992,547,409.91')
    expect(formatPercent(33.0039671942)).toBe('33.0%')
  })
})

describe('flexible imports', () => {
  it('recognises header aliases, semicolons and common missing-value markers', () => {
    const result = parseCompanies(
      'Company Name;Funding;Location;URL\nAlpha;GBP 20;London;example.com\nBeta;N/A;-;javascript:alert(1)\nGamma;—',
    )
    expect(result.companies.map((c) => c.totalRaisedPence)).toEqual([
      2000,
      null,
      null,
    ])
    expect(result.companies[0]?.website).toBe('https://example.com/')
    expect(result.companies[1]?.website).toBeNull()
    expect(result.companies[2]?.region).toBeNull()
    expect(result.importNotes.join(' ')).toContain('2 of 3')
    expect(result.importNotes.join(' ')).toContain('website')
    const facts = analyseCompanies(result.companies)
    expect(facts.totalRaisedPence).toBe(2000)
    expect(facts.medianRaisedPence).toBe(2000)
    expect(facts.fundingKnownCount).toBe(1)
  })
  it('accepts a company-only list without inventing funding values', () => {
    const dataset = parseCompanies('Name\nAlpha\nBeta')
    const facts = analyseCompanies(dataset.companies)
    expect(dataset.companies.map((c) => c.company)).toEqual(['Alpha', 'Beta'])
    expect(facts.totalRaisedPence).toBeNull()
    expect(facts.medianRaisedPence).toBeNull()
    expect(facts.topShare).toBeNull()
    expect(facts.fundingKnownCount).toBe(0)
    expect(facts.topCount).toBe(0)
  })
  it.each(['1,A,1\n1,B,2', ',A,1\n2,B,2', '-1,A,1\n2,B,2', '1,A,1\n2,B,2'])(
    'repairs inconsistent source ranks without dropping records',
    (body) => {
      const result = parseCompanies(`Rank,Company,Total Raised\n${body}`)
      expect(result.companies.map((c) => [c.rank, c.company])).toEqual([
        [1, 'B'],
        [2, 'A'],
      ])
      expect(result.rankingSource).toBe('derived')
      expect(result.importNotes.join(' ')).toContain('recalculated')
    },
  )
  it('rejects ambiguous funding and ambiguous recognised columns instead of guessing', () => {
    expect(() => parseCompanies('Company,Funding,Total Raised\nA,1,2')).toThrow(
      /same field/,
    )
    expect(() => parseCompanies('Name,Funding\nA,$100')).toThrow(/GBP/)
  })
})
