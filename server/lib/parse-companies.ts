import Papa from 'papaparse'
import {
  companySchema,
  MAX_FILE_BYTES,
  MAX_RECORDS,
  type Company,
  type Dataset,
} from '../../shared/schemas/article'
import { InputError } from './errors'

export function parseGbp(input: string): number {
  const value = input
    .trim()
    .replace(/^GBP\s*/i, '')
    .replace(/\s*GBP$/i, '')
    .trim()
  const match = /^(?:£\s*)?(\d+|[1-9]\d{0,2}(?:,\d{3})+)(?:\.(\d{1,2}))?$/.exec(
    value,
  )
  if (!match?.[1])
    throw new InputError(
      'Total Raised must be a non-negative GBP amount, such as £1,250 or 1250.50. Other currencies are not supported.',
    )
  const pence =
    BigInt(match[1].replaceAll(',', '')) * 100n +
    BigInt((match[2] ?? '').padEnd(2, '0'))
  if (pence > BigInt(Number.MAX_SAFE_INTEGER))
    throw new InputError('Total Raised exceeds the safe supported amount.')
  return Number(pence)
}

function optional(value: string | undefined): string | null {
  const text = value?.trim()
  return !text ||
    /^(?:n\/?a|null|unknown|not (?:provided|available)|[-–—])$/i.test(text)
    ? null
    : text
}

const aliases: Record<string, string> = {
  companyname: 'company',
  company: 'company',
  name: 'company',
  businessname: 'company',
  totalraised: 'total raised',
  totalfunding: 'total raised',
  funding: 'total raised',
  fundingraised: 'total raised',
  totalfundraising: 'total raised',
  rank: 'rank',
  ranking: 'rank',
  position: 'rank',
  region: 'region',
  location: 'region',
  stage: 'stage',
  fundingstage: 'stage',
  employees: 'employees',
  employeecount: 'employees',
  headcount: 'employees',
  description: 'description',
  companydescription: 'description',
  website: 'website',
  url: 'website',
  companywebsite: 'website',
  industries: 'industries',
  industry: 'industries',
  sector: 'industries',
  sectors: 'industries',
}

export function parseCompanies(input: string): Dataset {
  if (Buffer.byteLength(input, 'utf8') > MAX_FILE_BYTES)
    throw new InputError('The CSV must be no larger than 1 MiB.')
  if (!input.trim())
    throw new InputError(
      'The CSV is empty. Select a file containing company records.',
    )
  const parsed = Papa.parse<string[]>(input.replace(/^\uFEFF/, ''), {
    delimiter: '',
    delimitersToGuess: [',', ';', '\t'],
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
  })
  // A single-column company list is valid; Papa cannot infer its delimiter.
  const error = parsed.errors.find(
    (error) => error.code !== 'UndetectableDelimiter',
  )
  if (error) throw new InputError(`Malformed CSV: ${error.message}`)
  const [rawHeaders, ...rows] = parsed.data
  if (!rawHeaders) throw new InputError('The CSV needs a header row.')
  const headers = rawHeaders.map((value) => {
    const normal = value.trim().toLowerCase().replace(/\s+/g, ' ')
    const key = normal.replace(/[\s_-]/g, '')
    return Object.hasOwn(aliases, key) ? aliases[key]! : normal
  })
  const recognised = headers.filter((header) =>
    Object.values(aliases).includes(header),
  )
  if (new Set(recognised).size !== recognised.length)
    throw new InputError(
      'More than one column maps to the same field. Keep one column for each field.',
    )
  if (!headers.includes('company'))
    throw new InputError(
      'Include a Company column (Company Name or Name also works).',
    )
  if (!rows.length)
    throw new InputError('The CSV has headers but no company records.')
  if (rows.length > MAX_RECORDS)
    throw new InputError('The CSV must contain no more than 1,000 records.')

  const notes = new Set<string>()
  let missingFunding = 0
  const sourceRanks: (number | null)[] = []
  const companies: Company[] = rows.map((cells, index) => {
    try {
      if (
        cells.length > headers.length &&
        cells.slice(headers.length).some((value) => value.trim())
      )
        throw new InputError(
          'Extra values have no column header. Check the CSV delimiters and quote amounts containing commas.',
        )
      if (cells.length < headers.length)
        notes.add('Missing trailing cells were treated as not provided.')
      const row = Object.fromEntries(
        headers.map((header, i) => [header, cells[i] ?? '']),
      )
      const rank = optional(row.rank)
      sourceRanks.push(
        rank && /^[1-9]\d*$/.test(rank) && Number.isSafeInteger(Number(rank))
          ? Number(rank)
          : null,
      )
      const funding = optional(row['total raised'])
      if (funding === null) missingFunding++
      let website = optional(row.website)
      if (website) {
        if (!/^[a-z][a-z\d+.-]*:/i.test(website)) website = `https://${website}`
        try {
          const url = new URL(website)
          if (
            !['http:', 'https:'].includes(url.protocol) ||
            !url.hostname.includes('.') ||
            website.length > 2048
          )
            throw new Error('Invalid website')
          website = url.href
        } catch {
          website = null
          notes.add(
            'Unusable website links were omitted; their company records were kept.',
          )
        }
      }
      const record = companySchema.safeParse({
        rank: index + 1,
        company: row.company,
        totalRaisedPence: funding === null ? null : parseGbp(funding),
        region: optional(row.region),
        stage: optional(row.stage),
        employees: optional(row.employees),
        description: optional(row.description),
        website,
        industries: [
          ...new Set(
            (optional(row.industries) ?? '')
              .split(';')
              .map((value) => value.trim())
              .filter(Boolean),
          ),
        ],
      })
      if (!record.success) {
        const issue = record.error.issues[0]
        throw new InputError(`${issue?.path.join('.')}: ${issue?.message}`)
      }
      return record.data
    } catch (error) {
      if (error instanceof InputError)
        throw new InputError(
          `Record ${index + 1} (CSV row ${index + 2}, excluding embedded newlines): ${error.message}`,
        )
      throw error
    }
  })
  if (missingFunding)
    notes.add(
      `${missingFunding} of ${companies.length} companies have no recorded funding. Funding statistics use the available amounts only.`,
    )
  const suppliedOrder = companies
    .map((company, index) => ({ company, rank: sourceRanks[index] }))
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
  const knownInOrder = suppliedOrder.flatMap(({ company }) =>
    company.totalRaisedPence === null ? [] : [company.totalRaisedPence],
  )
  const validRanks =
    headers.includes('rank') &&
    sourceRanks.every((rank) => rank !== null) &&
    new Set(sourceRanks).size === companies.length &&
    knownInOrder.every(
      (amount, index) => index === 0 || amount <= knownInOrder[index - 1]!,
    )
  if (validRanks) {
    suppliedOrder.forEach(({ company, rank }) => {
      company.rank = rank!
    })
    companies.sort((a, b) => a.rank - b.rank)
  } else {
    if (headers.includes('rank'))
      notes.add(
        'Incomplete or inconsistent ranks were recalculated from available funding, with source order breaking ties.',
      )
    companies.sort(
      (a, b) =>
        (a.totalRaisedPence === null && b.totalRaisedPence === null
          ? 0
          : a.totalRaisedPence === null
            ? 1
            : b.totalRaisedPence === null
              ? -1
              : b.totalRaisedPence - a.totalRaisedPence) || a.rank - b.rank,
    )
    companies.forEach((company, index) => {
      company.rank = index + 1
    })
  }
  return {
    companies,
    headers,
    rankingSource: validRanks ? 'supplied' : 'derived',
    importNotes: [...notes],
  }
}
