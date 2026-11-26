'use client'

import { useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from './native-select'
import { effectiveKind, type ParamDef } from '@/lib/workflows/catalog'
import { insertFact } from '@/lib/workflows/draft'
import { AutoField } from './auto-field'

/** The people an action can be given to: loading, loaded, or not available (then the person's number is typed). */
export type PeopleState = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; people: Array<{ id: number; name: string }> }

/**
 * One detail of a step, drawn from its typed definition: a text box, a longer text box, a number, a choice, a yes/no, a person, or (the advanced case) a
 * structured value. Text that can carry details of the record gets a small "Insert a detail" list, so nobody has to know the double-bracket notation.
 */
export function ParamField({ def, value, onChange, error, facts, people }: {
  def: ParamDef
  value: string
  onChange: (value: string) => void
  error?: string
  facts: ReadonlyArray<{ key: string; label: string }>
  people: PeopleState
}) {
  const kind = effectiveKind(def)
  const textRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const canInsert = def.facts && (kind === 'string' || kind === 'text') && facts.length > 0

  const insert = (fact: string) => {
    const el = textRef.current
    const result = insertFact(value, fact, el?.selectionStart)
    onChange(result.text)
    if (el) {
      el.focus()
      requestAnimationFrame(() => el.setSelectionRange(result.caret, result.caret))
    }
  }

  return (
    <AutoField label={def.label} required={def.required} hint={def.hint} error={error} wide={kind === 'text' || kind === 'json'}>
      {(control) => (
        <>
          {kind === 'text' && (
            <Textarea {...control} ref={textRef as React.Ref<HTMLTextAreaElement>} name={def.key} rows={3} maxLength={4000} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
          )}
          {kind === 'string' && (
            <Input {...control} ref={textRef as React.Ref<HTMLInputElement>} name={def.key} type="text" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
          )}
          {kind === 'json' && (
            <Textarea {...control} name={def.key} rows={3} autoComplete="off" spellCheck={false} className="font-mono text-xs" value={value} onChange={(e) => onChange(e.target.value)} placeholder={'{"account_id": "@account.id"}…'} />
          )}
          {kind === 'number' && (
            <Input {...control} name={def.key} type="number" inputMode="numeric" step={1} autoComplete="off" min={def.min} max={def.max} value={value} onChange={(e) => onChange(e.target.value)} />
          )}
          {kind === 'bool' && (
            <NativeSelect {...control} name={def.key} value={value} onChange={(e) => onChange(e.target.value)}>
              <option value="">Use the usual setting</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </NativeSelect>
          )}
          {kind === 'enum' && (
            <NativeSelect {...control} name={def.key} value={value} onChange={(e) => onChange(e.target.value)}>
              <option value="">{def.required ? 'Choose one…' : 'Not set'}</option>
              {(def.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </NativeSelect>
          )}
          {kind === 'user' && people.state === 'ready' && (
            <NativeSelect {...control} name={def.key} value={value} onChange={(e) => onChange(e.target.value)}>
              <option value="">Choose a person…</option>
              {people.people.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
            </NativeSelect>
          )}
          {kind === 'user' && people.state === 'loading' && (
            <NativeSelect {...control} name={def.key} value={value} disabled onChange={() => undefined}>
              <option value="">Loading people…</option>
            </NativeSelect>
          )}
          {kind === 'user' && people.state === 'failed' && (
            <Input {...control} name={def.key} type="number" inputMode="numeric" autoComplete="off" spellCheck={false} placeholder="The person’s number…" value={value} onChange={(e) => onChange(e.target.value)} />
          )}
          {canInsert && (
            <NativeSelect
              aria-label={`Insert a detail from the record into ${def.label}`}
              name={`${def.key}-insert`}
              value=""
              onChange={(e) => { if (e.target.value) insert(e.target.value) }}
              className="mt-1.5 text-muted-foreground"
            >
              <option value="">Insert a detail from the record…</option>
              {facts.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </NativeSelect>
          )}
        </>
      )}
    </AutoField>
  )
}
