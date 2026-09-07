'use client'

/**
 * CAPABILITY PROGRESS — the organisation's record of people actually improving.
 *
 * ── WHY THIS SCREEN DID NOT EXIST ───────────────────────────────────────────
 *
 * Talent Management could show development PLANS, career paths and learning
 * assignments — all of them forward-looking. Nothing anywhere showed an
 * outcome. There was no capability-progress record in the product at all:
 * `EmployeeCompetencyProfileController::skillHistory` says so in a comment
 * ("Since we don't have a dedicated history table") and synthesises two entries
 * both stamped with the CURRENT level, so the one history view that shipped
 * always drew a flat line whatever had happened.
 *
 * competency_rating_history now records every movement with the value it
 * replaced and what caused it. This is the screen that reads it across the
 * organisation.
 *
 * ── WHAT IT DELIBERATELY DOES NOT CLAIM ─────────────────────────────────────
 *
 * "Improvements" counts genuine rises only. A first measurement is not a rise
 * — somebody being assessed for the first time has not improved, they have
 * become known — and a drop is not one either. Both are still visible in the
 * per-person record; they are just not counted as progress.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, TrendingUp, Users } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { apiClient } from '@/services/core'
import { withLaravelParams } from '@/lib/laravel-context'
import { CmCapabilityProgress } from '@/domain/competency/cm-capability-progress'

interface RosterRow {
  user_id: number
  name: string
  department: string | null
  jobrole: string | null
  changes: number
  improvements: number
  competencies_moved: number
  courses: number
  last_changed_at: string | null
}

export function CapabilityProgressRecord() {
  const { user } = useAuth()
  const [rows, setRows] = useState<RosterRow[]>([])
  const [withMovement, setWithMovement] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<RosterRow | null>(null)
  /**
   * True when the signed-in person may only see their own record.
   *
   * The menu row is granted to the Employee profile as well as to Admin and HR
   * — deliberately, because "the employee has the record of their own progress"
   * is the point of the screen. But the roster names other people and is
   * refused to them. Rather than show an employee a menu row that errors, the
   * screen becomes their own record.
   */
  const [ownRecordOnly, setOwnRecordOnly] = useState(false)

  const load = useCallback(async () => {
    const context = getLaravelContext(user)
    if (!isLaravelContextReady(context)) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await apiClient.get<{
        status: number
        data: { people: RosterRow[]; with_movement: number; total: number }
      }>('/competency/capability-progress/roster', withLaravelParams(context, {}))

      setRows(response.data?.people ?? [])
      setWithMovement(response.data?.with_movement ?? 0)
    } catch (reason) {
      // A 403 here is not a failure - it is an ordinary employee, and their own
      // record is the correct answer for them.
      const status = (reason as { status?: number } | null)?.status
      const forbidden =
        status === 403 ||
        (reason instanceof Error && /not permitted/i.test(reason.message))

      if (forbidden) {
        setOwnRecordOnly(true)
        setRows([])
      } else {
        setError(
          reason instanceof Error ? reason.message : 'Could not load the development record.',
        )
        setRows([])
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((row) =>
      [row.name, row.department, row.jobrole].some((value) =>
        (value ?? '').toLowerCase().includes(term),
      ),
    )
  }, [rows, search])

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorState title="Couldn't load the development record" description={error} retry={load} />
      </div>
    )
  }

  if (ownRecordOnly) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Capability Progress</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your own record of how your capability has changed, and what caused each change.
          </p>
        </div>
        <Card className="p-5">
          {/* No userId: the endpoint defaults to the caller. */}
          <CmCapabilityProgress title="How your capability has changed" />
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Capability Progress</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Who has improved, by how much, and what caused it. Every movement is recorded with the
          rating it replaced and the course or assessment behind it.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-3 p-4">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <TrendingUp className="size-5" />
          </span>
          <div className="flex flex-col">
            <span className="font-mono text-xl font-bold tabular-nums text-foreground">
              {withMovement}
            </span>
            <span className="text-xs text-muted-foreground">people whose capability has moved</span>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Users className="size-5" />
          </span>
          <div className="flex flex-col">
            <span className="font-mono text-xl font-bold tabular-nums text-foreground">
              {rows.length}
            </span>
            <span className="text-xs text-muted-foreground">people on record</span>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex flex-col">
            <span className="font-mono text-xl font-bold tabular-nums text-foreground">
              {rows.reduce((total, row) => total + row.improvements, 0)}
            </span>
            <span className="text-xs text-muted-foreground">
              recorded improvements
              {/* A first measurement is not an improvement; nor is a drop. */}
            </span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Card className="flex flex-col gap-3 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, department or role"
              className="pl-9"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nobody matches that search.
            </p>
          ) : (
            <ul className="flex max-h-[32rem] flex-col gap-1 overflow-y-auto">
              {filtered.map((row) => (
                <li key={row.user_id}>
                  <button
                    type="button"
                    onClick={() => setSelected(row)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                      selected?.user_id === row.user_id
                        ? 'bg-primary/10 text-foreground'
                        : 'hover:bg-muted/60',
                    )}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {row.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {row.jobrole ?? row.department ?? 'No role recorded'}
                      </span>
                    </span>
                    {row.improvements > 0 ? (
                      <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-success">
                        +{row.improvements}
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">—</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          {selected ? (
            <CmCapabilityProgress
              userId={selected.user_id}
              title={`${selected.name} — how their capability has changed`}
            />
          ) : (
            <EmptyState
              icon={<TrendingUp className="size-8" />}
              title="Choose someone"
              description="Pick a person to see which capabilities moved, what they were before, and which course or assessment caused it."
            />
          )}
        </Card>
      </div>
    </div>
  )
}
