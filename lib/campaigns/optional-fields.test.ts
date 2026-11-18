import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import type { CampaignDetail } from '../../services/gtm/campaigns'
import type { Campaign, CampaignPayload, Lead } from '../../types/crm'

/**
 * Every field slice 9 added to a type is OPTIONAL, so that an older server (which sends none of them) still renders and a hand-built object without them still
 * compiles. Two checks, because neither alone could be broken on purpose and seen to fail:
 *
 * 1. Compile time (`tsc`): `Record<never, never>` is assignable to a `Pick` of the fields only if every one of them is optional, so making any of them required
 *    is a type error in this file.
 * 2. Run time: the declarations in types/crm.ts and services/gtm/campaigns.ts are read as text and must say `name?:`.
 */

type IsOptional<T, K extends keyof T> = Record<never, never> extends Pick<T, K> ? true : false
type Expect<T extends true> = T

export type CampaignExtrasAreOptional = Expect<IsOptional<Campaign, 'product' | 'funnel' | 'gtmCampaign' | 'leads'>>
export type LeadCampaignIsOptional = Expect<IsOptional<Lead, 'campaign'>>
export type ProductPayloadIsOptional = Expect<IsOptional<CampaignPayload, 'product_master_id'>>
export type GtmLinksAreOptional = Expect<IsOptional<CampaignDetail, 'product' | 'crm_campaign'>>

const read = (file: string) => readFileSync(path.resolve(file), 'utf8')

/** Says which declaration is missing instead of printing a 2,500-line file. */
function declares(source: string, pattern: RegExp, what: string) {
  assert.ok(pattern.test(source), `${what} is not declared as an optional field (it must read "name?: Type")`)
}

describe('the fields slice 9 added to the types are all optional (an older server sends none of them)', () => {
  const crm = read('types/crm.ts')
  const gtm = read('services/gtm/campaigns.ts')

  it('Campaign: product, funnel, gtmCampaign and leads', () => {
    declares(crm, /^ {2}product\?: CampaignProductRef \| null\r?$/m, 'Campaign.product')
    declares(crm, /^ {2}funnel\?: CampaignFunnel \| null\r?$/m, 'Campaign.funnel')
    declares(crm, /^ {2}gtmCampaign\?: CampaignGtmRef \| null\r?$/m, 'Campaign.gtmCampaign')
    declares(crm, /^ {2}leads\?: CampaignLeadsRef \| null\r?$/m, 'Campaign.leads')
  })

  it('Lead: campaign', () => {
    declares(crm, /^ {2}campaign\?: LeadCampaignRef \| null\r?$/m, 'Lead.campaign')
  })

  it('the create and edit request: product_master_id', () => {
    declares(crm, /^ {2}product_master_id\?: number \| null\r?$/m, 'CampaignPayload.product_master_id')
  })

  it('the GTM campaign detail: product and crm_campaign', () => {
    declares(gtm, /^ {2}product\?: \{ id: number; key: string \| null; name: string \} \| null\r?$/m, 'CampaignDetail.product')
    declares(gtm, /^ {2}crm_campaign\?: \{ id: number; name: string; status: string \| null \} \| null\r?$/m, 'CampaignDetail.crm_campaign')
  })
})
