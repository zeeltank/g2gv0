import type { AiStackModule } from '@/components/ai-stack/ai-stack-module'
import type { ResolvedModule } from '@/lib/intelligence/ai-module-registry'

import { buildAiStack, type CentralSpec } from './central'

/**
 * An AI Stack for a module nobody wrote a descriptor for.
 *
 * `central.ts` holds hand-written wording for the modules that have been studied one by one: what
 * their central risk is, what a report of theirs may print. A module added later has none of that,
 * and inventing it would be claiming knowledge nobody has. So this derives only what the backend
 * has actually established - the module's key, label and route from the menu, and the data sources
 * discovered or declared for it - and uses neutral wording that promises no more than the stack
 * does (read-only, nothing inferred). Anything module-specific stays absent until a person writes it
 * into `central.ts`, at which point the hand-written descriptor takes precedence (see
 * `useActiveModule`).
 *
 * Nothing here is a record, a count or a name from anybody's data except the labels the backend
 * returned, and those are looked up at runtime.
 */

/** Presets offered on the Automations tab. The agent tools allow-list still covers every source. */
const MAX_PRESETS = 12

function singular(word: string): string {
  if (/ies$/i.test(word)) return word.replace(/ies$/i, 'y')
  if (/(ss|us)$/i.test(word)) return word
  return word.replace(/s$/i, '')
}

/** `crm.sales_orders` -> `sales_order`: the entity a ledger row is about. */
function entityKey(sourceKey: string): string {
  const short = sourceKey.includes('.') ? sourceKey.slice(sourceKey.indexOf('.') + 1) : sourceKey
  return singular(short.replace(/[^a-z0-9_]/gi, '_').toLowerCase()) || 'record'
}

export function genericSpec(resolved: ResolvedModule): CentralSpec {
  const label = resolved.label
  const readable = resolved.sources.filter((source) => source.readable)

  // Sources with records first, so the presets and the default report point at data that exists.
  const ranked = [...readable].sort((a, b) => (b.rows ?? 0) - (a.rows ?? 0))
  const primary =
    readable.find((source) => source.key === resolved.primary_source) ?? ranked[0] ?? null
  const presetSources = (primary ? [primary, ...ranked.filter((s) => s.key !== primary.key)] : ranked).slice(0, MAX_PRESETS)

  const recordsList = presetSources.slice(0, 3).map((source) => source.label.toLowerCase())
  const slug = resolved.menu_slug ?? resolved.key

  return {
    key: resolved.key,
    menuSlug: slug,
    route: resolved.route ?? `/module/${slug}`,
    label,
    records: recordsList.length > 0 ? recordsList.join(', ') : `${label} records`,
    record: primary ? singular(primary.label.toLowerCase()) : 'record',
    subjectEntityKey: primary ? entityKey(primary.key) : 'record',
    primarySource: primary?.key ?? '',
    sources: presetSources.map((source) => ({ key: source.key, label: source.label })),
    filters: [],
    generative: false,
    centralRisk: `an answer that goes beyond the records. AI may report what the ${label} records say; it may not infer, score or decide anything about a person or a deal from them, and it says so when a record is missing.`,
    policyNamePlaceholder: `${label} disclosure policy`,
    promptSystemDefault: `You answer questions about ${label}. Use only the records you are given, say when a figure is missing, and never infer anything the records do not state.`,
    reportCanPrint: `the figures come from the ${label} records rather than from a model.`,
    groundedOn: `the ${label} tables read for your organisation (${readable.length} data source${readable.length === 1 ? '' : 's'}).`,
  }
}

/** The stack for a resolved module. */
export function genericAiStack(resolved: ResolvedModule): AiStackModule {
  // A module with nothing readable still gets its stack (policies, models and the ledger do not need
  // data sources), but the report builder needs a source to default to.
  const spec = genericSpec(resolved)
  return buildAiStack(spec)
}
