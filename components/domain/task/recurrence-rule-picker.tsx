'use client'

import { Repeat } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { RecurrenceRule } from '@/types/task-management'

interface Props {
  value: RecurrenceRule | null
  onChange: (rule: RecurrenceRule | null) => void
}

const DEFAULT_RULE: RecurrenceRule = { frequency: 'weekly', interval: 1, until: null }

/**
 * Daily/weekly/monthly + interval + an optional end date — the exact fields
 * the backend's materialization engine supports, no more. CRM also offered
 * by-weekday and after-N-occurrences; both are left out here deliberately
 * rather than built against a backend that has nowhere to store them.
 */
export function RecurrenceRulePicker({ value, onChange }: Props) {
  const enabled = value !== null
  const rule = value ?? DEFAULT_RULE

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="recurrence-toggle" className="flex cursor-pointer items-center gap-2">
          <Repeat className="size-4 text-muted-foreground" />Repeats
        </Label>
        <Switch
          id="recurrence-toggle"
          checked={enabled}
          onChange={(event) => onChange(event.target.checked ? rule : null)}
        />
      </div>

      {enabled && (
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="recurrence-frequency">Every</Label>
            <div className="flex items-center gap-2">
              <Input
                id="recurrence-interval"
                type="number"
                min={1}
                max={52}
                value={rule.interval}
                onChange={(event) => onChange({ ...rule, interval: Math.max(1, Number(event.target.value) || 1) })}
                className="w-16"
              />
              <Select
                value={rule.frequency}
                onChange={(freq) => onChange({ ...rule, frequency: freq as RecurrenceRule['frequency'] })}
                options={[
                  { value: 'daily', label: rule.interval === 1 ? 'day' : 'days' },
                  { value: 'weekly', label: rule.interval === 1 ? 'week' : 'weeks' },
                  { value: 'monthly', label: rule.interval === 1 ? 'month' : 'months' },
                ]}
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recurrence-until">Until (optional)</Label>
            <Input
              id="recurrence-until"
              type="date"
              value={rule.until ?? ''}
              onChange={(event) => onChange({ ...rule, until: event.target.value || null })}
            />
          </div>
        </div>
      )}
    </div>
  )
}
