'use client'

/**
 * "When it applies": the condition of an approval flow, as rows of "value, comparison, number" with the sentence they make, or as the line of text the engine reads.
 *
 * The engine's grammar is small on purpose (lib/platform/workflow-approvals.ts): numbers only, clauses joined by AND. The rows are the same rules written with
 * words, so they are the way in for a new flow; a condition written before the rows existed, or one the rows cannot show, stays a line of text that is saved exactly as
 * typed. The value names are free text because the screen cannot know which values an approval can compare: only the engine that resolves a request does.
 */

import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, NativeSelect } from '@/components/shared/scaffolds'
import {
  CONDITION_OPERATORS,
  conditionRowErrors,
  conditionWarning,
  describeRows,
  formatCondition,
  parseCondition,
  type ConditionOp,
  type ConditionRow,
  type ConditionRowErrors,
  type FlowForm,
} from '@/lib/platform/workflow-approvals'

import { Notice } from './parts'

type ConditionState = Pick<FlowForm, 'conditionMode' | 'conditionRows' | 'conditionText'>

export function ConditionEditor({
  value,
  errors,
  disabled,
  onChange,
}: {
  value: ConditionState
  errors: readonly ConditionRowErrors[]
  disabled: boolean
  onChange: (next: Partial<ConditionState>) => void
}) {
  const { conditionMode, conditionRows, conditionText } = value
  const warning = conditionWarning(value)
  // The sentence is made of the rows that are finished, so it never shows half a condition while someone is still typing it.
  const finished = conditionRows.filter((row) => Object.keys(conditionRowErrors(row)).length === 0)

  const patchRow = (index: number, row: Partial<ConditionRow>) => {
    onChange({ conditionRows: conditionRows.map((current, i) => (i === index ? { ...current, ...row } : current)) })
  }

  const showAsText = () => onChange({ conditionMode: 'text', conditionText: formatCondition(conditionRows) })

  const showAsRows = () => {
    const rows = parseCondition(conditionText)
    if (rows !== null) onChange({ conditionMode: 'rows', conditionRows: rows })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Compare a value to a number, for example leave_days is more than 5. When there are several, all of them must be true. Leave it empty to apply to every request.
      </p>

      {conditionMode === 'rows' ? (
        <>
          {conditionRows.length === 0 && <p className="text-sm text-foreground">Applies to every request.</p>}

          {conditionRows.map((row, index) => (
            <div key={index} data-condition-row={index + 1} className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start">
              <Field label="Value" required error={errors[index]?.field}>
                {(control) => (
                  <Input
                    {...control}
                    name={`condition-${index + 1}-value-name`}
                    value={row.field}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={disabled}
                    placeholder="leave_days…"
                    onChange={(event) => patchRow(index, { field: event.target.value })}
                  />
                )}
              </Field>

              <Field label="Comparison">
                {(control) => (
                  <NativeSelect
                    {...control}
                    name={`condition-${index + 1}-comparison`}
                    className="bg-background text-foreground"
                    value={row.op}
                    disabled={disabled}
                    onChange={(event) => patchRow(index, { op: event.target.value as ConditionOp })}
                  >
                    {CONDITION_OPERATORS.map((operator) => (
                      <option key={operator.op} value={operator.op}>
                        {operator.label}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>

              <Field label="Number" required error={errors[index]?.value}>
                {(control) => (
                  <Input
                    {...control}
                    name={`condition-${index + 1}-number`}
                    value={row.value}
                    inputMode="decimal"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={disabled}
                    placeholder="5…"
                    onChange={(event) => patchRow(index, { value: event.target.value })}
                  />
                )}
              </Field>

              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="sm:mt-7"
                aria-label={`Remove condition ${index + 1}`}
                title="Remove condition"
                disabled={disabled}
                onClick={() => onChange({ conditionRows: conditionRows.filter((_, i) => i !== index) })}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onChange({ conditionRows: [...conditionRows, { field: '', op: '>', value: '' }] })}>
              <Plus aria-hidden="true" />
              {conditionRows.length === 0 ? 'Add a condition' : 'Add another condition'}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={showAsText}>
              Edit as text
            </Button>
          </div>

          {finished.length > 0 && (
            <p aria-live="polite" className="break-words text-sm text-foreground" data-condition-sentence>
              Applies when {describeRows(finished)}.
            </p>
          )}
        </>
      ) : (
        <>
          <Field label="Condition" hint="A value, a comparison and a number, joined by AND, for example leave_days > 5 AND leave_type_id = 3.">
            {(control) => (
              <Input
                {...control}
                name="condition-text"
                value={conditionText}
                autoComplete="off"
                spellCheck={false}
                disabled={disabled}
                placeholder="leave_days > 5…"
                onChange={(event) => onChange({ conditionText: event.target.value })}
              />
            )}
          </Field>

          {warning && <Notice tone="caution">{warning}</Notice>}

          <Button type="button" variant="ghost" size="sm" disabled={disabled || parseCondition(conditionText) === null} onClick={showAsRows}>
            Edit as rows
          </Button>
        </>
      )}
    </div>
  )
}
