'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { roleRequirementsService, type RoleRequirement } from '@/services/competency/role-requirements'
import { competencyLibraryService } from '@/services/competency/library'

/**
 * WHAT THIS ROLE REQUIRES — inside the Job Role form.
 *
 * Replaces the standalone Role Requirements screen. The person defining the
 * role knows what it demands; an admin filling a matrix later is guessing.
 * Same move as task -> assign modal and course -> course form.
 *
 * SAVE IS A SYNC. POST /competency/role-map REPLACES the whole set, so every
 * write sends the complete list. Sending only the changed row would delete the
 * rest, and the write would succeed while doing it.
 *
 * PROFICIENCY IS REQUIRED, NOT OPTIONAL. The API rejects anything outside 1-5,
 * so a row always carries one. New rows default to 3 (mid scale) and stay
 * editable rather than being written silently at some hidden value.
 */
export function RoleCompetencyInlinePanel({
  jobroleId,
  readOnly = false,
}: {
  jobroleId: number | null
  readOnly?: boolean
}) {
  const { user } = useAuth()
  const [rows, setRows] = useState<RoleRequirement[]>([])
  const [library, setLibrary] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState('')

  const load = useCallback(async () => {
    if (!jobroleId) { setRows([]); return }
    setLoading(true)
    setError(null)
    try {
      const context = getLaravelContext(user)
      const [current, lib] = await Promise.all([
        roleRequirementsService.list(context, jobroleId),
        competencyLibraryService.list(context),
      ])
      setRows(current.data ?? [])
      setLibrary((lib.data ?? []).map((c) => ({ id: c.id, name: c.name })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load what this role requires.')
    } finally {
      setLoading(false)
    }
  }, [jobroleId, user])

  useEffect(() => { void load() }, [load])

  /** Always sends the FULL set — see the sync note above. */
  async function sync(next: { competency_id: number; required_proficiency: number; is_mandatory: boolean }[]) {
    if (!jobroleId) return
    setSaving(true)
    setError(null)
    try {
      await roleRequirementsService.save(getLaravelContext(user), jobroleId, next)
      await load()
      setPicked('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That change was not saved.')
    } finally {
      setSaving(false)
    }
  }

  const asInput = (list: RoleRequirement[]) =>
    list.map((r) => ({
      competency_id: r.competency_id,
      required_proficiency: r.required_proficiency,
      is_mandatory: r.is_mandatory,
    }))

  if (!jobroleId) return null

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-full" />
      </div>
    )
  }

  const usedIds = rows.map((r) => r.competency_id)
  const addable = library.filter((c) => !usedIds.includes(c.id))

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No competencies are required for this role yet. Add them so gaps can be measured against it.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-3 py-2"
            >
              <span className="text-sm font-medium">{row.competency_name}</span>
              {row.competency_code && (
                <span className="text-xs tabular-nums text-muted-foreground">{row.competency_code}</span>
              )}

              {/* The required level is the thing a gap is measured against, so it
                  is editable here rather than fixed at whatever it was created with. */}
              <Select
                options={[1, 2, 3, 4, 5].map((n) => ({ label: `Level ${n}`, value: String(n) }))}
                value={String(row.required_proficiency)}
                onChange={(value) =>
                  void sync(
                    asInput(rows).map((r) =>
                      r.competency_id === row.competency_id
                        ? { ...r, required_proficiency: Number(value) }
                        : r,
                    ),
                  )
                }
                className="h-8 w-28 bg-background text-xs"
                aria-label={`Required level for ${row.competency_name}`}
              />

              {!row.is_mandatory && (
                <span className="text-[11px] text-muted-foreground">optional</span>
              )}

              {!readOnly && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void sync(asInput(rows.filter((r) => r.id !== row.id)))}
                  className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-40"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!readOnly && addable.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <SearchableSelect
            options={addable.map((c) => ({ label: c.name, value: String(c.id) }))}
            value={picked}
            onChange={setPicked}
            placeholder="Add a competency this role requires…"
            searchPlaceholder="Search competencies…"
            emptyMessage="No competency matches that search"
            className="w-72"
            aria-label="Add a required competency"
          />
          <Button
            variant="outline"
            disabled={!picked || saving}
            onClick={() =>
              void sync([
                ...asInput(rows),
                { competency_id: Number(picked), required_proficiency: 3, is_mandatory: true },
              ])
            }
            className="h-9 px-3 text-xs font-semibold"
          >
            {saving ? 'Saving…' : 'Add'}
          </Button>
        </div>
      )}
    </div>
  )
}
