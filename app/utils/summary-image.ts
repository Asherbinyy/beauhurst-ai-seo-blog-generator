import type { Article } from '#shared/schemas/article'
import { formatDate, formatMoney, formatPercent } from '#shared/utils/format'

// Draw source text as text, never as markup or remotely loaded images.
export async function createSummaryImage(article: Article): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = 1600
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Image export is unavailable in this browser.')
  const ink = '#19342e'
  const muted = '#53645e'

  function text(
    value: string,
    x: number,
    y: number,
    font: string,
    color = ink,
  ) {
    context!.font = font
    context!.fillStyle = color
    context!.fillText(value, x, y)
  }
  function lines(value: string, font: string, width: number): string[] {
    context!.font = font
    const result: string[] = []
    let line = ''
    // Wrap words, including unbroken filenames, using actual rendered widths.
    for (const word of value.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word
      if (context!.measureText(candidate).width <= width) {
        line = candidate
        continue
      }
      if (line) {
        result.push(line)
        line = ''
      }
      for (const character of word) {
        if (context!.measureText(line + character).width > width) {
          result.push(line)
          line = ''
        }
        line += character
      }
    }
    if (line) result.push(line)
    return result
  }
  const titleLines = lines(article.copy.title, '52px Georgia', 1440)
  const sourceLines = lines(
    `Source: ${article.sourceFilename}`,
    '21px sans-serif',
    1440,
  )
  const gridTop = Math.max(400, 210 + titleLines.length * 62 + 35)
  const footerTop = gridTop + 365 + sourceLines.length * 28 + 24
  canvas.height = footerTop + 85
  context.fillStyle = '#faf9f5'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = ink
  context.fillRect(0, 0, 18, canvas.height)
  text('fieldnotes', 80, 100, '42px Georgia')
  text('DATASET BRIEF', 1230, 100, '18px sans-serif', muted)
  titleLines.forEach((line, index) =>
    text(line, 80, 210 + index * 62, '52px Georgia'),
  )
  const facts = [
    ['COMPANIES', String(article.analytics.count)],
    [
      'TOTAL RECORDED FUNDRAISING',
      article.analytics.totalRaisedPence === null
        ? 'Not provided'
        : formatMoney(article.analytics.totalRaisedPence),
    ],
    [
      'MEDIAN FUNDRAISING',
      article.analytics.medianRaisedPence === null
        ? 'Not provided'
        : formatMoney(article.analytics.medianRaisedPence),
    ],
    [
      article.analytics.topCount
        ? `TOP ${article.analytics.topCount} FUNDING SHARE`
        : 'FUNDING SHARE',
      article.analytics.topShare === null
        ? 'Not defined'
        : formatPercent(article.analytics.topShare),
    ],
  ]
  facts.forEach(([label, value], index) => {
    const x = 80 + (index % 2) * 740
    const y = gridTop + Math.floor(index / 2) * 160
    context.fillStyle = '#d9dfd6'
    context.fillRect(x, y, 680, 1)
    text(label!, x, y + 38, '18px sans-serif', muted)
    text(value!, x, y + 104, '46px Georgia')
  })
  sourceLines.forEach((line, index) =>
    text(line, 80, gridTop + 365 + index * 28, '21px sans-serif'),
  )
  text(
    `Article created ${formatDate(article.createdAt)} · Funding recorded for ${article.analytics.fundingKnownCount ?? article.analytics.count} of ${article.analytics.count} companies.`,
    80,
    footerTop,
    '19px sans-serif',
    muted,
  )
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error('The summary image could not be created.')),
      'image/png',
    ),
  )
}
