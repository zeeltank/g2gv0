'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RecordDrawer } from '@/components/shared/scaffolds/record-drawer'
import { useConfirm } from '@/components/shared/scaffolds/use-confirm'
import { actionOptions, factChoices, fieldsOf, paramsOf, triggerOptions, type PickerOption } from '@/lib/workflows/catalog'
import {
  addAction, addCondition, changeActionType, changeConditionField, changeConditionOp, changeTrigger, draftFromWorkflow, draftNeedsApproval, draftSentence, draftToInput,
  emptyDraft, hasDraftProblems, isDirty, MAX_ACTIONS, MAX_CONDITIONS, patchActionParam, patchCondition, removeAction, removeCondition, validateDraft, type WorkflowDraft,
} from '@/lib/workflows/draft'
import { humanize } from '@/lib/workflows/labels'
import { readServerProblems, workflowErrorMessage, type ServerProblems } from '@/lib/workflows/messages'
import { switchPlan } from '@/lib/workflows/status'
import { NOTE_TONE } from '@/lib/workflows/tones'
import { gtmService } from '@/services/gtm/gtm'
import { workflowsService, type GtmWorkflow, type WorkflowCatalog } from '@/services/gtm/workflows'
import { cn } from '@/lib/utils'
import { AutoField } from './auto-field'
import { ConditionRow, StepCard } from './builder-parts'
import { GroupedPicker } from './grouped-picker'
import type { PeopleState } from './param-field'
import { TryItPanel } from './try-it-panel'

const FORM_ID = 'automation-builder-form'
const NO_SERVER: ServerProblems = { fields: {}, steps: {}, conditions: {}, general: [] }

/** The people steps can be given to, fetched once and only when a step needs them. */
function usePeople(needed: boolean): PeopleState {
  const [people, setPeople] = useState<PeopleState>({ state: 'loading' })
  const started = useRef(false)
  useEffect(() => {
    if (!needed || started.current) return
    started.current = true
    gtmService.directory()
      .then((r) => setPeople({ state: 'ready', people: r.data.users.map((u) => ({ id: u.id, name: u.name })) }))
      .catch(() => setPeople({ state: 'failed' }))
  }, [needed])
  return people
}

function Section({ id, title, hint, children, action }: { id: string; title: string; hint?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3 rounded-lg border border-border p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={id} className="text-pretty text-sm font-semibold text-foreground">{title}</h3>
          {hint && <p className="break-words text-xs text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

/**
 * The builder: "When [event], and [conditions], then [steps]", in a drawer, with the whole automation read back as one sentence at the top. It saves as a
 * draft (nothing happens yet); turning it on is a separate step, here or with the switch on the list. Closing it with changes asks first, and the form
 * says in words what is missing before it is sent, and what the server refused after.
 *
 * Mount it afresh (a new `key`) for each automation: it reads the automation once, when it opens.
 */
export function BuilderDrawer({ catalog, workflow, onClose, onSaved, onTurnedOn }: {
  catalog: WorkflowCatalog
  workflow: GtmWorkflow | null
  onClose: () => void
  /** The form was saved. The caller reloads the list and closes the drawer. */
  onSaved: (message: string) => void
  onTurnedOn: (message: string) => void
}) {
  const creating = workflow === null
  const [initial] = useState<WorkflowDraft>(() => (workflow ? draftFromWorkflow(workflow) : emptyDraft()))
  const [draft, setDraft] = useState<WorkflowDraft>(initial)
  const [busy, setBusy] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [server, setServer] = useState<ServerProblems>(NO_SERVER)
  const [dropped, setDropped] = useState<string | null>(null)
  const [errorToken, setErrorToken] = useState(0)
  const [tryOpen, setTryOpen] = useState(false)
  const { confirm, confirmDialog } = useConfirm()
  const formRef = useRef<HTMLFormElement>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const tryRef = useRef<HTMLDivElement>(null)

  const dirty = isDirty(initial, draft)
  const problems = useMemo(() => validateDraft(draft, catalog), [draft, catalog])
  const shown = attempted ? problems : null
  const people = usePeople(draft.actions.some((a) => paramsOf(catalog.actions[a.type]).some((d) => d.kind === 'user')))
  const sentence = draftSentence(draft, catalog)
  const forced = draftNeedsApproval({ ...draft, requiresApproval: false }, catalog)
  const facts = factChoices(catalog, draft.trigger)
  const fieldCount = Object.keys(fieldsOf(catalog, draft.trigger)).length

  const triggerChoices = useMemo<PickerOption[]>(() => {
    const options = triggerOptions(catalog)
    return draft.trigger !== '' && !options.some((o) => o.value === draft.trigger) ? [...options, { value: draft.trigger, label: humanize(draft.trigger), group: 'Other' }] : options
  }, [catalog, draft.trigger])
  const stepChoices = useMemo<PickerOption[]>(() => actionOptions(catalog, draft.trigger), [catalog, draft.trigger])

  // The drawer asks before it is closed with changes; closing the tab or reloading the page asks too.
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // After a failed save, focus goes to the first field with a problem (or to the summary), so a keyboard or a screen reader lands on what to fix.
  useEffect(() => {
    if (errorToken === 0) return
    const first = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
    ;(first ?? summaryRef.current)?.focus()
  }, [errorToken])

  const set = (next: WorkflowDraft) => { setDraft(next); setServer(NO_SERVER) }

  const pickTrigger = (value: string) => {
    const result = changeTrigger(draft, catalog, value)
    const parts = [
      result.droppedSteps > 0 ? `${result.droppedSteps} ${result.droppedSteps === 1 ? 'step' : 'steps'} that do not work with this event` : null,
      result.droppedConditions > 0 ? `${result.droppedConditions} ${result.droppedConditions === 1 ? 'condition' : 'conditions'}` : null,
    ].filter(Boolean)
    setDropped(draft.trigger !== '' && parts.length > 0 ? `Removed ${parts.join(' and ')}, because they belong to the previous event.` : null)
    set(result.draft)
  }

  const save = async () => {
    setAttempted(true)
    if (hasDraftProblems(validateDraft(draft, catalog))) { setErrorToken((n) => n + 1); return }
    setBusy(true)
    setServer(NO_SERVER)
    try {
      const input = draftToInput(draft, catalog, creating)
      if (workflow) await workflowsService.update(workflow.id, input)
      else await workflowsService.create(input)
      onSaved(creating ? 'Saved as a draft. Try it, then turn it on when you are ready.' : 'Saved.')
    } catch (e) {
      setServer(readServerProblems(e, catalog))
      setErrorToken((n) => n + 1)
    } finally {
      setBusy(false)
    }
  }

  const turnOn = async () => {
    if (!workflow) return
    const plan = switchPlan(workflow, catalog, true)
    if (plan.confirm && !(await confirm({ ...plan.confirm, tone: 'default' }))) return
    setBusy(true)
    setServer(NO_SERVER)
    try {
      await workflowsService.setStatus(workflow.id, 'active')
      onTurnedOn('Turned on. It reacts to new events from now on, not to past ones.')
    } catch (e) {
      setServer({ ...NO_SERVER, general: [workflowErrorMessage(e, 'It could not be turned on. Check it and try again.', catalog)] })
      setErrorToken((n) => n + 1)
    } finally {
      setBusy(false)
    }
  }

  const openTry = () => {
    setTryOpen(true)
    requestAnimationFrame(() => tryRef.current?.scrollIntoView({ block: 'start' }))
  }

  const general = [...(server.general ?? [])]
  const summary = shown && hasDraftProblems(shown) ? shown.all : []

  return (
    <>
      <RecordDrawer
        open
        onClose={onClose}
        title={creating ? 'New automation' : 'Edit automation'}
        description="When something happens and the details match, these steps run. Nothing happens until you turn it on."
        dirty={dirty}
        busy={busy}
        width="xl"
        footer={(requestClose) => (
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={requestClose} disabled={busy}>Cancel</Button>
            {workflow && <Button type="button" variant="outline" onClick={openTry} disabled={busy}>Try it</Button>}
            {workflow && !dirty && <Button type="button" variant="outline" onClick={() => void turnOn()} disabled={busy}>Turn on</Button>}
            <Button type="submit" form={FORM_ID} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {busy ? 'Saving…' : creating ? 'Save as draft' : 'Save changes'}
            </Button>
          </div>
        )}
      >
        <form ref={formRef} id={FORM_ID} noValidate onSubmit={(e) => { e.preventDefault(); void save() }} className="space-y-5">
          <section aria-label="What this automation does" className="rounded-lg border border-border border-l-4 border-l-primary bg-muted p-4">
            <p className="break-words text-base font-medium leading-7 text-foreground sm:text-lg">{sentence}</p>
          </section>

          {(general.length > 0 || summary.length > 0) && (
            <div ref={summaryRef} role="alert" tabIndex={-1} className={cn('rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring', NOTE_TONE.error)}>
              <p className="font-medium">{creating ? 'This could not be saved yet' : 'These changes could not be saved yet'}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {[...general, ...summary].map((m) => <li key={m} className="break-words">{m}</li>)}
              </ul>
            </div>
          )}

          <Section id="builder-about" title="Name it">
            <div className="grid grid-cols-1 gap-4">
              <AutoField label="Name" required error={shown?.name ?? server.fields.name?.join(' ')} hint="Shown in the list and in the run log.">
                {(control) => <Input {...control} name="name" type="text" autoComplete="off" maxLength={191} placeholder="For example: Welcome every new lead…" value={draft.name} onChange={(e) => set({ ...draft, name: e.target.value })} />}
              </AutoField>
              <AutoField label="What it is for (optional)" error={server.fields.description?.join(' ')}>
                {(control) => <Textarea {...control} name="description" rows={2} maxLength={2000} autoComplete="off" value={draft.description} onChange={(e) => set({ ...draft, description: e.target.value })} />}
              </AutoField>
            </div>
          </Section>

          <Section id="builder-when" title="When this happens">
            <AutoField
              label="What starts it"
              required
              error={shown?.trigger ?? server.fields.trigger_event?.join(' ')}
              hint={creating ? undefined : 'The event cannot be changed after the automation is created. Duplicate it to start from another event.'}
            >
              {(control) => (
                <GroupedPicker control={control} value={draft.trigger} options={triggerChoices} onChange={pickTrigger} disabled={!creating} placeholder="Choose an event…" searchLabel="Search events" />
              )}
            </AutoField>
            {dropped && <p role="status" className="text-xs text-muted-foreground">{dropped}</p>}
          </Section>

          <Section
            id="builder-and"
            title="And these details match"
            hint={draft.trigger === '' ? 'Choose an event first.' : draft.conditions.length === 0 ? 'No conditions: it applies every time the event happens.' : 'Every condition has to match.'}
            action={(
              <Button type="button" size="sm" variant="outline" disabled={draft.trigger === '' || fieldCount === 0 || draft.conditions.length >= MAX_CONDITIONS} onClick={() => set(addCondition(draft, catalog))}>
                <Plus className="size-4" aria-hidden="true" />Add a condition
              </Button>
            )}
          >
            {draft.conditions.length > 0 && (
              <ul className="space-y-3">
                {draft.conditions.map((c, i) => (
                  <ConditionRow
                    key={c.key}
                    index={i}
                    condition={c}
                    catalog={catalog}
                    trigger={draft.trigger}
                    errors={[...(shown?.conditions[c.key] ? [shown.conditions[c.key]] : []), ...(server.conditions[i] ?? [])]}
                    onField={(field) => set(changeConditionField(draft, catalog, c.key, field))}
                    onOp={(op) => set(changeConditionOp(draft, c.key, op))}
                    onValue={(value) => set(patchCondition(draft, c.key, { value }))}
                    onRemove={() => set(removeCondition(draft, c.key))}
                  />
                ))}
              </ul>
            )}
          </Section>

          <Section
            id="builder-then"
            title="Then do these steps, in order"
            hint={draft.trigger === '' ? 'Choose an event first.' : `Up to ${MAX_ACTIONS} steps.`}
            action={(
              <Button type="button" size="sm" variant="outline" disabled={draft.trigger === '' || draft.actions.length >= MAX_ACTIONS} onClick={() => set(addAction(draft, ''))}>
                <Plus className="size-4" aria-hidden="true" />Add a step
              </Button>
            )}
          >
            {draft.actions.length === 0 && <p className={cn('text-sm', shown?.steps ? 'text-foreground' : 'text-muted-foreground')}>{shown?.steps ?? 'Add the first step to say what should happen.'}</p>}
            {draft.actions.length > 0 && (
              <ol className="space-y-3">
                {draft.actions.map((a, i) => (
                  <StepCard
                    key={a.key}
                    index={i}
                    step={a}
                    catalog={catalog}
                    options={stepChoices}
                    errors={shown?.params[a.key]}
                    serverErrors={server.steps[i]}
                    facts={facts}
                    people={people}
                    onType={(type) => set(changeActionType(draft, a.key, type))}
                    onParam={(key, value) => set(patchActionParam(draft, a.key, key, value))}
                    onRemove={() => set(removeAction(draft, a.key))}
                  />
                ))}
              </ol>
            )}
          </Section>

          <Section id="builder-settings" title="Settings">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex min-h-6 min-w-0 cursor-pointer items-start gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  name="requires-approval"
                  checked={draft.requiresApproval || forced}
                  disabled={forced}
                  onChange={(e) => set({ ...draft, requiresApproval: e.target.checked })}
                  className="mt-0.5 size-4 flex-none outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <span className="min-w-0">
                  Ask an administrator to approve every run
                  <span className="block break-words text-xs text-muted-foreground">
                    {forced ? 'Always on: one of the steps needs approval.' : 'Each run waits in Runs until it is approved.'}
                  </span>
                </span>
              </label>
              <AutoField label="Most runs in one day" error={shown?.limit ?? server.fields.max_runs_per_day?.join(' ')} hint="After this many, new matches are skipped until tomorrow.">
                {(control) => <Input {...control} name="max-runs-per-day" type="number" inputMode="numeric" min={1} max={1000} autoComplete="off" value={draft.maxRunsPerDay} onChange={(e) => set({ ...draft, maxRunsPerDay: e.target.value })} />}
              </AutoField>
            </div>
          </Section>
        </form>

        <div ref={tryRef} className="mt-5 scroll-mt-4">
          <Section id="builder-try" title="Try it" hint={workflow ? undefined : 'Save as a draft first. Then you can try it on a real record.'}>
            {workflow && !tryOpen && <Button type="button" variant="outline" onClick={() => setTryOpen(true)}>Try it on a real record</Button>}
            {workflow && tryOpen && <TryItPanel workflow={workflow} catalog={catalog} unsavedChanges={dirty} />}
          </Section>
        </div>
      </RecordDrawer>
      {confirmDialog}
    </>
  )
}
