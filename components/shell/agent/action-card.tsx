'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { ActionOption, ActionValues } from '@/lib/chat-actions/types'
import { useChatActions } from './chat-actions-context'

const field =
  'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20'

/**
 * One proposed action, shown in the conversation.
 *
 * It walks the same states for every action: ask for what is missing, show exactly what will
 * be written, wait for an explicit Confirm, then show the real outcome. It renders what the
 * flow says and reports clicks; it decides nothing, so it cannot run an action the rules
 * would not allow.
 */
export function ActionCard({ messageId }: { messageId: string }) {
  const actions = useChatActions()
  const entry = actions?.entry(messageId) ?? null
  const [draft, setDraft] = useState<ActionValues | null>(null)
  const [options, setOptions] = useState<Record<string, ActionOption[]>>({})

  const inputs = entry?.inputs
  const phase = entry?.state.phase

  // Choices for select fields come from the application's real data, loaded when the form shows.
  useEffect(() => {
    if (!actions || !inputs || phase !== 'collecting') return

    let cancelled = false

    for (const input of inputs.filter((candidate) => candidate.type === 'select')) {
      actions
        .loadOptions(input)
        .then((loaded) => {
          if (!cancelled) setOptions((current) => ({ ...current, [input.key]: loaded }))
        })
        .catch(() => {
          if (!cancelled) setOptions((current) => ({ ...current, [input.key]: [{ value: '', label: 'Could not load choices' }] }))
        })
    }

    return () => {
      cancelled = true
    }
  }, [actions, inputs, phase])

  if (!actions || !entry) return null

  const { state } = entry
  const values = draft ?? state.values

  if (state.phase === 'collecting') {
    const submit = () => {
      const labels: Record<string, string> = {}
      for (const input of entry.inputs) {
        const chosen = options[input.key]?.find((option) => option.value === values[input.key])
        if (chosen) labels[input.key] = chosen.label
      }
      actions.submit(messageId, values, labels)
      setDraft(null)
    }

    return (
      <div className="w-full space-y-3 rounded-2xl border border-border/70 bg-card p-4 text-sm shadow-sm">
        <p className="font-medium text-foreground">{entry.label}</p>
        {entry.inputs.map((input) => (
          <label key={input.key} className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              {input.label}
              {input.required ? ' *' : ''}
            </span>
            {input.type === 'textarea' ? (
              <textarea
                className={field}
                rows={2}
                value={values[input.key] ?? ''}
                placeholder={input.placeholder}
                onChange={(event) => setDraft({ ...values, [input.key]: event.target.value })}
              />
            ) : input.type === 'select' ? (
              <select
                className={field}
                value={values[input.key] ?? ''}
                onChange={(event) => setDraft({ ...values, [input.key]: event.target.value })}
              >
                {(options[input.key] ?? [{ value: '', label: 'Loading…' }]).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={field}
                type="text"
                value={values[input.key] ?? ''}
                placeholder={input.placeholder}
                onChange={(event) => setDraft({ ...values, [input.key]: event.target.value })}
              />
            )}
            {state.errors[input.key] ? <span className="text-xs text-destructive">{state.errors[input.key]}</span> : null}
          </label>
        ))}
        <div className="flex gap-2 pt-1">
          <Button type="button" size="sm" onClick={submit}>
            Review
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => actions.cancel(messageId)}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  if (state.phase === 'confirming') {
    return (
      <div className="w-full space-y-3 rounded-2xl border border-primary/30 bg-card p-4 text-sm shadow-sm">
        <p className="font-medium text-foreground">{state.preview.title}</p>
        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1">
          {state.preview.lines.map((line) => (
            <div key={line.label} className="contents">
              <dt className="text-xs text-muted-foreground">{line.label}</dt>
              <dd className="break-words text-foreground">{line.value}</dd>
            </div>
          ))}
        </dl>
        {state.preview.warning ? <p className="text-xs text-amber-600">{state.preview.warning}</p> : null}
        <p className="text-xs text-muted-foreground">Nothing is saved until you confirm.</p>
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={() => actions.confirm(messageId)}>
            Confirm
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => actions.edit(messageId)}>
            Edit
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => actions.cancel(messageId)}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  if (state.phase === 'executing') {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Working on it…
      </div>
    )
  }

  if (state.phase === 'done' || state.phase === 'failed') {
    const ok = state.phase === 'done'
    const Icon = ok ? CheckCircle2 : AlertCircle

    return (
      <div
        className={
          ok
            ? 'flex items-start gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-foreground'
            : 'flex items-start gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive'
        }
      >
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div>
          <p>{state.result.message}</p>
          {state.result.link ? (
            <a className="text-xs underline" href={state.result.link.href}>
              {state.result.link.label}
            </a>
          ) : null}
        </div>
      </div>
    )
  }

  return <p className="text-xs text-muted-foreground">Cancelled. Nothing was saved.</p>
}
