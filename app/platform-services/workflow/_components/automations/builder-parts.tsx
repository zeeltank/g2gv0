'use client'

import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from './native-select'
import { isConsequential, operatorsFor, paramsOf, type PickerOption } from '@/lib/workflows/catalog'
import type { ActionDraft, ConditionDraft } from '@/lib/workflows/draft'
import { STEP_TYPE, splitList, valueControl } from '@/lib/workflows/draft'
import { humanize, operatorLabel } from '@/lib/workflows/labels'
import { CHIP_BASE, chipClass, FIELD_ERROR_TEXT } from '@/lib/workflows/tones'
import type { WorkflowCatalog } from '@/services/gtm/workflows'
import { cn } from '@/lib/utils'
import { AutoField } from './auto-field'
import { GroupedPicker } from './grouped-picker'
import { ParamField, type PeopleState } from './param-field'

const errorText = (id: string, messages: readonly string[] | undefined) => (messages && messages.length > 0
  ? <p id={id} role="alert" className={cn('break-words text-xs', FIELD_ERROR_TEXT)}>{messages.join(' ')}</p>
  : null)

/** One condition: a detail of the record, how to compare it, and what to compare it with, typed from the catalog. */
export function ConditionRow({ index, condition, catalog, trigger, errors, onField, onOp, onValue, onRemove }: {
  index: number
  condition: ConditionDraft
  catalog: WorkflowCatalog
  trigger: string
  errors: string[]
  onField: (field: string) => void
  onOp: (op: string) => void
  onValue: (value: string) => void
  onRemove: () => void
}) {
  const fields = catalog.triggers[trigger]?.fields ?? {}
  const field = fields[condition.field]
  const operators = operatorsFor(catalog, field)
  const control = valueControl(field, condition.op)
  const n = index + 1
  const errorId = `condition-${condition.key}-error`
  const invalid = errors.length > 0 ? { 'aria-invalid': true as const, 'aria-describedby': errorId } : {}
  const chosen = new Set(splitList(condition.value))

  const toggle = (option: string, on: boolean) => {
    const next = on ? [...chosen, option] : [...chosen].filter((v) => v !== option)
    onValue(next.join(', '))
  }

  return (
    <li className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-foreground">Condition {n}</h4>
        <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove condition ${n}`} onClick={onRemove}>
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <NativeSelect aria-label={`Condition ${n}: what to look at`} name={`condition-${n}-field`} value={condition.field} onChange={(e) => onField(e.target.value)}>
          {!field && <option value={condition.field}>{humanize(condition.field)}</option>}
          {Object.entries(fields).map(([key, f]) => <option key={key} value={key}>{f.label}</option>)}
        </NativeSelect>
        <NativeSelect aria-label={`Condition ${n}: how to compare`} name={`condition-${n}-op`} value={condition.op} onChange={(e) => onOp(e.target.value)}>
          {!operators.includes(condition.op) && <option value={condition.op}>{operatorLabel(condition.op)}</option>}
          {operators.map((op) => <option key={op} value={op}>{operatorLabel(op)}</option>)}
        </NativeSelect>

        {control === 'none' && <p className="self-center text-sm text-muted-foreground">No value needed.</p>}
        {control === 'yesno' && (
          <NativeSelect aria-label={`Condition ${n}: value`} name={`condition-${n}-value`} value={condition.value} onChange={(e) => onValue(e.target.value)} {...invalid}>
            <option value="">Choose yes or no…</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </NativeSelect>
        )}
        {control === 'choice' && (
          <NativeSelect aria-label={`Condition ${n}: value`} name={`condition-${n}-value`} value={condition.value} onChange={(e) => onValue(e.target.value)} {...invalid}>
            <option value="">Choose one…</option>
            {(field?.options ?? []).map((o) => <option key={o} value={o}>{humanize(o)}</option>)}
          </NativeSelect>
        )}
        {control === 'number' && (
          <Input aria-label={`Condition ${n}: value`} name={`condition-${n}-value`} type="number" inputMode="decimal" autoComplete="off" value={condition.value} onChange={(e) => onValue(e.target.value)} {...invalid} />
        )}
        {(control === 'text' || control === 'texts') && (
          <Input
            aria-label={`Condition ${n}: value`}
            name={`condition-${n}-value`}
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder={control === 'texts' ? 'Separate values with commas…' : 'Type a value…'}
            value={condition.value}
            onChange={(e) => onValue(e.target.value)}
            {...invalid}
          />
        )}
      </div>
      {control === 'choices' && (
        <fieldset className="space-y-1">
          <legend className="text-xs text-muted-foreground">Tick every value that counts</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {(field?.options ?? []).map((o) => (
              <label key={o} className="flex min-h-6 cursor-pointer touch-manipulation items-center gap-2 text-sm text-foreground">
                <input type="checkbox" name={`condition-${n}-values`} value={o} checked={chosen.has(o)} onChange={(e) => toggle(o, e.target.checked)} className="size-4 outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                {humanize(o)}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {errorText(errorId, errors)}
    </li>
  )
}

/** One step: what it does (searchable, grouped), then its details, drawn from the catalog's typed list. */
export function StepCard({ index, step, catalog, options, errors, serverErrors, facts, people, onType, onParam, onRemove }: {
  index: number
  step: ActionDraft
  catalog: WorkflowCatalog
  options: readonly PickerOption[]
  /** Messages from the form's own checks: one for "what it does" (under STEP_TYPE), one per detail. */
  errors: Record<string, string> | undefined
  /** Messages the server gave about this step. */
  serverErrors: string[] | undefined
  facts: ReadonlyArray<{ key: string; label: string }>
  people: PeopleState
  onType: (type: string) => void
  onParam: (key: string, value: string) => void
  onRemove: () => void
}) {
  const n = index + 1
  const defs = paramsOf(catalog.actions[step.type])
  const consequential = isConsequential(catalog, step.type)
  const errorId = `step-${step.key}-error`

  return (
    <li className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-medium text-foreground">Step {n}</h4>
          {consequential && <span className={`${CHIP_BASE} ${chipClass('caution')}`}>Needs approval</span>}
        </div>
        <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove step ${n}`} onClick={onRemove}>
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <AutoField label="What it does" required error={errors?.[STEP_TYPE]}>
        {(control) => (
          <GroupedPicker control={control} value={step.type} options={options} onChange={onType} placeholder="Choose what it does…" searchLabel={`Search steps for step ${n}`} />
        )}
      </AutoField>
      {consequential && <p className="text-xs text-muted-foreground">Each run waits for an administrator to approve it before this step happens.</p>}

      {defs.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {defs.map((def) => (
            <ParamField key={def.key} def={def} value={step.params[def.key] ?? ''} onChange={(v) => onParam(def.key, v)} error={errors?.[def.key]} facts={facts} people={people} />
          ))}
        </div>
      )}
      {errorText(errorId, serverErrors)}
    </li>
  )
}
