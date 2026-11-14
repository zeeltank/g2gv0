import type { FormState } from '@/lib/icp-form'
import { buildIcpConfig, emptyIcpForm, emptyIcpLines, icpTouched, type IcpLines } from '@/lib/product-icp-draft'

/*
 * The "Ideal customer" section of the Sub-product form: three independent models, each its own ICP form and its own lines. Pure functions, no React, so the
 * rules can be tested. The parse is the Portfolio dialog's own (components/domain/portfolio/product-form-dialog.tsx, `parseIcpDataForModel`), moved here so
 * the new form and the old dialog read a stored ICP the same way; the payload is the one PortfolioController has always taken as `icp_configs`
 * (App\Domain\Portfolio\OfferIcpSync): one config per model that carries something.
 */

export type IcpModel = 'b2b' | 'b2c' | 'b2g'

/** The tabs in the order and words of today's Portfolio form. The keys are the stored model names (b2c is the partner-acquisition model). */
export const ICP_TABS: ReadonlyArray<{ key: IcpModel; label: string }> = [
  { key: 'b2b', label: 'B2B Customer Acquisition' },
  { key: 'b2g', label: 'B2G ICP' },
  { key: 'b2c', label: 'B2B Partner Acquisition' },
]

export const ICP_MODELS: readonly IcpModel[] = ['b2b', 'b2g', 'b2c']

export interface IcpState {
  form: FormState
  lines: IcpLines
}

export type IcpStates = Record<IcpModel, IcpState>

export function emptyIcpState(model: IcpModel): IcpState {
  return { form: { ...emptyIcpForm(), customer_model: model }, lines: emptyIcpLines() }
}

export function emptyIcpStates(): IcpStates {
  return { b2b: emptyIcpState('b2b'), b2c: emptyIcpState('b2c'), b2g: emptyIcpState('b2g') }
}

const lines = (v: unknown): string => (Array.isArray(v) ? v.join('\n') : typeof v === 'string' ? v : '')

/** One stored model's config as the form holds it; nothing stored gives an empty model. */
export function parseIcpForModel(data: Record<string, any> | undefined, productName: string, model: IcpModel): IcpState {
  if (!data) return emptyIcpState(model)
  const label = data.label ?? `${productName} ${model.toUpperCase()} ICP`
  const form: FormState = {
    ...emptyIcpForm(),
    customer_model: model,
    label,
    name: data.name ?? data.label ?? `${productName} ${model.toUpperCase()} ICP`,
    industry_label: data.industry_label ?? '',
    pitch: data.pitch ?? '',
    guidance: data.guidance ?? '',
    buyer_types: lines(data.buyer_types),
    regions: lines(data.regions),
    priority_cities: lines(data.priority_cities),
    competitors: lines(data.competitors),
    vendor_phrases: lines(data.vendor_phrases),
  }
  const trigger = (t: any): string => t?.pain || (Array.isArray(t?.phrases) ? t.phrases.join(', ') : t?.phrases) || t
  const raw = data.triggers
  const triggerList: any[] = Array.isArray(raw) ? raw : typeof raw === 'object' && raw !== null ? Object.values(raw) : []
  const first = (triggerList[0] ?? null) as Record<string, any> | null
  const queries = Array.isArray(data.queries) ? data.queries.map((q: any) => q?.q || q).filter(Boolean).join('\n') : ''
  const exclusions = Array.isArray(data.disqualifiers)
    ? data.disqualifiers.map((d: any) => (typeof d === 'string' ? d : d?.label || d?.phrases?.[0] || '')).filter(Boolean).join('\n')
    : ''

  return {
    form,
    lines: {
      triggers: triggerList.map(trigger).filter(Boolean).join('\n'),
      queries,
      exclusions,
      freshness: first?.decay != null ? String(first.decay) : '',
      source: first?.source ?? 'news',
    },
  }
}

/** The three models of an offer as the Portfolio read returns them (`individual_icps`, else a single `individual_icp` / `icp_config`). */
export function icpStatesFromOffer(offer: Record<string, any> | null | undefined, productName: string): IcpStates {
  const raw = (offer?.individual_icps || offer?.individual_icp || offer?.icp_config) as Record<string, any> | undefined
  const multi = Boolean(raw && (raw.b2b || raw.b2c || raw.b2g))
  const pick = (model: IcpModel): Record<string, any> | undefined => {
    if (!raw) return undefined
    if (multi) return raw[model]
    return model === 'b2b' ? (raw.customer_model === 'b2b' || !raw.customer_model ? raw : undefined) : raw.customer_model === model ? raw : undefined
  }

  return { b2b: parseIcpForModel(pick('b2b'), productName, 'b2b'), b2c: parseIcpForModel(pick('b2c'), productName, 'b2c'), b2g: parseIcpForModel(pick('b2g'), productName, 'b2g') }
}

const same = (a: IcpState, b: IcpState): boolean => JSON.stringify([a.form, a.lines]) === JSON.stringify([b.form, b.lines])

/** The models the person changed from what was loaded. */
export function changedIcpModels(initial: IcpStates, current: IcpStates): IcpModel[] {
  return ICP_MODELS.filter((m) => !same(initial[m], current[m]))
}

/** A model the person filled in or edited: it has something in it and differs from what was loaded (a new form: from empty). */
export function icpModelsToSend(initial: IcpStates, current: IcpStates): IcpModel[] {
  return changedIcpModels(initial, current).filter((m) => icpTouched(current[m].form, current[m].lines))
}

export type IcpConfigs = Partial<Record<IcpModel, ReturnType<typeof buildIcpConfig>>>

/** The configs to send, one per model to send; `offer` is what the config is named after. A model with no name is a problem the person sees on its tab. */
export function buildIcpConfigs(models: readonly IcpModel[], current: IcpStates, offer: { offer_id: string; name: string; what_it_does?: string | null }): { configs: IcpConfigs; problems: Partial<Record<IcpModel, string[]>> } {
  const configs: IcpConfigs = {}
  const problems: Partial<Record<IcpModel, string[]>> = {}
  for (const m of models) {
    if (current[m].form.label.trim() === '') {
      problems[m] = [`ICP name: give the ${m.toUpperCase()} ICP a name, or clear its fields.`]
      continue
    }
    const config = buildIcpConfig(current[m].form, current[m].lines, offer)
    config.customer_model = m
    configs[m] = config
  }

  return { configs, problems }
}
