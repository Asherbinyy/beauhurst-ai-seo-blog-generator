import { describe, expect, it } from 'vitest'
import { buildCopyContext, resolveCopy } from '../../server/lib/copy'
import { parseCompanies } from '../../server/lib/parse-companies'
import { analyseCompanies } from '../../server/lib/analyse-companies'

function context(csv: string, filename = 'companies.csv') {
  const dataset = parseCompanies(csv)
  return buildCopyContext(
    dataset,
    analyseCompanies(dataset.companies),
    filename,
  )
}
const editorialCopy = {
  title: '{{companyCount}} Cleantech Companies Ranked by Fundraising',
  metaDescription:
    'Compare the cleantech company ranking by recorded fundraising, with company descriptions and regional context from the supplied dataset.',
  introduction:
    'This ranking brings together {{companyCount}} cleantech companies in the supplied dataset, ordered by recorded fundraising. It includes descriptions and regional context alongside the available funding figures.',
  sections: [
    {
      heading: 'How fundraising is distributed across cleantech companies',
      body: 'Recorded fundraising totals {{totalRaised}}, with a median of {{medianRaised}} among the companies with recorded funding.',
    },
    {
      heading: 'Specialisms represented among the cleantech companies',
      body: 'The supplied descriptions provide context for the companies and their products. These records describe the uploaded collection rather than complete industry coverage.',
    },
  ],
}

describe('editorial copy evidence and factual boundaries', () => {
  it('provides bounded regional source labels for geography without inventing a country', () => {
    const source = context(
      'Company,Region,Total Raised\nAlpha,London,1\nBeta,Wales,2',
    )
    expect(source.regions).toEqual(['London', 'Wales'])
    expect(source.facts).not.toHaveProperty('country')
    const ambiguous = context('Company,Region,Total Raised\nAlpha,London,1')
    expect(ambiguous.regions).toEqual(['London'])
    expect(JSON.stringify(ambiguous)).not.toContain('UK')
  })
  it('caps regional context without losing the authoritative coverage count', () => {
    const source = context(
      'Company,Region,Total Raised\n' +
        Array.from(
          { length: 45 },
          (_, index) => `Company ${index},Region ${index},1`,
        ).join('\n'),
    )
    expect(source.regions).toHaveLength(40)
    expect(source.facts.regionKnownCount).toBe('45')
  })
  it('resolves search-focused copy using only supplied numeric facts', () => {
    const source = context(
      'Company,Total Raised,Industries\nAlpha,10,Cleantech\nBeta,20,Cleantech',
    )
    const copy = resolveCopy(editorialCopy, source.facts)
    expect(copy.title).toBe('2 Cleantech Companies Ranked by Fundraising')
    expect(copy.sections[0]?.body).toContain('£30')
    expect(copy.sections[0]?.body).toContain('£15')
    expect(JSON.stringify(copy)).not.toContain('{{')
  })
  it('does not provide funding facts or accept funding references when amounts are absent', () => {
    const source = context('Company\nAlpha\nBeta')
    expect(source.facts).not.toHaveProperty('totalRaised')
    expect(source.facts).not.toHaveProperty('medianRaised')
    expect(source.facts).not.toHaveProperty('topCount')
    expect(source.facts.fundingKnownCount).toBe('0')
    expect(() => resolveCopy(editorialCopy, source.facts)).toThrow(
      /unavailable fact/,
    )
  })
  it('keeps partial funding coverage exact instead of treating missing amounts as zero', () => {
    const source = context('Company,Total Raised\nAlpha,10\nBeta,\nGamma,20')
    expect(source.facts).toMatchObject({
      companyCount: '3',
      fundingKnownCount: '2',
      totalRaised: '£30',
      medianRaised: '£15',
    })
  })
  it.each(['£999', 'five million', '{{marketShare}}'])(
    'still rejects unsupported numeric claims: %s',
    (value) => {
      const source = context('Company,Total Raised\nAlpha,10')
      expect(() =>
        resolveCopy(
          {
            ...editorialCopy,
            introduction: `The supplied companies account for ${value} across the broader industry in this collection.`,
          },
          source.facts,
        ),
      ).toThrow()
    },
  )
})
