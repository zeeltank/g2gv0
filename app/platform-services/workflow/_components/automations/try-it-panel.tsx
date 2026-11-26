'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { entitySingular } from '@/lib/workflows/labels'
import { workflowErrorMessage } from '@/lib/workflows/messages'
import { describeDryRun, NOTHING_CHANGED, type TryItView } from '@/lib/workflows/try-it'
import { CHIP_BASE, chipClass, NOTE_TONE } from '@/lib/workflows/tones'
import { workflowsService, type GtmWorkflow, type WorkflowCatalog } from '@/services/gtm/workflows'
import { cn } from '@/lib/utils'
import { RecordPicker } from './record-picker'

/**
 * Try it: pick a real record, run the server's dry run, and read the result as plain steps. A dry run changes nothing, and the panel says so before the
 * click and after it.
 */
export function TryItPanel({ workflow, catalog, unsavedChanges }: {
  workflow: Pick<GtmWorkflow, 'id' | 'name' | 'trigger_event'>
  catalog: WorkflowCatalog
  /** The form holds changes that are not saved: the dry run uses the saved automation, and the panel says so. */
  unsavedChanges?: boolean
}) {
  const entity = catalog.triggers[workflow.trigger_event]?.entity ?? null
  const noun = entitySingular(entity)
  const [recordId, setRecordId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<TryItView | null>(null)

  const run = async () => {
    if (recordId === null) return
    setBusy(true)
    setError(null)
    setView(null)
    try {
      const r = await workflowsService.test(workflow.id, recordId)
      setView(describeDryRun(r.data, workflow.trigger_event, catalog))
    } catch (e) {
      setError(workflowErrorMessage(e, `Trying it did not work. Check that the ${noun} exists and try again.`, catalog))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">See what this automation would do for one real {noun}. {NOTHING_CHANGED}</p>
      {unsavedChanges && <p className={cn('rounded-lg border px-3 py-2 text-sm', NOTE_TONE.caution)}>This tries the saved automation, not the changes you have not saved yet.</p>}

      <RecordPicker key={workflow.id} entity={entity} value={recordId} onChange={(id) => { setRecordId(id); setView(null); setError(null) }} />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={run} disabled={busy || recordId === null}>
          {busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {busy ? 'Trying it…' : 'Try it'}
        </Button>
        {recordId === null && <span className="text-xs text-muted-foreground">Choose a {noun} first.</span>}
      </div>

      <div aria-live="polite" className="space-y-3">
        {error && <p role="alert" className={cn('break-words rounded-lg border px-3 py-2 text-sm', NOTE_TONE.error)}>{error}</p>}
        {view && (
          <section aria-label="What it would do" className="space-y-3 rounded-lg border border-border bg-muted p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="break-words text-sm font-medium text-foreground">{view.headline}</p>
              <span className={`${CHIP_BASE} ${chipClass('positive')}`}>{NOTHING_CHANGED}</span>
            </div>
            {view.checks.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs font-medium text-muted-foreground">What it checked</h4>
                <ul className="space-y-1">
                  {view.checks.map((line, i) => <li key={i} className="break-words text-sm text-foreground">{line.text}</li>)}
                </ul>
              </div>
            )}
            {view.steps.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs font-medium text-muted-foreground">What it would do</h4>
                <ol className="space-y-2">
                  {view.steps.map((line, i) => (
                    <li key={i} className="space-y-1">
                      <p className="break-words text-sm text-foreground">{line.text}</p>
                      {line.details.length > 0 && (
                        <dl className="grid grid-cols-1 gap-x-3 gap-y-0.5 text-xs sm:grid-cols-[auto_1fr]">
                          {line.details.map((d) => (
                            <div key={d.label} className="contents">
                              <dt className="text-muted-foreground">{d.label}</dt>
                              <dd className="break-words text-foreground">{d.value}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
