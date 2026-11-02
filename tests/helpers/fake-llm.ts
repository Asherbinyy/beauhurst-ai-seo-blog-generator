import type { CopyGenerator } from '../../server/lib/copy'
// Included only in the separate test build selected by nuxt.config.ts.
export function createCopyGenerator(): CopyGenerator {
  return async (context) => {
    const subject = context.industries.some((value) =>
      /^(?:Medical devices|Health technology)$/i.test(value),
    )
      ? 'Healthtech'
      : context.industries.some((value) =>
            /fintech|banking|payment|financial/i.test(value),
          )
        ? 'Financial technology'
        : 'Company'
    const hasFunding = Object.hasOwn(context.facts, 'totalRaised')
    return {
      title: `${subject} companies: a dataset-led funding overview`,
      metaDescription: `Explore ${subject.toLowerCase()} companies in this supplied dataset, with fundraising figures, regional context and a complete company ranking.`,
      introduction: hasFunding
        ? `This dataset brings together {{companyCount}} companies working across ${subject.toLowerCase()}. Recorded fundraising for {{fundingKnownCount}} companies totals {{totalRaised}}, offering a view of the businesses included in this collection.`
        : 'This dataset brings together {{companyCount}} companies. Their descriptions and industry labels offer a view of the businesses included in this collection.',
      sections: [
        {
          heading: hasFunding
            ? 'A closer look at funding'
            : 'A closer look at the companies',
          body: hasFunding
            ? 'Median recorded fundraising is {{medianRaised}}. The ranking makes it possible to compare the companies within this dataset without treating it as a complete market census.'
            : 'The available descriptions and company context provide the basis for this report. Funding information was not supplied and remains unknown.',
        },
        {
          heading: 'Read the companies behind the figures',
          body: 'Company descriptions and industry labels provide context for the funding data. Missing information remains unknown and the source records are preserved in the table below.',
        },
      ],
    }
  }
}
