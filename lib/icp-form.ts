import type { IcpConfig, IcpRule } from '@/services/signals/product-icp'

/*
 * The ICP editor's form <-> the server's ICP settings. Pure functions (no React) so they can be tested: the form never fills in a value the
 * person did not type, empty fields go to the server empty (it drops them), and a blank "stays fresh" means "until the closing date".
 */

export type Row<T> = T & { _id: number }
export type FormTrigger = { key: string; source: string; part: string; decay: string; pain: string; phrases: string }
export type FormQuery = { id: string; source: string; topic: string; days: string; q: string; domains: string }
export type FormRule = { kind: 'attribute' | 'field'; subject: string; op: string; value: string; label: string; prompt: string }

export interface FormState {
  name: string
  label: string
  industry_label: string
  pitch: string
  guidance: string
  buyer_types: string
  regions: string
  priority_cities: string
  competitors: string
  vendor_phrases: string
  parts: Row<{ key: string; what: string }>[]
  triggers: Row<FormTrigger>[]
  queries: Row<FormQuery>[]
  disqualifiers: Row<{ label: string; phrases: string }>[]
  must_have: Row<FormRule>[]
  catalogue: string
  accounts: string
}

let seq = 0
export const rid = () => ++seq


export const lines = (v: string) => v.split(/[\n,]/).map((x) => x.trim()).filter(Boolean)
const join = (v?: string[] | null) => (v ?? []).join('\n')

export function fromConfig(config: IcpConfig, name: string): FormState {
  return {
    name,
    label: config.label ?? '',
    industry_label: config.industry_label ?? '',
    pitch: config.pitch ?? '',
    guidance: config.guidance ?? '',
    buyer_types: join(config.buyer_types),
    regions: join(config.regions),
    priority_cities: join(config.priority_cities),
    competitors: join(config.competitors),
    vendor_phrases: join(config.vendor_phrases),
    parts: Object.entries(config.parts ?? {}).map(([key, what]) => ({ _id: rid(), key, what })),
    triggers: Object.entries(config.triggers ?? {}).map(([key, t]) => ({
      _id: rid(), key, source: t.source ?? 'news', part: t.part ?? '', decay: t.decay == null ? '' : String(t.decay), pain: t.pain ?? '', phrases: join(t.phrases),
    })),
    queries: (config.queries ?? []).map((q) => ({ _id: rid(), id: q.id, source: q.source, topic: q.topic, days: String(q.days), q: q.q, domains: join(q.domains) })),
    disqualifiers: (config.disqualifiers ?? []).map((d) => ({ _id: rid(), label: d.label, phrases: join(d.phrases) })),
    must_have: (config.must_have ?? []).map((r) => ({
      _id: rid(), kind: r.field !== undefined ? 'field' : 'attribute', subject: String(r.attribute ?? r.field ?? ''), op: r.op,
      value: Array.isArray(r.value) ? r.value.join(', ') : r.value == null ? '' : String(r.value), label: r.label, prompt: r.prompt ?? '',
    })),
    catalogue: config.per_run?.catalogue == null ? '' : String(config.per_run.catalogue),
    accounts: config.per_run?.accounts == null ? '' : String(config.per_run.accounts),
  }
}

const num = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? v.trim() : Number(v))

function ruleValue(r: FormRule): unknown {
  if (r.op === 'in_regions') return undefined
  const parts = r.value.split(',').map((x) => x.trim()).filter(Boolean)
  if (r.op === 'in' || r.op === 'not_in') return parts.map((p) => num(p))
  if (r.op === 'between') return parts.map((p) => num(p))
  return num(r.value)
}

/** The form as the server's ICP settings. Empty fields are sent empty, so the server drops them; nothing is filled in. */
export function toConfig(f: FormState): IcpConfig {
  const triggers: Record<string, unknown> = {}
  for (const t of f.triggers) {
    triggers[t.key.trim()] = {
      source: t.source, ...(t.part ? { part: t.part } : {}), decay: t.decay.trim() === '' ? null : num(t.decay), ...(t.pain.trim() ? { pain: t.pain.trim() } : {}), phrases: lines(t.phrases),
    }
  }
  return {
    label: f.label.trim(),
    industry_label: f.industry_label.trim(),
    pitch: f.pitch.trim(),
    guidance: f.guidance.trim(),
    buyer_types: lines(f.buyer_types),
    regions: lines(f.regions),
    priority_cities: lines(f.priority_cities),
    competitors: lines(f.competitors),
    vendor_phrases: lines(f.vendor_phrases),
    parts: Object.fromEntries(f.parts.filter((p) => p.key.trim()).map((p) => [p.key.trim(), p.what.trim()])),
    triggers: triggers as IcpConfig['triggers'],
    queries: f.queries.map((q) => ({
      id: q.id.trim(), source: q.source, topic: q.topic, days: num(q.days) as number, q: q.q.trim(), ...(lines(q.domains).length ? { domains: lines(q.domains) } : {}),
    })),
    disqualifiers: f.disqualifiers.map((d) => ({ label: d.label.trim(), phrases: lines(d.phrases) })),
    must_have: f.must_have.map((r) => ({
      [r.kind]: r.subject.trim(), op: r.op, ...(r.op === 'in_regions' ? {} : { value: ruleValue(r) }), label: r.label.trim(), ...(r.prompt.trim() ? { prompt: r.prompt.trim() } : {}),
    })) as IcpRule[],
    per_run: {
      ...(f.catalogue.trim() === '' ? {} : { catalogue: num(f.catalogue) as number }),
      ...(f.accounts.trim() === '' ? {} : { accounts: num(f.accounts) as number }),
    },
  }
}

