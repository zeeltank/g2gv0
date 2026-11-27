'use client'

/**
 * "Check which flow applies": type the values a request would carry and see which saved flow the engine would pick, with the same selection rule a real request meets.
 *
 * It takes typed values rather than a real record, so it works for every approval the platform will ever declare with no new code (see `simulateWorkflow`'s note), and it
 * tests the SAVED flows that are On, never the form in front of the person. It changes nothing.
 */

import { useId, useRef, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/shared/scaffolds'
import { describePlatformError } from '@/lib/platform/client'
import { simulateWorkflow, type SimulationResult } from '@/lib/platform/workflow'
import { previewContext, previewSummary } from '@/lib/platform/workflow-approvals'

import { Notice } from './parts'

interface Pair {
  key: number
  field: string
  value: string
}

export function PreviewPanel({ flowKey }: { flowKey: string }) {
  const headingId = useId()
  const nextKey = useRef(1)
  const [pairs, setPairs] = useState<Pair[]>([{ key: 0, field: '', value: '' }])
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const patch = (key: number, values: Partial<Pair>) => setPairs((current) => current.map((pair) => (pair.key === key ? { ...pair, ...values } : pair)))

  const check = async () => {
    setLoading(true)
    setProblem(null)

    try {
      setResult(await simulateWorkflow(flowKey, previewContext(pairs)))
    } catch (cause: unknown) {
      setResult(null)
      setProblem(describePlatformError(cause, 'The check could not be run. Try again in a moment.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section aria-labelledby={headingId} className="space-y-3 rounded-lg border border-border p-4">
      <header>
        <h3 id={headingId} className="text-sm font-semibold text-balance text-foreground">
          Check which flow applies
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Type a value and a number, such as leave_days and 7, to see which of your saved flows that are on would apply. Changes you have not saved are not included, and nothing is
          changed.
        </p>
      </header>

      <div className="space-y-3">
        {pairs.map((pair, index) => (
          <div key={pair.key} className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start">
            <Field label="Value">
              {(control) => (
                <Input
                  {...control}
                  name={`check-${index + 1}-value-name`}
                  value={pair.field}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="leave_days…"
                  onChange={(event) => patch(pair.key, { field: event.target.value })}
                />
              )}
            </Field>
            <Field label="Number">
              {(control) => (
                <Input
                  {...control}
                  name={`check-${index + 1}-number`}
                  value={pair.value}
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="7…"
                  onChange={(event) => patch(pair.key, { value: event.target.value })}
                />
              )}
            </Field>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="sm:mt-7"
              aria-label={`Remove value ${index + 1}`}
              title="Remove value"
              onClick={() => setPairs((current) => current.filter((other) => other.key !== pair.key))}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setPairs((current) => [...current, { key: nextKey.current++, field: '', value: '' }])}>
          <Plus aria-hidden="true" />
          Add a value
        </Button>
        <Button type="button" size="sm" disabled={loading} onClick={() => void check()}>
          {loading && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {loading ? 'Checking…' : 'Check these values'}
        </Button>
      </div>

      {problem && <Notice tone="error">{problem}</Notice>}
      {result && (
        <Notice tone={result.matched ? 'success' : 'caution'}>
          <span data-check-result>{previewSummary(result)}</span>
        </Notice>
      )}
    </section>
  )
}
