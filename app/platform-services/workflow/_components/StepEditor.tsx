'use client'

/**
 * The approval ladder editor.
 *
 * ── THE TWO RULES THIS UI HAS TO MAKE VISIBLE ───────────────────────────────
 *
 * 1. `role` and `user` are named by the person configuring the chain; the derived types
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
 */

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'

import type { RegistryOption } from '@/lib/platform/workflow'
import type { EscalationAction, WorkflowStep } from '@/lib/platform/workflow'

export type DraftStep = Omit<WorkflowStep, 'id' | 'order'> & { id?: string }

export function emptyStep(): DraftStep {
  return {
    name: '',
    approver_type: 'reporting_manager',
    approver: '',
    sla_hours: 24,
    on_breach: 'remind',
    allow_delegate: true,
    require_comment: false,
  }
}

const inputClass =
  'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function StepEditor({
  steps,
  approverTypes,
  escalationActions,
  onChange,
}: {
  steps: DraftStep[]
  approverTypes: RegistryOption[]
  escalationActions: RegistryOption[]
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
    <div className="space-y-2">
      {steps.length === 0 && (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          No steps yet. A chain with no steps can be saved as a draft, but it cannot be made
          active — there would be nobody to approve anything.
        </p>
      )}

      {steps.map((step, index) => {
        const type = approverTypes.find((option) => option.key === step.approver_type)
        const needsApprover = Boolean(type?.needs_value)
        const breachNeedsSla = step.on_breach !== 'none' && Number(step.sla_hours) === 0

        return (
          <div key={index} className="rounded-lg border border-border bg-background p-3">
            <div className="flex items-start gap-2">
              <span className="mt-1.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground tabular-nums">
                {index + 1}
              </span>

              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
                    Step name
                  </span>
                  <input
                    value={step.name}
                    onChange={(event) => patch(index, { name: event.target.value })}
                    placeholder="Reporting manager"
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
                    Who approves
                  </span>
                  <select
                    value={step.approver_type}
                    onChange={(event) =>
                      patch(index, {
                        approver_type: event.target.value as DraftStep['approver_type'],
                        // Clearing on switch, because a value left behind from a named
                        // type would be silently dropped by the server on save.
                        approver: '',
                      })
                    }
                    className={inputClass}
                  >
                    {approverTypes.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Only for the types that carry a value. See the file note. */}
                {needsApprover && (
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
                      {step.approver_type === 'role' ? 'Role key' : 'User id'}
                    </span>
                    <input
                      value={step.approver}
                      onChange={(event) => patch(index, { approver: event.target.value })}
                      placeholder={step.approver_type === 'role' ? 'hr_manager' : '1604'}
                      className={inputClass}
                    />
                  </label>
                )}

                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
                    Respond within (hours, 0 = no limit)
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={2160}
                    value={step.sla_hours}
                    onChange={(event) => patch(index, { sla_hours: Number(event.target.value) })}
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
                    If that passes
                  </span>
                  <select
                    value={step.on_breach}
                    onChange={(event) =>
                      patch(index, { on_breach: event.target.value as EscalationAction })
                    }
                    className={inputClass}
                  >
                    {escalationActions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {/* Said at the point of the mistake, not on save. */}
                  {breachNeedsSla && (
                    <span className="mt-1 block text-[11px] text-destructive">
                      Set a time above, or there is nothing for this to happen after.
                    </span>
                  )}
                  {/* The one option that can approve something nobody read. */}
                  {(step.on_breach === 'auto_approve' || step.on_breach === 'auto_reject') && (
                    <span className="mt-1 block text-[11px] text-amber-600 dark:text-amber-400">
                      This decides the request without anybody reading it.
                    </span>
                  )}
                </label>

                <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={step.allow_delegate}
                      onChange={(event) => patch(index, { allow_delegate: event.target.checked })}
                      className="size-3.5"
                    />
                    Can delegate
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={step.require_comment}
                      onChange={(event) => patch(index, { require_comment: event.target.checked })}
                      className="size-3.5"
                    />
                    Must leave a comment
                  </label>
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-1">
                <IconButton label="Move up" onClick={() => move(index, -1)} disabled={index === 0}>
                  <ArrowUp className="size-3.5" />
                </IconButton>
                <IconButton
                  label="Move down"
                  onClick={() => move(index, 1)}
                  disabled={index === steps.length - 1}
                >
                  <ArrowDown className="size-3.5" />
                </IconButton>
                <IconButton
                  label="Remove step"
                  onClick={() => onChange(steps.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </IconButton>
              </div>
            </div>
          </div>
        )
      })}

      <button
        type="button"
        onClick={() => onChange([...steps, emptyStep()])}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
      >
        <Plus className="size-3.5" />
        Add a step
      </button>
    </div>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="rounded border border-border p-1 transition-colors hover:bg-muted disabled:opacity-30"
    >
      {children}
    </button>
  )
}
