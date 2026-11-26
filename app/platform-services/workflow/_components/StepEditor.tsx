'use client'

/**
 * The step editor of an approval flow.
 *
 * ── THE TWO RULES THIS UI HAS TO MAKE VISIBLE ───────────────────────────────
 *
 * 1. `role` and `user` are named by the person configuring the flow; the derived types
 *    are resolved from the record at approval time. So the approver input APPEARS only
 *    for the types that need it. Showing a disabled box for the others would invite
 *    somebody to type into it and wonder why it is ignored — and the server blanks the
 *    value anyway, so anything typed there is discarded silently.
 *
 * 2. A breach action needs an SLA to happen after. The server refuses the combination,
 *    and the form says so at the point of the mistake rather than letting somebody save
 *    and read it back as an error.
 *
 * Order is array position, not a field. The server recomputes `order` from the order
 * the steps arrive in, so the up/down controls are the only thing that sets it — two
 * sources of ordering is one too many.
 *
 * Every control is a labelled `Field`; what is wrong with one is said under it (`errors`, from `validateFlowForm`).
 */

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Field, NativeSelect } from '@/components/shared/scaffolds'
import type { EscalationAction, RegistryOption } from '@/lib/platform/workflow'
import { emptyStep, MAX_SLA_HOURS, MAX_STEPS, type DraftStep, type StepErrors } from '@/lib/platform/workflow-approvals'

const SELECT = 'bg-background text-foreground'

export function StepEditor({
  steps,
  approverTypes,
  escalationActions,
  errors = [],
  disabled = false,
  onChange,
}: {
  steps: DraftStep[]
  approverTypes: RegistryOption[]
  escalationActions: RegistryOption[]
  /** What is wrong with each step, by position. */
  errors?: readonly StepErrors[]
  disabled?: boolean
  onChange: (next: DraftStep[]) => void
}) {
  const patch = (index: number, values: Partial<DraftStep>) => {
    onChange(steps.map((step, i) => (i === index ? { ...step, ...values } : step)))
  }

  const move = (index: number, delta: number) => {
    const target = index + delta

    if (target < 0 || target >= steps.length) return

    const next = [...steps]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {steps.length === 0 && (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
          No steps yet. A flow with no steps can be saved as a draft, but it cannot be turned on, because nobody would be there to approve anything.
        </p>
      )}

      {steps.map((step, index) => {
        const type = approverTypes.find((option) => option.key === step.approver_type)
        const needsApprover = Boolean(type?.needs_value)
        const problems = errors[index] ?? {}
        const decidesAlone = step.on_breach === 'auto_approve' || step.on_breach === 'auto_reject'

        return (
          <div key={index} data-step={index + 1} className="rounded-lg border border-border bg-background p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">Step {index + 1}</p>
              <div className="flex flex-wrap gap-1">
                <Button type="button" variant="outline" size="icon-sm" aria-label={`Move step ${index + 1} up`} title="Move up" disabled={disabled || index === 0} onClick={() => move(index, -1)}>
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label={`Move step ${index + 1} down`}
                  title="Move down"
                  disabled={disabled || index === steps.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
                <Button type="button" variant="outline" size="icon-sm" aria-label={`Remove step ${index + 1}`} title="Remove step" disabled={disabled} onClick={() => onChange(steps.filter((_, i) => i !== index))}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Step name" required error={problems.name}>
                {(control) => (
                  <Input
                    {...control}
                    name={`step-${index + 1}-name`}
                    value={step.name}
                    autoComplete="off"
                    disabled={disabled}
                    placeholder="For example, Reporting manager…"
                    onChange={(event) => patch(index, { name: event.target.value })}
                  />
                )}
              </Field>

              <Field label="Who approves">
                {(control) => (
                  <NativeSelect
                    {...control}
                    name={`step-${index + 1}-approver-type`}
                    className={SELECT}
                    value={step.approver_type}
                    disabled={disabled}
                    onChange={(event) =>
                      patch(index, {
                        approver_type: event.target.value as DraftStep['approver_type'],
                        // Clearing on switch, because a value left behind from a named
                        // type would be silently dropped by the server on save.
                        approver: '',
                      })
                    }
                  >
                    {approverTypes.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>

              {/* Only for the types that carry a value. See the file note. */}
              {needsApprover && (
                <Field label={step.approver_type === 'role' ? 'Role name' : 'Person’s user id'} required error={problems.approver} wide>
                  {(control) => (
                    <Input
                      {...control}
                      name={`step-${index + 1}-approver`}
                      value={step.approver}
                      autoComplete="off"
                      spellCheck={false}
                      inputMode={step.approver_type === 'role' ? 'text' : 'numeric'}
                      disabled={disabled}
                      placeholder={step.approver_type === 'role' ? 'hr_manager…' : '1604…'}
                      onChange={(event) => patch(index, { approver: event.target.value })}
                    />
                  )}
                </Field>
              )}

              <Field label="Respond within (hours)" error={problems.sla} hint="0 means there is no time limit.">
                {(control) => (
                  <Input
                    {...control}
                    type="number"
                    name={`step-${index + 1}-hours`}
                    min={0}
                    max={MAX_SLA_HOURS}
                    step={1}
                    inputMode="numeric"
                    autoComplete="off"
                    disabled={disabled}
                    value={step.sla_hours}
                    onChange={(event) => patch(index, { sla_hours: Number(event.target.value) })}
                  />
                )}
              </Field>

              <Field
                label="If the time runs out"
                error={problems.breach}
                hint={
                  /* The one option that can approve something nobody read. */
                  decidesAlone ? (
                    <span className="block rounded-md border border-amber-500 bg-card px-2 py-1 text-foreground">This decides the request without anybody reading it.</span>
                  ) : undefined
                }
              >
                {(control) => (
                  <NativeSelect
                    {...control}
                    name={`step-${index + 1}-on-breach`}
                    className={SELECT}
                    value={step.on_breach}
                    disabled={disabled}
                    onChange={(event) => patch(index, { on_breach: event.target.value as EscalationAction })}
                  >
                    {escalationActions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 sm:col-span-2">
                <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm text-foreground">
                  <Checkbox size="sm" checked={step.allow_delegate} disabled={disabled} onCheckedChange={(checked) => patch(index, { allow_delegate: checked })} />
                  Can pass it on to someone else
                </label>
                <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm text-foreground">
                  <Checkbox size="sm" checked={step.require_comment} disabled={disabled} onCheckedChange={(checked) => patch(index, { require_comment: checked })} />
                  Must leave a comment
                </label>
              </div>
            </div>
          </div>
        )
      })}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" disabled={disabled || steps.length >= MAX_STEPS} onClick={() => onChange([...steps, emptyStep()])}>
          <Plus aria-hidden="true" />
          Add a step
        </Button>
        {steps.length >= MAX_STEPS && <p className="text-xs text-muted-foreground">An approval flow can have at most {MAX_STEPS} steps.</p>}
      </div>
    </div>
  )
}
