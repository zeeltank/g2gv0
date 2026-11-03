'use client'

import { useId, type ReactNode, type RefObject } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  aloneWarning, COUNTS_HEADING, counterLines, defaultText, killView, lastChangedText, levelEffect, levelLabel, levelOptions, MAX_AUTONOMY_REASON, needsSecondClick, NO_PROPOSALS_TEXT,
  RESUME_CONFIRM_TEXT, RESUME_TEXT, RESUME_WARNING, saveText, STOP_CONFIRM_TEXT, STOP_TEXT, STOP_WARNING,
} from '@/lib/agent/autonomy-model'
import type { Notice } from '@/lib/agent/model'
import { BANNER_TONE } from '@/lib/agent/tones'
import { cn } from '@/lib/utils'
import type { AutonomyAction, KillSwitch } from '@/services/agent/types'
import { StatePill } from './org-agent-parts'

const SELECT = 'h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50'

/**
 * The result of a change, in words, next to the thing that was changed. A success is announced politely and an error at once. The polite region is always
 * on the page (a region that appears with its text already in it is announced unreliably), and holds a box only while there is something to say.
 */
function RowMessage({ message }: { message: Notice | null }) {
  return (
    <>
      <div role="status" aria-live="polite" data-message="status">
        {message?.tone === 'success' && <p className={cn('rounded-lg border p-3 text-sm', BANNER_TONE.success)}>{message.text}</p>}
      </div>
      {message?.tone === 'error' && <p role="alert" data-message="error" className={cn('rounded-lg border p-3 text-sm', BANNER_TONE.error)}>{message.text}</p>}
    </>
  )
}

/** The optional reason and the buttons of a change that has been chosen and not yet saved. Escape on the row cancels it. */
function ChangeForm({ id, title, effect, warning, reason, onReason, saveLabel, busy, disabled, onSave, onCancel }: {
  id: string
  title: string
  effect: string | null
  warning: string | null
  reason: string
  onReason: (text: string) => void
  saveLabel: string
  busy: boolean
  disabled: boolean
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div role="group" aria-labelledby={`${id}-title`} data-change-form className="space-y-2 rounded-md border border-border bg-muted p-3">
      <p id={`${id}-title`} className="text-sm font-medium text-foreground">{title}</p>
      {effect && <p className="text-sm text-foreground">{effect}</p>}
      {warning && (
        <p data-warning className="rounded-md border border-amber-500 bg-card p-2 text-sm text-foreground"><strong>Warning:</strong> {warning}</p>
      )}
      <label htmlFor={`${id}-reason`} className="block text-xs font-medium text-foreground">Why are you changing it? (optional, kept in the audit trail)</label>
      <Textarea
        id={`${id}-reason`} size="sm" value={reason} maxLength={MAX_AUTONOMY_REASON} onChange={(event) => onReason(event.target.value)} disabled={disabled}
        aria-describedby={`${id}-count`} placeholder="For example: people accept almost every one of these."
      />
      <p id={`${id}-count`} className="text-xs text-muted-foreground">{reason.length} of {MAX_AUTONOMY_REASON} characters.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={disabled} onClick={onSave}>
          {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
          {saveLabel}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

/**
 * One action: its words, the level as a select with the default beside it, who changed it last, and what happened to its proposals in the last 30 days as the
 * evidence for raising or lowering the level. Choosing a level in the select only STAGES it (a closed select fires a change on every arrow press, so saving on
 * the change would save every level a keyboard user passes through); the optional reason and one Save button follow, and for the level that lets the agent act
 * alone the warning sits above that button, which is then the deliberate second click.
 */
export function ActionRow({ action, staged, reason, message, busy, anyBusy, locked, selectRef, onStage, onReason, onSave, onCancel }: {
  action: AutonomyAction
  /** The level that has been chosen and not saved, or null. */
  staged: string | null
  reason: string
  message: Notice | null
  /** This row's save is in flight. */
  busy: boolean
  /** Something is in flight: every control waits. */
  anyBusy: boolean
  /** The person may not change settings (a refusal said so): the controls are off and a sentence above says why. */
  locked: boolean
  selectRef: (element: HTMLSelectElement | null) => void
  onStage: (level: string) => void
  onReason: (text: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  const id = useId()
  const titleId = `${id}-title`
  const labelId = `${id}-label`
  const lines = counterLines(action.counts)
  const options = levelOptions(action)
  const chosen = staged ?? action.level
  return (
    <li
      data-action-row={action.key} data-level={action.level} aria-busy={busy} className="space-y-3 rounded-lg border border-border bg-card p-4"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || staged === null) return
        event.stopPropagation()
        onCancel()
      }}
    >
      <div className="space-y-1">
        <h3 id={titleId} className="text-sm font-semibold text-foreground">{action.label}</h3>
        {action.description && <p className="break-words text-sm text-muted-foreground">{action.description}</p>}
      </div>

      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <div className="flex flex-col gap-1">
          <label id={labelId} htmlFor={`${id}-level`} className="text-xs font-medium text-muted-foreground">Level</label>
          <select
            id={`${id}-level`} ref={selectRef} value={chosen} disabled={anyBusy || locked} aria-labelledby={`${titleId} ${labelId}`} aria-describedby={`${id}-effect`}
            onChange={(event) => onStage(event.target.value)} className={SELECT}
          >
            {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <p className="pb-2 text-xs text-muted-foreground" data-default>{defaultText(action)}</p>
      </div>

      <p id={`${id}-effect`} className="text-sm text-foreground" data-effect>
        <span className="font-medium">{levelLabel(action.level)}:</span> {levelEffect(action.level)}
      </p>

      {staged !== null && (
        <ChangeForm
          id={`${id}-change`} title={`Change to “${levelLabel(staged)}”?`} effect={levelEffect(staged)} warning={needsSecondClick(staged) ? aloneWarning(action.label) : null}
          reason={reason} onReason={onReason} saveLabel={saveText(staged)} busy={busy} disabled={anyBusy || locked} onSave={onSave} onCancel={onCancel}
        />
      )}

      <RowMessage message={message} />

      <div className="space-y-1">
        <h4 className="text-xs font-medium text-muted-foreground">{COUNTS_HEADING}</h4>
        {action.counts.proposed === 0 ? (
          <p className="text-sm text-muted-foreground" data-counts-empty>{NO_PROPOSALS_TEXT}</p>
        ) : (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5" data-counts>
            {lines.map((line) => (
              <div key={line.key} data-count={line.key} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{line.label}</dt>
                <dd className="text-sm font-semibold text-foreground">{line.value}</dd>
                {line.note && <dd className="break-words text-xs text-muted-foreground">{line.note}</dd>}
              </div>
            ))}
          </dl>
        )}
      </div>

      <p className="text-xs text-muted-foreground" data-last-changed>{lastChangedText(action.last_changed)}</p>
    </li>
  )
}

/**
 * The organisation's kill switch. Stopping and resuming are each two steps (an optional reason, then a confirming button), and only the organisation's OWN
 * switch can be changed: the platform's is shown, in words, with nothing to press.
 */
export function KillSwitchCard({ kill, staged, reason, message, busy, anyBusy, locked, toggleRef, onStage, onReason, onSave, onCancel }: {
  kill: KillSwitch
  /** `stop` or `resume` once chosen and not yet saved, or null. */
  staged: 'stop' | 'resume' | null
  reason: string
  message: Notice | null
  busy: boolean
  anyBusy: boolean
  locked: boolean
  toggleRef: RefObject<HTMLButtonElement | null>
  onStage: (kind: 'stop' | 'resume') => void
  onReason: (text: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  const id = useId()
  const view = killView(kill)
  const kind: 'stop' | 'resume' | null = view.canStop ? 'stop' : view.canResume ? 'resume' : null
  const toggle: ReactNode = kind === null ? null : (
    <Button
      ref={toggleRef} size="sm" variant="outline" className={kind === 'stop' ? 'border-destructive' : undefined} disabled={anyBusy || locked} aria-expanded={staged !== null}
      aria-controls={staged !== null ? `${id}-change` : undefined} onClick={() => (staged === null ? onStage(kind) : onCancel())}
    >
      {kind === 'stop' ? STOP_TEXT : RESUME_TEXT}
    </Button>
  )
  return (
    <section
      aria-labelledby={`${id}-title`} data-kill-switch={view.state} className="space-y-3 rounded-xl border border-border bg-card p-4"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || staged === null) return
        event.stopPropagation()
        onCancel()
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`${id}-title`} className="text-sm font-semibold text-foreground">Agent switch</h3>
        <StatePill view={view.state === 'running' ? { label: 'Running', tone: 'success' } : { label: 'Switched off', tone: 'error' }} />
      </div>
      <p className="text-sm font-medium text-foreground">{view.title}</p>
      <p className="text-sm text-muted-foreground">{view.text}</p>
      {toggle}
      {staged !== null && kind !== null && (
        <div id={`${id}-change`}>
          <ChangeForm
            id={`${id}-form`} title={staged === 'stop' ? `${STOP_TEXT}?` : 'Resume the agent?'} effect={null} warning={staged === 'stop' ? STOP_WARNING : RESUME_WARNING}
            reason={reason} onReason={onReason} saveLabel={staged === 'stop' ? STOP_CONFIRM_TEXT : RESUME_CONFIRM_TEXT} busy={busy} disabled={anyBusy || locked} onSave={onSave} onCancel={onCancel}
          />
        </div>
      )}
      <RowMessage message={message} />
    </section>
  )
}
