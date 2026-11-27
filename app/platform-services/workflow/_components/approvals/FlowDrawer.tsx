'use client'

/**
 * The form that adds or edits an approval flow, in a drawer beside the list.
 *
 * Closing it by any route (the X, Escape, a click outside, Cancel) asks first while something is unsaved, and cannot happen while a save runs: that is `RecordDrawer`.
 * Save is checked here first with the server's own rules (`validateFlowForm`), so the common mistakes are said next to the field and the first one takes focus; what
 * the server still refuses is shown at the top as it came. The keys sent are the ones the screen has always sent, and the server's rules and versions are untouched.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Field, FormLayout, FormSection, NativeSelect, RecordDrawer } from '@/components/shared/scaffolds'
import { describePlatformError, PlatformApiError } from '@/lib/platform/client'
import {
  createWorkflow,
  updateWorkflow,
  type PlatformRegistryPayload,
  type WorkflowPoint,
  type WorkflowStatus,
} from '@/lib/platform/workflow'
import {
  FLOW_STATUS_MEANING,
  FLOW_STATUS_WORD,
  FLOW_STATUSES,
  flowPayload,
  hasFlowFormErrors,
  isFlowFormDirty,
  validateFlowForm,
  type FlowForm,
  type RejectMode,
} from '@/lib/platform/workflow-approvals'

import { StepEditor } from '../StepEditor'
import { ConditionEditor } from './ConditionEditor'
import { Notice, FIELD_ERROR_FIX } from './parts'
import { PreviewPanel } from './PreviewPanel'

const SELECT = 'bg-background text-foreground'

export function FlowDrawer({
  open,
  point,
  moduleLabel,
  initial,
  registry,
  onClose,
  onSaved,
}: {
  open: boolean
  point: WorkflowPoint
  moduleLabel: string
  /** The form as it was opened. The drawer is remounted for each opening, so this never changes under it. */
  initial: FlowForm
  registry: PlatformRegistryPayload
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const formId = useId()
  const body = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState<FlowForm>(initial)
  const [attempted, setAttempted] = useState(false)
  const [focusRequest, setFocusRequest] = useState(0)
  const [busy, setBusy] = useState(false)
  const [refused, setRefused] = useState<string | null>(null)

  const patch = (values: Partial<FlowForm>) => {
    setForm((current) => ({ ...current, ...values }))
    setRefused(null)
  }

  const context = useMemo(() => ({ enforced: point.enforced, approverTypes: registry.approver_types }), [point.enforced, registry.approver_types])
  // Nothing is called wrong before the first Save; after it, each change is checked as it is made.
  const errors = useMemo(() => (attempted ? validateFlowForm(form, context) : null), [attempted, form, context])
  const dirty = isFlowFormDirty(initial, form)
  const editing = form.id !== null

  // A reload or a Back press would throw away what was typed without the drawer's own question, so the browser asks as well, while something is unsaved.
  useEffect(() => {
    if (!open || !dirty) return

    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)

    return () => window.removeEventListener('beforeunload', warn)
  }, [open, dirty])

  // The first field that is wrong takes focus when Save finds a problem.
  useEffect(() => {
    if (focusRequest === 0) return
    body.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [focusRequest])

  const submit = async () => {
    if (busy) return

    const found = validateFlowForm(form, context)
    setAttempted(true)

    if (hasFlowFormErrors(found)) {
      setFocusRequest((count) => count + 1)
      return
    }

    setBusy(true)
    setRefused(null)

    try {
      if (form.id === null) {
        await createWorkflow(flowPayload(form))
      } else {
        await updateWorkflow(form.id, flowPayload(form))
      }

      onSaved('Approval flow saved.')
    } catch (cause: unknown) {
      // The server writes its refusals as instructions ("Step 3: set an SLA, or there is nothing for…"), so what it says is shown as it came.
      setRefused(cause instanceof PlatformApiError ? cause.message : describePlatformError(cause, 'The approval flow could not be saved. Try again in a moment.'))
    } finally {
      setBusy(false)
    }
  }

  const problems = [errors?.steps, refused].filter((message): message is string => Boolean(message))

  return (
    <RecordDrawer
      open={open}
      onClose={onClose}
      title={editing ? 'Edit approval flow' : 'Add an approval flow'}
      description={`${point.label} in ${moduleLabel}`}
      dirty={dirty}
      busy={busy}
      width="xl"
      footer={(requestClose) => (
        <>
          <Button type="button" variant="outline" disabled={busy} onClick={requestClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={busy}>
            {busy && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {busy ? 'Saving…' : 'Save approval flow'}
          </Button>
        </>
      )}
    >
      <div ref={body} className={`space-y-5 ${FIELD_ERROR_FIX}`}>
        {!editing && <p className="text-sm text-muted-foreground">A new flow starts as a draft, so nothing waits for it yet. Turn it on when its steps are right.</p>}

        {problems.length > 0 && (
          <Notice tone="error">
            <p className="font-medium">This could not be saved</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {problems.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </Notice>
        )}

        <FormLayout id={formId} onSubmit={() => void submit()}>
          <FormSection title="Details">
            <Field label="Name" hint={`Leave it empty to use “${point.label}”.`}>
              {(control) => (
                <Input {...control} name="flow-name" value={form.name} maxLength={150} autoComplete="off" disabled={busy} onChange={(event) => patch({ name: event.target.value })} />
              )}
            </Field>

            <Field label="Status" error={errors?.status}>
              {(control) => (
                <NativeSelect {...control} name="flow-status" className={SELECT} value={form.status} disabled={busy} onChange={(event) => patch({ status: event.target.value as WorkflowStatus })}>
                  {FLOW_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {FLOW_STATUS_WORD[status]}: {FLOW_STATUS_MEANING[status]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
          </FormSection>

          <FormSection title="When it applies">
            <div className="sm:col-span-2">
              <ConditionEditor value={form} errors={errors?.conditionRows ?? []} disabled={busy} onChange={(values) => patch(values)} />
            </div>
          </FormSection>

          <FormSection title="If someone rejects">
            <Field label="Then">
              {(control) => (
                <NativeSelect {...control} name="flow-on-reject" className={SELECT} value={form.onReject} disabled={busy} onChange={(event) => patch({ onReject: event.target.value as RejectMode })}>
                  <option value="return_to_requester">Return it to the person who asked</option>
                  <option value="close">Close it, nothing more happens</option>
                </NativeSelect>
              )}
            </Field>

            <label className="flex min-h-8 cursor-pointer items-center gap-2 self-end text-sm text-foreground">
              <Checkbox size="sm" checked={form.notifyRequester} disabled={busy} onCheckedChange={(checked) => patch({ notifyRequester: checked })} />
              Tell the person who asked about each decision
            </label>
          </FormSection>

          <FormSection title="Steps" saves="In this order, top first">
            <div className="sm:col-span-2">
              <StepEditor
                steps={form.steps}
                approverTypes={registry.approver_types}
                escalationActions={registry.escalation_actions}
                errors={errors?.step}
                disabled={busy}
                onChange={(steps) => patch({ steps })}
              />
            </div>
          </FormSection>
        </FormLayout>

        <PreviewPanel flowKey={form.flowKey} />
      </div>
    </RecordDrawer>
  )
}
