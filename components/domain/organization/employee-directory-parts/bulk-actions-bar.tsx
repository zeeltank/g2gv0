'use client'

import { useState } from 'react'
import { Building2, Download, Loader2, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { organizationService } from '@/services/organization'
import { employeeDirectoryService } from '@/services/organization/employee-directory'
import type { LaravelContext } from '@/lib/laravel-context'
import type { Employee } from '@/types/employee'

/**
 * Actions on a selection of employees.
 *
 * The table has been `selectable` all along with nothing to do with the
 * selection - and, until the getRowId fix, `selectedIds` held row *indices*,
 * so anything built on it would have acted on whoever happened to occupy those
 * positions after the next filter change. It holds employee ids now.
 *
 * Department assignment deliberately goes through the department module's own
 * writer rather than this module's update endpoint. That endpoint sets
 * department_id, jobtitle_id AND allocated_standards together and logs an
 * s_mobility_transfers row per person; writing department_id here instead
 * would leave the job role pointing at the old department and the move
 * unrecorded.
 */
export function BulkActionsBar({
  context,
  selected,
  departments,
  onClear,
  onExport,
  onDone,
}: {
  context: LaravelContext
  selected: Employee[]
  departments: { id: number; name: string }[]
  onClear: () => void
  onExport: () => void
  onDone: (message: string) => void | Promise<void>
}) {
  const [departmentId, setDepartmentId] = useState('')
  const [busy, setBusy] = useState('')

  const ids = selected.map((e) => Number(e.id))
  const label = `${selected.length} selected`

  async function run(key: string, action: () => Promise<string>) {
    setBusy(key)
    try {
      await onDone(await action())
    } catch (cause) {
      await onDone(cause instanceof Error ? cause.message : 'The action could not be completed.')
    } finally {
      setBusy('')
    }
  }

  function moveToDepartment() {
    const target = departments.find((d) => String(d.id) === departmentId)
    if (!target) return

    return run('move', async () => {
      const response = await organizationService.assignDepartmentEmployees(
        context,
        String(target.id),
        ids,
      )
      setDepartmentId('')
      return response?.message || `Moved ${ids.length} employee(s) to ${target.name}.`
    })
  }

  /**
   * Status changes are sent one at a time.
   *
   * There is no bulk status endpoint, and inventing one that half-succeeds is
   * worse than reporting exactly how many of the calls landed - which is what
   * the caller sees below.
   */
  function setStatusForAll(status: 0 | 1) {
    const verb = status === 0 ? 'Suspend' : 'Restore'
    if (!window.confirm(`${verb} access for ${selected.length} employee(s)?`)) return

    return run(String(status), async () => {
      const results = await Promise.allSettled(
        ids.map((id) => employeeDirectoryService.setStatus(context, id, status)),
      )
      const done = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.length - done

      return failed === 0
        ? `${verb}d access for ${done} employee(s).`
        : `${verb}d ${done} of ${results.length}; ${failed} could not be changed.`
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
      <span className="text-sm font-semibold text-foreground">{label}</span>

      <div className="flex min-w-52 items-center gap-2">
        <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <Select
          value={departmentId}
          onChange={setDepartmentId}
          placeholder="Move to department..."
          size="sm"
          options={departments.map((d) => ({ label: d.name, value: String(d.id) }))}
        />
        <Button size="sm" onClick={moveToDepartment} disabled={!departmentId || busy !== ''}>
          {busy === 'move' ? <Loader2 className="size-3.5 animate-spin" /> : 'Move'}
        </Button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onExport} disabled={busy !== ''}>
          <Download className="mr-2 size-3.5" /> Export selected
        </Button>
        <Button variant="outline" size="sm" onClick={() => setStatusForAll(1)} disabled={busy !== ''}>
          <ShieldCheck className="mr-2 size-3.5" /> Restore
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setStatusForAll(0)}
          disabled={busy !== ''}
          className="text-destructive hover:bg-destructive/10"
        >
          <ShieldAlert className="mr-2 size-3.5" /> Suspend
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear} disabled={busy !== ''} aria-label="Clear selection">
          <X className="size-4" />
        </Button>
      </div>
    </div>
  )
}
