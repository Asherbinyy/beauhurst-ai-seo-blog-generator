import {
  copySchema,
  type Analytics,
  type ArticleCopy,
  type Dataset,
} from '../../shared/schemas/article'
import { formatMoney, formatPercent } from '../../shared/utils/format'
import { GenerationError } from './errors'

export type CopyContext = {
  filename: string
  headers: string[]
  facts: Record<string, string>
  industries: string[]
  regions: string[]
  companies: {
    company: string
    description: string | null
    industries: string[]
  }[]
}
export type CopyGenerator = (context: CopyContext) => Promise<unknown>

export function buildCopyContext(
  dataset: Dataset,
  analytics: Analytics,
  filename: string,
): CopyContext {
  const facts: Record<string, string> = {
    companyCount: String(analytics.count),
    fundingKnownCount: String(analytics.fundingKnownCount ?? analytics.count),
    regionKnownCount: String(analytics.regionKnownCount),
  }
  if (analytics.totalRaisedPence !== null)
    facts.totalRaised = formatMoney(analytics.totalRaisedPence)
  if (analytics.medianRaisedPence !== null)
    facts.medianRaised = formatMoney(analytics.medianRaisedPence)
  if (analytics.topCount) facts.topCount = String(analytics.topCount)
  if (analytics.topShare !== null)
    facts.topShare = formatPercent(analytics.topShare)
  const leadingRegion = analytics.regions[0]
  if (leadingRegion) {
    facts.leadingRegion = leadingRegion.name
    facts.leadingRegionCount = String(leadingRegion.count)
  }
  return {
    filename,
    headers: dataset.headers.filter((h) =>
      [
        'company',
        'total raised',
        'rank',
        'region',
        'stage',
        'employees',
        'description',
        'website',
        'industries',
      ].includes(h),
    ),
    facts,
    industries: [
      ...new Set(dataset.companies.flatMap((c) => c.industries)),
    ].slice(0, 40),
    regions: analytics.regions.slice(0, 40).map((region) => region.name),
    companies: dataset.companies.slice(0, 20).map((c) => ({
      company: c.company,
      description: c.description?.slice(0, 400) ?? null,
      industries: c.industries.slice(0, 5),
    })),
  }
}

export function resolveCopy(
  value: unknown,
  facts: Record<string, string>,
): ArticleCopy {
  const parsed = copySchema.safeParse(value)
  if (!parsed.success)
    throw new GenerationError(
      'The writing service returned incomplete copy. Please try again.',
    )
  function resolve(text: string): string {
    const withoutTokens = text.replace(
      /\{\{([a-zA-Z]+)\}\}/g,
      (_match, key: string) => {
        if (!Object.hasOwn(facts, key))
          throw new GenerationError(
            'The writing service referenced an unavailable fact. Please try again.',
          )
        return ''
      },
    )
    // A deliberately small constraint: no free-form numbers, markup or unresolved tokens.
    // Worded/qualitative claims still require review; this is not a semantic fact checker.
    if (
      /[{}<>]|\p{N}/u.test(withoutTokens) ||
      /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million|billion|percent)\b/i.test(
        withoutTokens,
      )
    ) {
      throw new GenerationError(
        'The writing service included unsupported figures or formatting. Please try again.',
      )
    }
    return text.replace(
      /\{\{([a-zA-Z]+)\}\}/g,
      (_match, key: string) => facts[key]!,
    )
  }
  const copy = parsed.data
  const resolved = {
    title: resolve(copy.title),
    metaDescription: resolve(copy.metaDescription),
    introduction: resolve(copy.introduction),
    sections: copy.sections.map((s) => ({
      heading: resolve(s.heading),
      body: resolve(s.body),
    })),
  }
  const checked = copySchema.safeParse(resolved)
  if (!checked.success)
    throw new GenerationError(
      'The generated copy is too long after formatting. Please try again.',
    )
  return checked.data
}
