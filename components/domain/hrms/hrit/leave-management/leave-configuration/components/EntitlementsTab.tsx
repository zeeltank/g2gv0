'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Save, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/ui/search-input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { leaveService, type LeaveAllocationData, type LeaveAllocationPayload } from '@/services/hrms'

/**
 * Leave entitlement — the module's missing front door. F-96.
 *
 * `hrms_leave_allocation` is what every leave balance in the product is
 * computed from. On the live database it holds **one row for the entire
 * platform**, and nothing but a private side effect of saving a leave type has
 * ever written to it. There was no screen.
 *
 * So `GET /api/leave/balances` answered, for a real administrator on tenant 3:
 * `{"overall":{"total":0,"used":7,"remaining":0}}` — seven days taken against
 * an entitlement of zero, with zero remaining. Every balance the product showed
 * was meaningless, and no over-application rule could be written until somebody
 * could set one.
 *
 * This is that somebody. A grant is days per department per leave type for a
 * leave year, which is the shape `entitlementByType()` already reads — this
 * gives the existing shape a way in rather than inventing a new one.
 */
export default function EntitlementsTab() {
  const { user } = useAuth()

  const [data, setData] = useState<LeaveAllocationData | null>(null)
  const [year, setYear] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  /** department id -> leave type id -> days, as edited. */
  const [draft, setDraft] = useState<Record<string, Record<string, string>>>({})
  const [baseline, setBaseline] = useState<Record<string, Record<string, string>>>({})

  const toDraft = (grid: LeaveAllocationData['grid']) => {
    const next: Record<string, Record<string, string>> = {}
    Object.entries(grid ?? {}).forEach(([departmentId, byType]) => {
      next[departmentId] = {}
      Object.entries(byType ?? {}).forEach(([typeId, value]) => {
        next[departmentId][typeId] = String(value)
      })
    })
    return next
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await leaveService.getAllocations(getLaravelContext(user))
      const payload = response.data ?? null
      setData(payload)
      setYear(response.year ?? null)
      const seeded = toDraft(payload?.grid ?? {})
      setDraft(seeded)
      setBaseline(seeded)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load entitlements.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const setCell = (departmentId: string, leaveTypeId: string, value: string) => {
    setDraft((prev) => ({
      ...prev,
      [departmentId]: { ...(prev[departmentId] ?? {}), [leaveTypeId]: value },
    }))
  }

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(baseline), [draft, baseline])

  const departments = useMemo(() => {
    const term = search.trim().toLowerCase()
    const all = data?.departments ?? []
    if (!term) return all
    return all.filter((department) => department.label.toLowerCase().includes(term))
  }, [data, search])

  /** Days × people, so a number on this screen has visible weight. */
  const totals = useMemo(() => {
    let grants = 0
    let personDays = 0
    Object.entries(draft).forEach(([departmentId, byType]) => {
      const headcount = Number(data?.headcount?.[departmentId] ?? 0)
      Object.values(byType).forEach((value) => {
        const days = Number(value)
        if (Number.isFinite(days) && days > 0) {
          grants += 1
          personDays += days * headcount
        }
      })
    })
    return { grants, personDays }
  }, [draft, data])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setMessage(null)

    // Only what changed, including cells cleared to 0 — the API reads 0 as
    // "remove this grant", which is how a grant is withdrawn.
    const allocations: LeaveAllocationPayload[] = []

    // Cells the user changed to something that is not a number, or is negative.
    // Counted rather than silently skipped - see the refusal below.
    let invalid = 0

    Object.entries(draft).forEach(([departmentId, byType]) => {
      Object.entries(byType).forEach(([leaveTypeId, value]) => {
        if ((baseline[departmentId]?.[leaveTypeId] ?? '') === value) return
        const days = value.trim() === '' ? 0 : Number(value)
        if (!Number.isFinite(days) || days < 0) {
          invalid += 1
          return
        }
        allocations.push({
          department_id: Number(departmentId),
          leave_type_id: Number(leaveTypeId),
          value: days,
        })
      })
    })

    /*
     * SAY WHY NOTHING WAS SAVED.
     *
     * This returned mute: an invalid cell was skipped above, and if that left
     * nothing to send the function exited with no message, no error and no
     * toast. The Save button is enabled whenever the draft is dirty, so the
     * user edited a cell, pressed Save, and the screen did absolutely nothing -
     * indistinguishable from a save that worked.
     */
    if (allocations.length === 0) {
      setSaving(false)
      setError(
        invalid > 0
          ? `${invalid} entitlement${invalid === 1 ? '' : 's'} could not be saved: enter a number of days that is zero or more.`
          : 'Nothing to save - no entitlement has been changed.',
      )
      return
    }

    try {
      const response = await leaveService.saveAllocations(getLaravelContext(user), allocations)
      if (String(response.status) === '0') {
        setError(response.message || 'Could not save entitlements.')
        return
      }
      setMessage(response.message || 'Entitlements saved.')
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save entitlements.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  if (error && !data) {
    return <ErrorState title="Unable to load entitlements" description={error} retry={load} />
  }

  const leaveTypes = data?.leave_types ?? []

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {data?.configured === 0 && (
        <Alert>
          <AlertDescription>
            <strong>No entitlements are set for {year}.</strong> Until they are, every leave balance in
            the product reads zero and the system cannot tell anyone they are out of leave. Set the days
            each department gets for each leave type below.
          </AlertDescription>
        </Alert>
      )}

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg font-bold">Leave entitlement — {year}</CardTitle>
            <CardDescription>
              Days granted per department, per leave type, for the April–March leave year. Clear a cell
              to remove that grant.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <SearchInput
              placeholder="Find a department..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-56"
            />
            <Button onClick={handleSave} disabled={!dirty || saving} className="gap-1.5 font-semibold">
              <Save className="size-4" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-6 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              <strong className="text-foreground">{totals.grants}</strong>{' '}
              grant{totals.grants === 1 ? '' : 's'} configured
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Users className="size-4" />
              <strong className="text-foreground">{totals.personDays.toLocaleString()}</strong>{' '}
              person-days granted
            </span>
            {dirty && <span className="font-medium text-warning">Unsaved changes</span>}
          </div>

          {leaveTypes.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No leave types are configured yet. Add them on the Leave Types tab first — an entitlement
              is days of a particular leave type.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-border bg-muted/40 text-left">
                    <th className="px-4 py-2.5 font-semibold">Department</th>
                    <th className="px-3 py-2.5 text-right font-semibold">People</th>
                    {leaveTypes.map((type) => (
                      <th key={type.value} className="px-3 py-2.5 text-center font-semibold">
                        {type.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {departments.length === 0 && (
                    <tr>
                      <td
                        colSpan={leaveTypes.length + 2}
                        className="px-4 py-10 text-center text-muted-foreground"
                      >
                        No departments match &ldquo;{search}&rdquo;.
                      </td>
                    </tr>
                  )}
                  {departments.map((department) => (
                    <tr key={department.value} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-2 font-medium text-foreground">{department.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {data?.headcount?.[department.value] ?? 0}
                      </td>
                      {leaveTypes.map((type) => (
                        <td key={type.value} className="px-3 py-2 text-center">
                          <Input
                            type="number"
                            min={0}
                            max={180}
                            step="0.5"
                            inputMode="decimal"
                            aria-label={`${type.label} days for ${department.label}`}
                            className="mx-auto h-8 w-20 text-center tabular-nums"
                            value={draft[department.value]?.[type.value] ?? ''}
                            onChange={(event) => setCell(department.value, type.value, event.target.value)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
