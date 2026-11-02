import { z } from 'zod'
import { MAX_RECORDS } from '../constants'

export { MAX_FILE_BYTES, MAX_RECORDS } from '../constants'
const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const optionalText = (max: number) => z.string().min(1).max(max).nullable()
export const companySchema = z.object({
  rank: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  company: z.string().trim().min(1).max(200),
  totalRaisedPence: money.nullable(),
  region: optionalText(150),
  stage: optionalText(100),
  employees: optionalText(100),
  description: optionalText(2000),
  website: z
    .url()
    .max(2048)
    .refine(
      (value) => ['https:', 'http:'].includes(new URL(value).protocol),
      'Use an HTTP or HTTPS website.',
    )
    .nullable(),
  industries: z.array(z.string().min(1).max(200)).max(50),
})
export const analyticsSchema = z.object({
  count: z.number().int().positive(),
  totalRaisedPence: money.nullable(),
  medianRaisedPence: money.nullable(),
  fundingKnownCount: z.number().int().nonnegative().optional(),
  topCount: z.number().int().nonnegative(),
  topShare: z.number().min(0).max(100).nullable(),
  regionKnownCount: z.number().int().nonnegative(),
  regions: z.array(
    z.object({ name: z.string(), count: z.number().int().positive() }),
  ),
})
export const copySchema = z
  .object({
    title: z.string().trim().min(8).max(180),
    metaDescription: z.string().trim().min(30).max(300),
    introduction: z.string().trim().min(40).max(1600),
    sections: z
      .array(
        z.object({
          heading: z.string().trim().min(4).max(160),
          body: z.string().trim().min(30).max(1600),
        }),
      )
      .min(2)
      .max(3),
  })
  .strict()
export const slugSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  )
  .max(130)
export const articleSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.uuid(),
  slug: slugSchema,
  createdAt: z.iso.datetime(),
  sourceFilename: z.string().min(1).max(200),
  rankingSource: z.enum(['supplied', 'derived']),
  importNotes: z.array(z.string().max(400)).max(20).default([]),
  companies: z.array(companySchema).min(1).max(MAX_RECORDS),
  analytics: analyticsSchema,
  copy: copySchema,
})
export type Company = z.infer<typeof companySchema>
export type Analytics = z.infer<typeof analyticsSchema>
export type ArticleCopy = z.infer<typeof copySchema>
export type Article = z.infer<typeof articleSchema>
export type Dataset = {
  companies: Company[]
  headers: string[]
  rankingSource: Article['rankingSource']
  importNotes: string[]
}
