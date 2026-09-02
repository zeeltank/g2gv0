'use client'

/**
 * BULK ASSIGNMENT FROM THE JOB ROLE'S OWN TASK LIST.
 *
 * One row per standard duty the selected people's role already defines, each
 * with its own schedule and observer, saved in one go. This is the path for
 * "onboard this person into everything their role does" — the alternative is
 * filling the single-task form once per duty.
 *
 * PRESENTATIONAL ONLY, on purpose. Selecting, saving, the idempotency key and
 * closing the drawer all stay in create-task-modal, because they are one
 * transaction with the rest of the assignment flow: the parent owns the
 * assignees these rows are written for, and the submission key that makes a
 * double-click a replay rather than a second batch. Moving any of that here
 * would split one transaction across two files.
 */

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface RoleBulkRow {
  description: string
  repeatDays: string
  dueDate: string
  observerId: string
  priority: 'High' | 'Medium' | 'Low'
}

export function BulkRoleTaskPanel({
  suggestions, rows, onRowsChange, selected, onSelectedChange,
  observers, defaultObserverId, onCancel,
}: {
  suggestions: string[]
  rows: Record<string, RoleBulkRow>
  onRowsChange: (next: Record<string, RoleBulkRow>) => void
  selected: string[]
  onSelectedChange: (next: string[]) => void
  observers: { id: string; name: string }[]
  defaultObserverId: string
  onCancel: () => void
}) {
  const allSelected = suggestions.length > 0 && selected.length === suggestions.length

  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Bulk Job-role Task Assignment</h3>
          <p className="text-xs text-muted-foreground">Select and configure tasks for the chosen employees.</p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onCancel} aria-label="Back to the single task form">
          <X className="size-4" />
        </Button>
      </div>

      {suggestions.length ? (
        <div className="max-h-[420px] overflow-auto">
          {/* The table has a floor width and scrolls inside itself; the sheet
              must never scroll sideways. */}
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="p-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    aria-label={allSelected ? 'Clear all tasks' : 'Select all tasks'}
                    onChange={(event) => onSelectedChange(event.target.checked ? suggestions : [])}
                  />
                </th>
                <th className="p-2">Task</th>
                <th className="p-2">Description</th>
                <th className="p-2">Repeat</th>
                <th className="p-2">Repeat until</th>
                <th className="p-2">Observer</th>
                <th className="p-2">Priority</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((task) => {
                const row = rows[task] ?? {
                  description: '', repeatDays: '1', dueDate: '',
                  observerId: defaultObserverId, priority: 'Medium' as const,
                }
                const ticked = selected.includes(task)
                const update = (patch: Partial<RoleBulkRow>) =>
                  onRowsChange({ ...rows, [task]: { ...row, ...patch } })

                return (
                  <tr key={task} className="border-b align-top">
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={ticked}
                        aria-label={ticked ? `Remove ${task}` : `Include ${task}`}
                        onChange={(event) => onSelectedChange(
                          event.target.checked ? [...selected, task] : selected.filter((item) => item !== task),
                        )}
                      />
                    </td>
                    <td className="max-w-56 p-2 font-medium">{task}</td>
                    <td className="p-2">
                      <textarea
                        disabled={!ticked} value={row.description}
                        onChange={(event) => update({ description: event.target.value })}
                        className="min-h-16 w-48 rounded border p-2 disabled:bg-muted"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        disabled={!ticked} value={row.repeatDays}
                        onChange={(event) => update({ repeatDays: event.target.value })}
                        className="h-9 rounded border px-2 disabled:bg-muted"
                      >
                        {Array.from({ length: 14 }, (_, index) => (
                          <option key={index} value={index + 1}>{index + 1} day{index ? 's' : ''}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        disabled={!ticked} type="date" min={new Date().toISOString().slice(0, 10)}
                        value={row.dueDate} onChange={(event) => update({ dueDate: event.target.value })}
                        className="h-9 rounded border px-2 disabled:bg-muted"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        disabled={!ticked} value={row.observerId}
                        onChange={(event) => update({ observerId: event.target.value })}
                        className="h-9 max-w-40 rounded border px-2 disabled:bg-muted"
                      >
                        <option value="">Select</option>
                        {observers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </td>
                    <td className="p-2">
                      <select
                        disabled={!ticked} value={row.priority}
                        onChange={(event) => update({ priority: event.target.value as RoleBulkRow['priority'] })}
                        className="h-9 rounded border px-2 disabled:bg-muted"
                      >
                        <option>High</option><option>Medium</option><option>Low</option>
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No job-role tasks found for the selected employee.
        </p>
      )}

      {/* Saving lives in the sheet footer alongside every other mode's action,
          so the button you press is always in the same place. This announces
          the count for screen readers, which the footer label alone would not
          do as the selection changes. */}
      <p className="sr-only" role="status">
        {selected.length} of {suggestions.length} tasks selected
      </p>
    </div>
  )
}
