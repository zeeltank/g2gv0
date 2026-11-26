/**
 * "Try it": what the server's dry run said, as plain steps. "Would run: book a meeting (needs your approval)", "Skipped: the deal amount 30,000 is not more
 * than 50,000". The dry run changes nothing and the screen says so.
 *
 * Pure: no React, no network. Tested in lib/workflows/try-it.test.ts.
 */
import type { ConditionTrace, DryRunResult, WorkflowCatalog } from '@/services/gtm/workflows'
import { fieldLabel } from './catalog'
import { lowerFirst, NO_VALUE_OPERATORS, operatorLabel, OPERATOR_NEGATED, sentenceCase, stripParenthetical } from './labels'
import { formatValue } from './sentence'

export const NOTHING_CHANGED = 'Nothing was changed.'

export interface TryItLine {
  tone: 'matched' | 'skipped' | 'would-run'
  text: string
  /** The details the step would use, with the details of the record filled in. */
  details: Array<{ label: string; value: string }>
}

export interface TryItView {
  headline: string
  wouldRun: boolean
  /** Why it would or would not run: one line per condition. */
  checks: TryItLine[]
  /** What it would do. Empty when it would not run. */
  steps: TryItLine[]
}

const isEmpty = (v: unknown): boolean => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)

export function checkLine(t: ConditionTrace, catalog: WorkflowCatalog, trigger: string, locale?: string): TryItLine {
  const subject = `the ${lowerFirst(fieldLabel(catalog, trigger, t.field))}`
  if (t.pass) {
    const text = NO_VALUE_OPERATORS.includes(t.op) ? `${subject} ${operatorLabel(t.op)}` : `${subject} ${operatorLabel(t.op)} ${formatValue(t.expected, locale)}`
    return { tone: 'matched', text: `Matches: ${text}`, details: [] }
  }
  const negated = OPERATOR_NEGATED[t.op] ?? `${operatorLabel(t.op)} (not met)`
  if (NO_VALUE_OPERATORS.includes(t.op)) return { tone: 'skipped', text: `Skipped: ${subject} ${negated}`, details: [] }
  if (isEmpty(t.actual)) {
    return { tone: 'skipped', text: `Skipped: ${subject} is empty, so it ${negated} ${formatValue(t.expected, locale)}`, details: [] }
  }
  return { tone: 'skipped', text: `Skipped: ${subject} ${formatValue(t.actual, locale)} ${negated} ${formatValue(t.expected, locale)}`, details: [] }
}

function detailRows(params: Record<string, unknown> | null | undefined, locale?: string): Array<{ label: string; value: string }> {
  return Object.entries(params ?? {})
    .filter(([, v]) => !isEmpty(v))
    .map(([key, v]) => ({ label: sentenceCase(key), value: typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : formatValue(v, locale) }))
}

/** The dry run as lines a salesperson reads. `trigger` is the automation's event, for the names of the facts. */
export function describeDryRun(result: DryRunResult, trigger: string, catalog: WorkflowCatalog, locale?: string): TryItView {
  const checks = result.conditions.map((t) => checkLine(t, catalog, trigger, locale))
  const approval = result.needs_approval ? ' (needs your approval)' : ''
  const steps: TryItLine[] = result.would_run
    ? result.actions.map((a) => ({
        tone: 'would-run' as const,
        text: `Would run: ${lowerFirst(stripParenthetical(a.label))}${approval}`,
        details: detailRows(a.params, locale),
      }))
    : []

  return {
    wouldRun: result.would_run,
    headline: !result.would_run
      ? 'It would not run for this record.'
      : result.needs_approval ? 'It would run for this record, after you approve it.' : 'It would run for this record.',
    checks,
    steps,
  }
}
