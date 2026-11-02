import type { Analytics, Company } from '../../shared/schemas/article'
import { InputError } from './errors'

export function analyseCompanies(companies: Company[]): Analytics {
  if (!companies.length)
    throw new InputError('At least one company is required.')
  const amounts = companies
    .flatMap((c) => (c.totalRaisedPence === null ? [] : [c.totalRaisedPence]))
    .sort((a, b) => a - b)
  let total = 0
  const regions = new Map<string, number>()
  for (const company of companies) {
    total += company.totalRaisedPence ?? 0
    if (!Number.isSafeInteger(total))
      throw new InputError(
        'Aggregate fundraising exceeds the safe supported amount.',
      )
    if (company.region)
      regions.set(company.region, (regions.get(company.region) ?? 0) + 1)
  }
  const middle = Math.floor(amounts.length / 2)
  const upper = amounts[middle]!
  const lower = amounts[middle - 1] ?? upper
  const median = !amounts.length
    ? null
    : amounts.length % 2
      ? upper
      : lower + Math.round((upper - lower) / 2)
  const topCount = Math.min(10, amounts.length)
  const topTotal = amounts
    .slice(-topCount)
    .reduce((sum, value) => sum + value, 0)
  const distribution = [...regions]
    .map(([name, count]) => ({ name, count }))
    .sort(
      (a, b) =>
        b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
    )
  return {
    count: companies.length,
    totalRaisedPence: amounts.length ? total : null,
    medianRaisedPence: median,
    fundingKnownCount: amounts.length,
    topCount,
    topShare: total ? (topTotal / total) * 100 : null,
    regionKnownCount: distribution.reduce(
      (sum, region) => sum + region.count,
      0,
    ),
    regions: distribution,
  }
}
